import type {
  IconBox,
  IconDoc,
  IconPrimitive,
  LaidOutScreen,
  LayoutEngine,
  TextBox,
  Theme,
  WidgetLayout,
} from '@shared/lib/layout-engine';
import type { FontData } from '@shared/lib/layout-engine';

export type RGB = number; // 0xRRGGBB

export function hexToRgb(hex: string): RGB {
  return parseInt(hex.replace('#', ''), 16);
}

export function rgbTo565(hex: string): number {
  const v = hexToRgb(hex);
  return (((v >> 16) & 0xf8) << 8) | (((v >> 8) & 0xfc) << 3) | ((v & 255) >> 3);
}

export function rgb565ToRgb565(r: number, g: number, b: number): number {
  return ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
}

export function mix565(a: number, b: number, t: number): number {
  const ar = ((a >> 11) & 31) * 255 / 31;
  const ag = ((a >> 5) & 63) * 255 / 63;
  const ab = (a & 31) * 255 / 31;
  const br = ((b >> 11) & 31) * 255 / 31;
  const bg = ((b >> 5) & 63) * 255 / 63;
  const bb = (b & 31) * 255 / 31;
  return rgb565ToRgb565(
    Math.round(ar + (br - ar) * t),
    Math.round(ag + (bg - ag) * t),
    Math.round(ab + (bb - ab) * t)
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

const b64Cache = new Map<string, Uint8Array>();
function decodeBase64(data: string): Uint8Array {
  const cached = b64Cache.get(data);
  if (cached) return cached;
  const bin = atob(data);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  b64Cache.set(data, out);
  return out;
}

export class Framebuffer {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint16Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint16Array(width * height);
  }

  clear(color: number) {
    this.pixels.fill(color);
  }

  pixel(x: number, y: number, color: number) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.pixels[y * this.width + x] = color;
  }

  rect(x: number, y: number, w: number, h: number, color: number) {
    const x0 = clamp(Math.round(x), 0, this.width);
    const y0 = clamp(Math.round(y), 0, this.height);
    const x1 = clamp(Math.round(x + w), 0, this.width);
    const y1 = clamp(Math.round(y + h), 0, this.height);
    if (x1 <= x0) return;
    const row = this.width;
    for (let yy = y0; yy < y1; yy++) {
      this.pixels.fill(color, yy * row + x0, yy * row + x1);
    }
  }

  hline(x: number, y: number, w: number, color: number) {
    this.rect(x, y, w, 1, color);
  }

  vline(x: number, y: number, h: number, color: number) {
    this.rect(x, y, 1, h, color);
  }

  line(x0: number, y0: number, x1: number, y1: number, color: number, thickness = 1) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const half = Math.floor(thickness / 2);
    for (;;) {
      if (thickness <= 1) this.pixel(x0, y0, color);
      else this.rect(x0 - half, y0 - half, thickness, thickness, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  fillCircle(cx: number, cy: number, r: number, color: number) {
    const rr = r * r;
    for (let y = -r; y <= r; y++) {
      const span = Math.floor(Math.sqrt(rr - y * y));
      this.rect(cx - span, cy + y, span * 2 + 1, 1, color);
    }
  }

  ring(cx: number, cy: number, r: number, color: number, thickness = 1) {
    const steps = Math.max(24, Math.ceil(r * 8));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * r);
      const y = Math.round(cy + Math.sin(a) * r);
      if (thickness <= 1) this.pixel(x, y, color);
      else this.fillCircle(x, y, Math.floor(thickness / 2), color);
    }
  }

  arc(cx: number, cy: number, r: number, a0: number, a1: number, color: number, thickness = 1) {
    const steps = Math.max(12, Math.ceil(Math.abs(a1 - a0) * r * 1.4));
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (a1 - a0) * (i / steps);
      const x = Math.round(cx + Math.cos(a) * r);
      const y = Math.round(cy + Math.sin(a) * r);
      if (thickness <= 1) this.pixel(x, y, color);
      else this.fillCircle(x, y, Math.floor(thickness / 2), color);
    }
  }

  fillRoundRect(x: number, y: number, w: number, h: number, r: number, color: number) {
    const radius = clamp(Math.round(r), 0, Math.floor(Math.min(w, h) / 2));
    if (radius === 0) {
      this.rect(x, y, w, h, color);
      return;
    }
    for (let yy = 0; yy < h; yy++) {
      let inset = 0;
      if (yy < radius) {
        const dy = radius - yy - 1;
        inset = radius - Math.floor(Math.sqrt(Math.max(0, radius * radius - dy * dy)));
      } else if (yy >= h - radius) {
        const dy = yy - (h - radius);
        inset = radius - Math.floor(Math.sqrt(Math.max(0, radius * radius - dy * dy)));
      }
      this.rect(x + inset, y + yy, w - inset * 2, 1, color);
    }
  }

  strokeRoundRect(x: number, y: number, w: number, h: number, r: number, color: number, thickness = 1) {
    const radius = clamp(Math.round(r), 0, Math.floor(Math.min(w, h) / 2));
    if (radius === 0) {
      this.rect(x, y, w, thickness, color);
      this.rect(x, y + h - thickness, w, thickness, color);
      this.rect(x, y, thickness, h, color);
      this.rect(x + w - thickness, y, thickness, h, color);
      return;
    }
    this.rect(x + radius, y, w - radius * 2, thickness, color);
    this.rect(x + radius, y + h - thickness, w - radius * 2, thickness, color);
    this.rect(x, y + radius, thickness, h - radius * 2, color);
    this.rect(x + w - thickness, y + radius, thickness, h - radius * 2, color);
    const rr = radius - thickness / 2;
    const th = Math.max(1, Math.round(thickness));
    this.arc(x + radius, y + radius, rr, Math.PI, Math.PI * 1.5, color, th);
    this.arc(x + w - radius, y + radius, rr, Math.PI * 1.5, Math.PI * 2, color, th);
    this.arc(x + w - radius, y + h - radius, rr, 0, Math.PI * 0.5, color, th);
    this.arc(x + radius, y + h - radius, rr, Math.PI * 0.5, Math.PI, color, th);
  }

  fillPoly(points: number[][], color: number) {
    if (points.length < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, py] of points) {
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const nodes: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
          nodes.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
        }
      }
      nodes.sort((a, b) => a - b);
      for (let i = 0; i + 1 < nodes.length; i += 2) {
        this.rect(nodes[i], y, nodes[i + 1] - nodes[i] + 1, 1, color);
      }
    }
  }

  strokePoly(points: number[][], color: number, thickness = 1, closed = false) {
    for (let i = 0; i < points.length - 1; i++) {
      this.line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], color, thickness);
    }
    if (closed && points.length > 2) {
      this.line(points[points.length - 1][0], points[points.length - 1][1], points[0][0], points[0][1], color, thickness);
    }
  }

  text(font: FontData, text: string, x: number, baseline: number, color: number) {
    const bitmap = decodeBase64(font.bitmap);
    let pen = Math.round(x);
    const base = Math.round(baseline);
    for (const ch of text) {
      const code = ch.codePointAt(0) ?? 32;
      if (code === 10 || code === 13) continue;
      const glyph = font.glyphs[code - font.first];
      if (!glyph) continue;
      if (glyph.width > 0 && glyph.height > 0) {
        // GFX fonts store each glyph as a continuous MSB-first bit stream.
        // Rows are not padded to byte boundaries (this matches TFT_eSPI's
        // drawChar loop exactly).
        let bitPos = glyph.offset * 8;
        for (let row = 0; row < glyph.height; row++) {
          for (let col = 0; col < glyph.width; col++) {
            const byte = bitmap[bitPos >> 3] ?? 0;
            const mask = 0x80 >> (bitPos & 7);
            if (byte & mask) {
              this.pixel(pen + glyph.xOffset + col, base + glyph.yOffset + row, color);
            }
            bitPos++;
          }
        }
      }
      pen += glyph.xAdvance;
    }
  }

  toImageData(): ImageData {
    const data = new Uint8ClampedArray(this.width * this.height * 4);
    for (let i = 0; i < this.pixels.length; i++) {
      const c = this.pixels[i];
      data[i * 4] = ((c >> 11) & 31) * 255 / 31;
      data[i * 4 + 1] = ((c >> 5) & 63) * 255 / 63;
      data[i * 4 + 2] = (c & 31) * 255 / 31;
      data[i * 4 + 3] = 255;
    }
    return new ImageData(data, this.width, this.height);
  }

  toRgba(): Uint8ClampedArray {
    return this.toImageData().data;
  }
}

