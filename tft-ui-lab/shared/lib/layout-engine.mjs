// Shared layout engine: the single source of geometry for the studio, the
// layout linter, and (by direct port) the firmware renderer.
//
// A "scene" is the resolved data for one screen: binding strings, tone keys,
// progress and error samples. The engine returns concrete text baselines,
// icon boxes, hit rects and issues. Nothing here draws pixels.

const DEFAULT_FONT = 'body';
const DEFAULT_COLOR = 'text';
const DEFAULT_TONE = 'accent';
const ICON_VIEWBOX = 24;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const n = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);

export function hexToRgb(hex) {
  const value = String(hex).replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

export function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function unionBox(a, b) {
  if (!a) return b;
  if (!b) return a;
  return {
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
  };
}

function boxFromRect(x, y, w, h) {
  return { x0: x, y0: y, x1: x + w, y1: y + h };
}

function intersects(a, b, pad = 0) {
  return (
    a.x0 < b.x1 + pad &&
    a.x1 > b.x0 - pad &&
    a.y0 < b.y1 + pad &&
    a.y1 > b.y0 - pad
  );
}

export function createLayoutEngine({ theme, icons, fonts }) {
  const aliases = theme.fonts;
  const fontMap = fonts.fonts ?? fonts;

  const resolveFont = (id) => {
    const key = aliases[id] ?? id;
    const font = fontMap[key];
    if (!font) throw new Error(`Unknown font "${id}"`);
    return { key, font };
  };

  const glyphMapCache = new Map();
  const glyphsFor = (fontKey) => {
    if (!glyphMapCache.has(fontKey)) {
      const map = new Map();
      for (const glyph of resolveFont(fontKey).font.glyphs) map.set(glyph.code, glyph);
      glyphMapCache.set(fontKey, map);
    }
    return glyphMapCache.get(fontKey);
  };

  const glyphFor = (fontId, code) => {
    const { key, font } = resolveFont(fontId);
    if (code < font.first || code > font.last) return null;
    return glyphsFor(key).get(code) ?? null;
  };

  const missingGlyphs = (fontId, text) => {
    const missing = new Set();
    for (const ch of String(text)) {
      const code = ch.codePointAt(0);
      if (code === 10 || code === 13) continue;
      if (!glyphFor(fontId, code)) missing.add(ch);
    }
    return [...missing];
  };

  const measureText = (fontId, text) => {
    let width = 0;
    for (const ch of String(text)) {
      const code = ch.codePointAt(0);
      if (code === 10 || code === 13) continue;
      const glyph = glyphFor(fontId, code);
      if (glyph) width += glyph.xAdvance;
    }
    return width;
  };

  const textInk = (fontId, text, x, baseline) => {
    let pen = x;
    let ink = null;
    for (const ch of String(text)) {
      const code = ch.codePointAt(0);
      if (code === 10 || code === 13) continue;
      const glyph = glyphFor(fontId, code);
      if (!glyph) continue;
      if (glyph.width > 0 && glyph.height > 0) {
        ink = unionBox(ink, {
          x0: pen + glyph.xOffset,
          y0: baseline + glyph.yOffset,
          x1: pen + glyph.xOffset + glyph.width,
          y1: baseline + glyph.yOffset + glyph.height,
        });
      }
      pen += glyph.xAdvance;
    }
    return ink;
  };

  const splitWords = (line) => line.split(/(\s+)/).filter((part) => part.length > 0);

  const wrapText = (fontId, text, maxWidth) => {
    const lines = [];
    const paragraphs = String(text).split(/\r?\n/);
    for (const paragraph of paragraphs) {
      if (paragraph.length === 0) {
        lines.push('');
        continue;
      }
      const words = splitWords(paragraph);
      let current = '';
      for (const part of words) {
        const isSpace = /^\s+$/.test(part);
        const candidate = current + part;
        if (current.trim().length === 0 && isSpace) continue;
        if (measureText(fontId, candidate) <= maxWidth || current.length === 0) {
          current = candidate;
        } else {
          lines.push(current.replace(/\s+$/, ''));
          current = isSpace ? '' : part;
        }
      }
      lines.push(current.replace(/\s+$/, ''));
    }
    return lines;
  };

  const textBlock = ({
    id,
    text,
    font = DEFAULT_FONT,
    color,
    bg,
    x,
    y,
    w,
    h,
    align = 'left',
    valign = 'middle',
    wrap = false,
    role = 'text',
  }) => {
    const { font: f } = resolveFont(font);
    const lines = wrap
      ? wrapText(font, text, w)
      : String(text).split(/\r?\n/);
    const lineHeight = f.yAdvance;
    const inkHeight = f.ascent + f.descent;
    const textHeight = lines.length === 0 ? 0 : inkHeight + (lines.length - 1) * lineHeight;
    const top =
      valign === 'top'
        ? y
        : valign === 'bottom'
          ? y + h - textHeight
          : y + (h - textHeight) / 2;
    let ink = null;
    const rendered = lines.map((line, index) => {
      const width = measureText(font, line);
      const left =
        align === 'center'
          ? x + (w - width) / 2
          : align === 'right'
            ? x + w - width
            : x;
      const baseline = top + f.ascent + index * lineHeight;
      ink = unionBox(ink, textInk(font, line, left, baseline));
      return { text: line, x: left, baseline, width };
    });
    return {
      kind: 'text',
      id,
      role,
      text: String(text),
      font,
      color,
      bg,
      box: { x, y, w, h },
      align,
      valign,
      wrap,
      lineHeight,
      textHeight,
      lines: rendered,
      ink: ink ?? boxFromRect(x, y, 0, 0),
    };
  };

  const iconBox = ({ id, icon, color, bg, x, y, size = 16, role = 'icon' }) => ({
    kind: 'icon',
    id,
    role,
    icon,
    color,
    bg,
    size,
    box: { x, y, w: size, h: size },
    ink: boxFromRect(x, y, size, size),
    viewBox: ICON_VIEWBOX,
  });

  const textKeyFor = (widget) =>
    widget.binding ?? widget.valueBinding ?? widget.statusBinding ?? null;
  const text2KeyFor = (widget) =>
    widget.binding2 ?? widget.detailBinding ?? widget.rightBinding ?? null;

  const resolveTone = (widget, tones) => {
    if (widget.toneBinding && tones[widget.toneBinding]) return tones[widget.toneBinding];
    return widget.tone ?? DEFAULT_TONE;
  };

  const toneBg = (tone) => {
    if (tone === 'pass') return 'passDim';
    if (tone === 'fail') return 'failDim';
    if (tone === 'warn') return 'warnDim';
    if (tone === 'accent') return 'accentDim';
    return 'surface2';
  };

  const buttonPaint = (variant) => {
    switch (variant) {
      case 'primary':
        return { bg: 'accent', border: 'accent', text: 'bg', icon: 'bg' };
      case 'danger':
        return { bg: 'failDim', border: 'fail', text: 'fail', icon: 'fail' };
      case 'secondary':
        return { bg: 'surface2', border: 'lineStrong', text: 'text', icon: 'accent' };
      case 'ghost':
        return { bg: 'surface', border: 'line', text: 'muted', icon: 'muted' };
      case 'outline':
        return { bg: 'bg', border: 'lineStrong', text: 'text', icon: 'accent' };
      default:
        return { bg: 'surface2', border: 'line', text: 'text', icon: 'accent' };
    }
  };

  const issuesForText = (textBox, widgetIssue) => {
    const issues = [];
    if (textBox.text.length === 0) return issues;
    const missing = missingGlyphs(textBox.font, textBox.text);
    if (missing.length) {
      issues.push({
        code: 'missing-glyph',
        severity: 'error',
        widget: widgetIssue,
        text: textBox.text,
        message: `Font "${textBox.font}" has no glyph for ${missing
          .map((c) => JSON.stringify(c))
          .join(', ')} in "${textBox.text}"`,
      });
    }
    if (textBox.textHeight > textBox.box.h + 0.5) {
      issues.push({
        code: 'text-height',
        severity: 'error',
        widget: widgetIssue,
        text: textBox.text,
        message: `text needs ${Math.ceil(textBox.textHeight)}px height in a ${textBox.box.h}px box: "${textBox.text}"`,
      });
    }
    for (const line of textBox.lines) {
      if (line.width > textBox.box.w + 0.5) {
        issues.push({
          code: textBox.wrap ? 'word-overflow' : 'text-width',
          severity: 'error',
          widget: widgetIssue,
          text: line.text,
          message: `line is ${Math.ceil(line.width)}px wide in a ${textBox.box.w}px box: "${line.text}"`,
        });
      }
    }
    return issues;
  };

  const overlapIssues = (items, widgetIssue, ownerId) => {
    const issues = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (intersects(items[i].ink, items[j].ink)) {
          issues.push({
            code: 'content-overlap',
            severity: 'error',
            widget: widgetIssue,
            message: `${items[i].id} overlaps ${items[j].id} inside ${ownerId}`,
          });
        }
      }
    }
    return issues;
  };

  const layoutWidget = (widget, scene, index) => {
    const { values = {}, tones = {}, progress = 0, errors = [] } = scene;
    const type = widget.type;
    const rect = { x: n(widget.x), y: n(widget.y), w: n(widget.w), h: n(widget.h) };
    const id = widget.id ?? `${type}.${index}`;
    const widgetIssue = { id, type, screen: scene.screenId };
    const texts = [];
    const icons = [];
    const issues = [];
    const flags = {
      wrap: widget.wrap === true,
      compact: widget.compact === true,
      back: widget.back === true,
    };
    const tone = resolveTone(widget, tones);
    const button = buttonPaint(widget.variant ?? 'secondary');
    const paint = {
      bg: widget.background ?? null,
      border: null,
      text: widget.color ?? DEFAULT_COLOR,
      icon: widget.color ?? tone,
      tone,
      radius: n(widget.radius, theme.metrics.radius),
    };
    const pushText = (spec) => {
      const box = textBlock(spec);
      texts.push(box);
      issues.push(...issuesForText(box, widgetIssue));
      return box;
    };
    const pushIcon = (spec) => {
      const box = iconBox({ ...spec, bg: spec.bg ?? paint.bg ?? 'bg' });
      icons.push(box);
      return box;
    };
    const extra = {};

    switch (type) {
      case 'header': {
        paint.bg = 'surface';
        paint.border = 'line';
        const backSize = 16;
        let cursor = rect.x + 8;
        if (flags.back) {
          const back = pushIcon({
            id: `${id}.back`,
            icon: 'back',
            color: paint.text,
            x: cursor,
            y: rect.y + (rect.h - backSize) / 2,
            size: backSize,
            role: 'back',
          });
          extra.back = back.box;
          cursor += backSize + 8;
        }
        const iconSize = widget.size ?? 16;
        if (widget.icon) {
          pushIcon({
            id: `${id}.icon`,
            icon: widget.icon,
            color: tone,
            x: cursor,
            y: rect.y + (rect.h - iconSize) / 2,
            size: iconSize,
          });
          cursor += iconSize + 8;
        }
        const rightKey = text2KeyFor(widget);
        const statusKey = widget.statusBinding ?? null;
        const rightText = rightKey
          ? String(values[rightKey] ?? '')
          : statusKey
            ? String(values[statusKey] ?? '')
            : widget.status
              ? String(widget.status)
              : '';
        const rightIsStatus = !rightKey && (statusKey !== null || widget.status !== undefined);
        let rightLeft = rect.x + rect.w - 8;
        if (rightText) {
          const width = measureText('micro', rightText);
          pushText({
            id: `${id}.right`,
            text: rightText,
            font: 'micro',
            color: rightKey ? paint.text : tone,
            bg: paint.bg,
            x: rect.x + rect.w - 8 - width,
            y: rect.y + 2,
            w: width,
            h: rect.h - 4,
            align: 'left',
            valign: 'middle',
          });
          rightLeft = rect.x + rect.w - 8 - width;
          if (rightIsStatus) {
            const dotSize = 6;
            const dot = pushIcon({
              id: `${id}.dot`,
              icon: 'dot',
              color: tone,
              x: rightLeft - 12,
              y: rect.y + (rect.h - dotSize) / 2,
              size: dotSize,
              role: 'status-dot',
            });
            rightLeft = dot.box.x;
          }
        }
        if (widget.title) {
          pushText({
            id: `${id}.title`,
            text: widget.title,
            font: 'title',
            color: paint.text,
            bg: paint.bg,
            x: cursor,
            y: rect.y + 2,
            w: Math.max(0, rightLeft - 8 - cursor),
            h: rect.h - 4,
            align: 'left',
            valign: 'middle',
          });
        }
        extra.divider = { x: rect.x, y: rect.y + rect.h - 1, w: rect.w, h: 1 };
        break;
      }
      case 'panel': {
        const style = widget.style ?? 'card';
        paint.bg = style === 'flat' ? 'surface' : 'surface2';
        paint.border = style === 'flat' ? 'line' : 'lineStrong';
        paint.radius = n(widget.radius, style === 'flat' ? theme.metrics.radiusSmall : theme.metrics.radius);
        break;
      }
      case 'button': {
        paint.bg = button.bg;
        paint.border = button.border;
        paint.text = button.text;
        paint.icon = button.icon;
        paint.radius = n(widget.radius, theme.metrics.radius);
        const font = widget.font ?? 'label';
        const label = widget.label ?? '';
        const iconSize = widget.size ?? 16;
        const gap = 6;
        const labelWidth = measureText(font, label);
        const contentWidth = labelWidth + (widget.icon ? iconSize + gap : 0);
        const start = rect.x + (rect.w - contentWidth) / 2;
        if (widget.icon) {
          pushIcon({
            id: `${id}.icon`,
            icon: widget.icon,
            color: paint.icon,
            x: start,
            y: rect.y + (rect.h - iconSize) / 2,
            size: iconSize,
          });
        }
        pushText({
          id: `${id}.label`,
          text: label,
          font,
          color: paint.text,
          bg: paint.bg,
          x: start + (widget.icon ? iconSize + gap : 0),
          y: rect.y + 1,
          w: labelWidth,
          h: rect.h - 2,
          align: 'left',
          valign: 'middle',
          role: 'label',
        });
        extra.content = { x: start, w: contentWidth };
        extra.padding = 8;
        break;
      }
      case 'text': {
        const key = textKeyFor(widget);
        const text = key ? String(values[key] ?? '') : String(widget.text ?? '');
        const font = widget.font ?? 'body';
        pushText({
          id,
          text,
          font,
          color: paint.text,
          bg: paint.bg ?? 'bg',
          x: rect.x,
          y: rect.y,
          w: rect.w,
          h: rect.h,
          align: widget.align ?? 'left',
          valign: widget.valign ?? 'top',
          wrap: flags.wrap,
          role: key ? 'binding' : 'static',
        });
        break;
      }
      case 'icon': {
        const size = n(widget.size, Math.min(rect.w, rect.h, 24));
        pushIcon({
          id,
          icon: widget.icon ?? 'chip',
          color: paint.icon,
          x: rect.x + (rect.w - size) / 2,
          y: rect.y + (rect.h - size) / 2,
          size,
        });
        break;
      }
      case 'progress': {
        paint.bg = widget.background ?? 'surface3';
        paint.icon = tone;
        const segments = n(widget.segments);
        extra.track = { ...rect, radius: rect.h / 2 };
        extra.segments = segments > 0 ? segments : 0;
        extra.filled = clamp(n(progress), 0, 100);
        break;
      }
      case 'statCard': {
        paint.bg = 'surface2';
        paint.border = 'line';
        paint.radius = n(widget.radius, theme.metrics.radiusSmall);
        paint.text = paint.text === DEFAULT_COLOR ? 'text' : paint.text;
        const compact = flags.compact;
        const pad = compact ? 6 : 8;
        const iconSize = widget.size ?? (compact ? 16 : 18);
        if (widget.icon) {
          pushIcon({
            id: `${id}.icon`,
            icon: widget.icon,
            color: tone,
            x: rect.x + rect.w - pad - iconSize,
            y: rect.y + (compact ? 2 : 4),
            size: iconSize,
          });
        }
        pushText({
          id: `${id}.label`,
          text: widget.label ?? '',
          font: compact ? 'micro' : 'label',
          color: 'muted',
          bg: paint.bg,
          x: rect.x + pad,
          y: rect.y + (compact ? 2 : 4),
          w: Math.max(0, rect.w - pad * 2 - (widget.icon ? iconSize + 6 : 0)),
          h: compact ? 15 : 18,
          align: 'left',
          valign: 'top',
          role: 'label',
        });
        const key = textKeyFor(widget);
        const value = key ? String(values[key] ?? '') : String(widget.value ?? '');
        const valueFont = widget.font ?? 'title';
        pushText({
          id: `${id}.value`,
          text: value,
          font: valueFont,
          color: tone,
          bg: paint.bg,
          x: rect.x + pad,
          y: rect.y + (compact ? 19 : 22),
          w: Math.max(0, rect.w - pad * 2),
          h: 23,
          align: 'left',
          valign: 'middle',
          role: 'binding',
        });
        const subtext = widget.subtext ?? widget.unit ?? null;
        if (subtext && !compact) {
          const sub = pushText({
            id: `${id}.subtext`,
            text: String(subtext),
            font: 'micro',
            color: 'dim',
            bg: paint.bg,
            x: rect.x + pad,
            y: rect.y + rect.h - 16,
            w: Math.max(0, rect.w - pad * 2),
            h: 15,
            align: 'left',
            valign: 'top',
            role: 'subtext',
          });
          extra.subtext = sub.box;
        }
        break;
      }
      case 'resultBadge': {
        paint.bg = toneBg(tone);
        paint.border = tone;
        paint.radius = n(widget.radius, theme.metrics.radius);
        const key = textKeyFor(widget);
        const value = key ? String(values[key] ?? '') : String(widget.value ?? '');
        if (flags.compact) {
          pushText({
            id: `${id}.value`,
            text: value,
            font: 'label',
            color: tone,
            bg: paint.bg,
            x: rect.x,
            y: rect.y + 1,
            w: rect.w,
            h: rect.h - 2,
            align: 'center',
            valign: 'middle',
            role: 'binding',
          });
        } else {
          pushText({
            id: `${id}.value`,
            text: value,
            font: 'value',
            color: tone,
            bg: paint.bg,
            x: rect.x + 4,
            y: rect.y + 2,
            w: rect.w - 8,
            h: 34,
            align: 'center',
            valign: 'middle',
            role: 'binding',
          });
          const detailKey = text2KeyFor(widget);
          if (detailKey) {
            pushText({
              id: `${id}.detail`,
              text: String(values[detailKey] ?? ''),
              font: 'micro',
              color: 'muted',
              bg: paint.bg,
              x: rect.x + 4,
              y: rect.y + rect.h - 24,
              w: rect.w - 8,
              h: 16,
              align: 'center',
              valign: 'middle',
              role: 'binding',
            });
          }
        }
        break;
      }
      case 'heatmap': {
        paint.bg = 'surface';
        paint.border = 'line';
        const cols = n(widget.cols, 32);
        const rows = n(widget.rows, 1);
        const gap = 2;
        const cellW = (rect.w - gap * (cols - 1)) / cols;
        const cellH = (rect.h - gap * (rows - 1)) / rows;
        const source = widget.mode === 'address' ? scene.addrErrors ?? [] : scene.bitErrors ?? [];
        const cells = [];
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const value = n(source[row * cols + col], 0);
            cells.push({
              col,
              row,
              x: rect.x + col * (cellW + gap),
              y: rect.y + row * (cellH + gap),
              w: cellW,
              h: cellH,
              value,
              level: value === 0 ? 0 : value < 3 ? 1 : value < 10 ? 2 : 3,
            });
          }
        }
        extra.cells = cells;
        break;
      }
      case 'errorList': {
        paint.bg = 'surface';
        paint.border = 'line';
        const rows = n(widget.rows, 3);
        const rowH = rect.h / rows;
        extra.rows = [];
        const visible = [];
        const start = n(scene.errorPage, 0) * rows;
        for (let i = 0; i < rows; i++) {
          const item = errors[start + i];
          const rowRect = { x: rect.x, y: rect.y + i * rowH, w: rect.w, h: rowH };
          if (i > 0) {
            extra.rows.push({ ...rowRect, divider: true });
          }
          if (!item) continue;
          visible.push(item);
          extra.rows.push({ ...rowRect, divider: i > 0 });
          const rowId = `${id}.row${i}`;
          if (widget.rows && rowH < 40) {
            issues.push({
              code: 'row-height',
              severity: 'warning',
              widget: widgetIssue,
              message: `error row is only ${rowH.toFixed(1)}px tall`,
            });
          }
          pushText({
            id: `${rowId}.address`,
            text: item.address ?? '',
            font: 'mono',
            color: 'text',
            bg: 'surface2',
            x: rect.x + 10,
            y: rowRect.y + 4,
            w: measureText('mono', item.address ?? ''),
            h: 17,
            align: 'left',
            valign: 'top',
            role: 'binding',
          });
          const op = [item.operation, item.bits].filter(Boolean).join(' | ');
          pushText({
            id: `${rowId}.operation`,
            text: op,
            font: 'micro',
            color: tone,
            bg: 'surface2',
            x: rect.x + rect.w - 8 - measureText('micro', op),
            y: rowRect.y + 5,
            w: measureText('micro', op),
            h: 15,
            align: 'left',
            valign: 'top',
            role: 'binding',
          });
          const strip0x = (value) => String(value ?? '').replace(/^0x/i, '');
          const exp = `EXP ${strip0x(item.expected)}`;
          const act = `ACT ${strip0x(item.actual)}`;
          pushText({
            id: `${rowId}.expected`,
            text: exp,
            font: 'micro',
            color: 'muted',
            bg: 'surface2',
            x: rect.x + 10,
            y: rowRect.y + 23,
            w: measureText('micro', exp),
            h: 15,
            align: 'left',
            valign: 'top',
            role: 'binding',
          });
          pushText({
            id: `${rowId}.actual`,
            text: act,
            font: 'micro',
            color: 'muted',
            bg: 'surface2',
            x: rect.x + rect.w - 8 - measureText('micro', act),
            y: rowRect.y + 23,
            w: measureText('micro', act),
            h: 15,
            align: 'left',
            valign: 'top',
            role: 'binding',
          });
        }
        if (visible.length === 0) {
          pushText({
            id: `${id}.empty`,
            text: widget.emptyText ?? 'NO ERRORS',
            font: 'micro',
            color: 'dim',
            bg: paint.bg,
            x: rect.x,
            y: rect.y,
            w: rect.w,
            h: rect.h,
            align: 'center',
            valign: 'middle',
          });
        }
        break;
      }
      case 'settingRow': {
        paint.bg = 'surface2';
        paint.border = 'line';
        paint.radius = n(widget.radius, theme.metrics.radiusSmall);
        const iconSize = widget.size ?? 16;
        if (widget.icon) {
          pushIcon({
            id: `${id}.icon`,
            icon: widget.icon,
            color: tone,
            x: rect.x + 10,
            y: rect.y + (rect.h - iconSize) / 2,
            size: iconSize,
          });
        }
        const key = textKeyFor(widget);
        const value = key ? String(values[key] ?? '') : String(widget.value ?? '');
        const valueWidth = measureText('mono', value);
        pushText({
          id: `${id}.label`,
          text: widget.label ?? '',
          font: 'label',
          color: 'muted',
          bg: paint.bg,
          x: rect.x + 34,
          y: rect.y + 2,
          w: Math.max(0, rect.w - 34 - valueWidth - 18),
          h: rect.h - 4,
          align: 'left',
          valign: 'middle',
          role: 'label',
        });
        pushText({
          id: `${id}.value`,
          text: value,
          font: 'mono',
          color: paint.text,
          bg: paint.bg,
          x: rect.x + rect.w - 10 - valueWidth,
          y: rect.y + 2,
          w: valueWidth,
          h: rect.h - 4,
          align: 'left',
          valign: 'middle',
          role: 'binding',
        });
        extra.chevron = { x: rect.x + rect.w - 8, y: rect.y + rect.h / 2 };
        break;
      }
      case 'logo': {
        paint.bg = widget.background ?? 'bg';
        const small = rect.w < 150;
        const iconSize = small ? 30 : 40;
        if (widget.icon) {
          pushIcon({
            id: `${id}.icon`,
            icon: widget.icon,
            color: tone,
            x: rect.x + (rect.w - iconSize) / 2,
            y: rect.y + (small ? 2 : 2),
            size: iconSize,
          });
        }
        pushText({
          id: `${id}.title`,
          text: widget.title ?? '',
          font: small ? 'label' : 'hero',
          color: paint.text,
          bg: paint.bg,
          x: rect.x,
          y: rect.y + (small ? 38 : 46),
          w: rect.w,
          h: small ? 18 : 48,
          align: 'center',
          valign: 'middle',
        });
        if (widget.subtitle) {
          pushText({
            id: `${id}.subtitle`,
            text: widget.subtitle,
            font: 'micro',
            color: 'muted',
            bg: paint.bg,
            x: rect.x,
            y: rect.y + (small ? 60 : 94),
            w: rect.w,
            h: 16,
            align: 'center',
            valign: 'middle',
          });
        }
        break;
      }
      case 'divider': {
        paint.bg = 'line';
        extra.line = { ...rect };
        break;
      }
      default:
        issues.push({
          code: 'unknown-widget',
          severity: 'error',
          widget: widgetIssue,
          message: `unknown widget type "${type}"`,
        });
    }

    issues.push(...overlapIssues([...texts, ...icons], widgetIssue, id));

    return {
      id,
      type,
      rect,
      tone,
      color: paint.text,
      iconColor: paint.icon,
      bg: paint.bg ?? 'bg',
      border: paint.border,
      radius: paint.radius,
      flags,
      widget,
      texts,
      icons,
      extra,
      interactive: type === 'button' || type === 'settingRow' || type === 'errorList',
      issues,
    };
  };

  const layoutScreen = (screen, scene = {}) => {
    const merged = { screenId: screen.id, ...scene };
    const widgets = screen.widgets.map((widget, index) => layoutWidget(widget, merged, index));
    const texts = widgets.flatMap((w) => w.texts);
    const icons = widgets.flatMap((w) => w.icons);
    return {
      screenId: screen.id,
      title: screen.title,
      bg: screen.background ?? 'bg',
      width: theme.display?.width ?? 320,
      height: theme.display?.height ?? 240,
      widgets,
      texts,
      icons,
      issues: widgets.flatMap((w) => w.issues),
    };
  };

  return {
    theme,
    icons,
    fonts: fontMap,
    measureText,
    missingGlyphs,
    wrapText,
    textBlock,
    layoutScreen,
    resolveFont,
  };
}

export { intersects as boxesIntersect, boxFromRect };