export interface RenderOptions {
  showBackHit?: boolean;
  showGrid?: boolean;
  grid?: number;
}

export class SceneRenderer {
  readonly theme: Theme;
  readonly icons: IconDoc;
  readonly engine: LayoutEngine;
  readonly fb: Framebuffer;

  constructor(theme: Theme, icons: IconDoc, engine: LayoutEngine) {
    this.theme = theme;
    this.icons = icons;
    this.engine = engine;
    this.fb = new Framebuffer(theme.display.width, theme.display.height);
  }

  private color(key: string | null | undefined): number {
    if (!key) return rgbTo565('#000000');
    const hex = this.theme.colors[key];
    return hex ? rgbTo565(hex) : rgbTo565('#ff00ff');
  }

  private font(id: string): FontData {
    return this.engine.resolveFont(id).font;
  }

  draw(laid: LaidOutScreen, options: RenderOptions = {}) {
    const { fb } = this;
    fb.clear(this.color(laid.bg));

    // background pass
    for (const widget of laid.widgets) this.drawBackground(widget);
    if (options.showGrid) this.drawGrid(options.grid ?? this.theme.metrics.grid);

    // content pass
    for (const widget of laid.widgets) {
      for (const text of widget.texts) this.drawText(text);
      for (const icon of widget.icons) this.drawIcon(icon);
    }
    return fb;
  }

  private drawGrid(grid: number) {
    if (grid < 2) return;
    const c = mix565(this.color('bg'), this.color('line'), 0.45);
    for (let x = 0; x < this.fb.width; x += grid) {
      for (let y = 0; y < this.fb.height; y += grid) this.fb.pixel(x, y, c);
    }
  }

  private drawBackground(widget: WidgetLayout) {
    const { fb } = this;
    const r = widget.rect;
    const bg = this.color(widget.bg);
    const border = widget.border ? this.color(widget.border) : null;
    const tone = this.color(widget.tone);

    switch (widget.type) {
      case 'header': {
        fb.rect(r.x, r.y, r.w, r.h, bg);
        fb.rect(r.x, r.y + r.h - 1, r.w, 1, border ?? this.color('line'));
        const strip = Math.max(2, Math.round(r.h / 15));
        fb.rect(r.x, r.y, r.w, strip, mix565(bg, tone, 0.8));
        fb.rect(r.x, r.y + r.h - 3, r.w, 2, mix565(bg, tone, 0.35));
        break;
      }
      case 'panel': {
        fb.fillRoundRect(r.x, r.y, r.w, r.h, widget.radius, bg);
        if (border) fb.strokeRoundRect(r.x, r.y, r.w, r.h, widget.radius, border, 1);
        break;
      }
      case 'button': {
        fb.fillRoundRect(r.x, r.y, r.w, r.h, widget.radius, bg);
        if (border) fb.strokeRoundRect(r.x, r.y, r.w, r.h, widget.radius, border, 1);
        if (widget.widget.variant === 'primary') {
          const hi = mix565(bg, this.color('white'), 0.28);
          fb.rect(r.x + widget.radius, r.y + 1, r.w - widget.radius * 2, 1, hi);
        }
        if (widget.widget.variant === 'danger') {
          fb.rect(r.x + 1, r.y + 7, 3, r.h - 14, tone);
        }
        break;
      }
      case 'progress': {
        fb.fillRoundRect(r.x, r.y, r.w, r.h, r.h / 2, this.color('surface3'));
        const segments = Math.max(1, Math.round(widget.extra.segments ?? 0));
        const filled = Math.round((widget.extra.filled ?? 0) * segments / 100);
        const gap = 2;
        const segW = (r.w - gap * (segments - 1)) / segments;
        for (let i = 0; i < segments; i++) {
          const x = r.x + i * (segW + gap);
          const color = i < filled ? tone : mix565(bg, this.color('surface3'), 0.6);
          fb.fillRoundRect(x, r.y + 1, segW, Math.max(1, r.h - 2), Math.min(2, r.h / 2), color);
        }
        break;
      }
      case 'statCard': {
        fb.fillRoundRect(r.x, r.y, r.w, r.h, widget.radius, bg);
        if (border) fb.strokeRoundRect(r.x, r.y, r.w, r.h, widget.radius, border, 1);
        fb.rect(r.x + 1, r.y + 1, 3, r.h - 2, mix565(bg, tone, 0.9));
        fb.rect(r.x + 4, r.y + 1, r.w - 5, 1, mix565(bg, tone, 0.4));
        break;
      }
      case 'resultBadge': {
        fb.fillRoundRect(r.x, r.y, r.w, r.h, widget.radius, bg);
        if (border) fb.strokeRoundRect(r.x, r.y, r.w, r.h, widget.radius, border, 2);
        break;
      }
      case 'heatmap': {
        fb.fillRoundRect(r.x, r.y, r.w, r.h, Math.min(4, widget.radius), bg);
        if (border) fb.strokeRoundRect(r.x, r.y, r.w, r.h, Math.min(4, widget.radius), border, 1);
        const cells = widget.extra.cells ?? [];
        const modeTone = widget.widget.mode === 'address' ? this.color('accent') : this.color('fail');
        for (const cell of cells) {
          const base = this.color('surface3');
          const color = cell.level === 0 ? base : mix565(base, modeTone, cell.level === 1 ? 0.4 : cell.level === 2 ? 0.7 : 1);
          fb.rect(cell.x, cell.y, cell.w, cell.h, color);
        }
        break;
      }
      case 'errorList': {
        fb.fillRoundRect(r.x, r.y, r.w, r.h, Math.min(4, widget.radius), bg);
        if (border) fb.strokeRoundRect(r.x, r.y, r.w, r.h, Math.min(4, widget.radius), border, 1);
        const rows = widget.widget.rows ?? 3;
        const rowH = r.h / rows;
        for (let i = 0; i < rows; i++) {
          const ry = Math.round(r.y + i * rowH);
          const rh = Math.round(r.y + (i + 1) * rowH) - ry;
          fb.rect(r.x + 1, ry + 1, r.w - 2, rh - 2, this.color('surface2'));
          fb.rect(r.x + 1, ry + 1, 2, rh - 2, this.color('fail'));
          if (i > 0) fb.rect(r.x + 1, ry, r.w - 2, 1, this.color('line'));
        }
        break;
      }
      case 'settingRow': {
        fb.fillRoundRect(r.x, r.y, r.w, r.h, widget.radius, bg);
        if (border) fb.strokeRoundRect(r.x, r.y, r.w, r.h, widget.radius, border, 1);
        fb.rect(r.x + 1, r.y + 6, 2, r.h - 12, mix565(bg, tone, 0.8));
        break;
      }
      case 'logo': {
        if (widget.widget.background) fb.rect(r.x, r.y, r.w, r.h, bg);
        break;
      }
      case 'divider': {
        fb.rect(r.x, r.y + Math.floor(r.h / 2), r.w, Math.max(1, r.h), bg);
        break;
      }
      default:
        break;
    }
  }

  private drawText(text: TextBox) {
    const font = this.font(text.font);
    const color = this.color(text.color);
    for (const line of text.lines) {
      if (!line.text) continue;
      this.fb.text(font, line.text, line.x, line.baseline, color);
    }
  }

  private drawIcon(icon: IconBox) {
    const prims = this.icons.icons[icon.icon];
    if (!prims) return;
    const color = this.color(icon.color);
    const box = icon.box;
    const scale = box.w / icon.viewBox;
    const stroke = Math.max(1, Math.round(scale * 1.15));
    const map = (x: number, y: number): [number, number] => [box.x + x * scale, box.y + y * scale];
    for (const prim of prims) {
      this.drawPrim(prim, map, scale, color, stroke);
    }
  }

  private drawPrim(
    prim: IconPrimitive,
    map: (x: number, y: number) => [number, number],
    scale: number,
    color: number,
    stroke: number
  ) {
    const { fb } = this;
    if (prim.type === 'line') {
      const [x0, y0] = map(prim.x1 ?? 0, prim.y1 ?? 0);
      const [x1, y1] = map(prim.x2 ?? 0, prim.y2 ?? 0);
      fb.line(x0, y0, x1, y1, color, stroke);
    } else if (prim.type === 'rect') {
      const [x0, y0] = map(prim.x ?? 0, prim.y ?? 0);
      const [x1, y1] = map((prim.x ?? 0) + (prim.w ?? 0), (prim.y ?? 0) + (prim.h ?? 0));
      const r = (prim.r ?? 0) * scale;
      if (prim.fill) fb.fillRoundRect(x0, y0, x1 - x0, y1 - y0, r, color);
      else fb.strokeRoundRect(x0, y0, x1 - x0, y1 - y0, r, color, stroke);
    } else if (prim.type === 'circle') {
      const [cx, cy] = map(prim.cx ?? 0, prim.cy ?? 0);
      const r = (prim.r ?? 0) * scale;
      if (prim.fill) fb.fillCircle(cx, cy, r, color);
      else fb.ring(cx, cy, r, color, stroke);
    } else if (prim.type === 'poly') {
      const points = (prim.points ?? []).map(([x, y]) => map(x, y));
      if (prim.fill) fb.fillPoly(points, color);
      if (!prim.fill || prim.closed) fb.strokePoly(points, color, stroke, prim.closed ?? false);
    }
  }
}

export function encodeRle565(fb: Framebuffer): Uint8Array {
  const out: number[] = [];
  const px = fb.pixels;
  let i = 0;
  while (i < px.length) {
    const value = px[i];
    let run = 1;
    while (i + run < px.length && px[i + run] === value && run < 255) run++;
    out.push(run, value & 255, value >> 8);
    i += run;
  }
  return new Uint8Array(out);
}
