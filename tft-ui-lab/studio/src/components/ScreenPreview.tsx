import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { LaidOutScreen, LayoutEngine, IconDoc, Theme, WidgetSpec } from '@shared/lib/layout-engine';
import { SceneRenderer } from '../lib/framebuffer';

interface Props {
  laid: LaidOutScreen;
  theme: Theme;
  icons: IconDoc;
  engine: LayoutEngine;
  selectedId: string | null;
  mode: 'edit' | 'touch';
  zoom: number;
  showGrid: boolean;
  showBoxes: boolean;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  onTap: (x: number, y: number) => void;
}

const W = 320;
const H = 240;

export default function ScreenPreview({
  laid,
  theme,
  icons,
  engine,
  selectedId,
  mode,
  zoom,
  showGrid,
  showBoxes,
  onSelect,
  onMove,
  onResize,
  onTap,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const renderer = new SceneRenderer(theme, icons, engine);
    renderer.draw(laid, { showGrid });
    ctx.putImageData(renderer.fb.toImageData(), 0, 0);
  }, [laid, theme, icons, engine, showGrid]);

  const point = (event: ReactPointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H,
    };
  };

  const topWidgetAt = (x: number, y: number): WidgetSpec | null => {
    for (let i = laid.widgets.length - 1; i >= 0; i--) {
      const w = laid.widgets[i].widget;
      if (x >= w.x && y >= w.y && x <= w.x + w.w && y <= w.y + w.h) return w;
    }
    return null;
  };

  const onPointerDown = (event: ReactPointerEvent) => {
    event.preventDefault();
    const p = point(event);
    if (mode === 'touch') {
      setRipple({ ...p, key: Date.now() });
      onTap(Math.round(p.x), Math.round(p.y));
      return;
    }
    const selected = laid.widgets.find((w) => w.id === selectedId)?.widget ?? null;
    if (selected) {
      const hx = selected.x + selected.w;
      const hy = selected.y + selected.h;
      if (Math.abs(p.x - hx) < 14 && Math.abs(p.y - hy) < 14) {
        const start = { x: p.x, y: p.y, w: selected.w, h: selected.h };
        const move = (ev: PointerEvent) => {
          const canvas = canvasRef.current!;
          const rect = canvas.getBoundingClientRect();
          const x = ((ev.clientX - rect.left) / rect.width) * W;
          const y = ((ev.clientY - rect.top) / rect.height) * H;
          const w = Math.max(12, Math.round(start.w + x - start.x));
          const h = Math.max(8, Math.round(start.h + y - start.y));
          onResize(selected.id, Math.min(W - selected.x, w), Math.min(H - selected.y, h));
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        return;
      }
    }
    const hit = topWidgetAt(p.x, p.y);
    onSelect(hit?.id ?? null);
    if (!hit) return;
    const start = { x: p.x, y: p.y, wx: hit.x, wy: hit.y };
    const move = (ev: PointerEvent) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * W;
      const y = ((ev.clientY - rect.top) / rect.height) * H;
      const nx = Math.round(Math.max(0, Math.min(W - hit.w, start.wx + x - start.x)));
      const ny = Math.round(Math.max(0, Math.min(H - hit.h, start.wy + y - start.y)));
      onMove(hit.id, nx, ny);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const selected = laid.widgets.find((w) => w.id === selectedId);

  return (
    <div
      className="device-frame"
      ref={wrapRef}
      style={{ width: `min(100%, ${W * zoom}px)` }}
      data-testid="device-frame"
    >
      <div className="device-screen" style={{ aspectRatio: `${W} / ${H}` }}>
        <canvas ref={canvasRef} width={W} height={H} onPointerDown={onPointerDown} />
        <svg className="preview-overlay" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {showBoxes &&
            laid.widgets.map((w) => (
              <g key={w.id}>
                <rect
                  x={w.rect.x + 0.5}
                  y={w.rect.y + 0.5}
                  width={Math.max(0, w.rect.w - 1)}
                  height={Math.max(0, w.rect.h - 1)}
                  className={w.id === selectedId ? 'widget-box selected' : 'widget-box'}
                />
                {w.texts.map((t) => (
                  <rect
                    key={t.id}
                    x={t.ink.x0}
                    y={t.ink.y0}
                    width={Math.max(0.5, t.ink.x1 - t.ink.x0)}
                    height={Math.max(0.5, t.ink.y1 - t.ink.y0)}
                    className="ink-box text"
                  />
                ))}
                {w.icons.map((i) => (
                  <rect
                    key={i.id}
                    x={i.ink.x0}
                    y={i.ink.y0}
                    width={Math.max(0.5, i.ink.x1 - i.ink.x0)}
                    height={Math.max(0.5, i.ink.y1 - i.ink.y0)}
                    className={i.role === 'back' ? 'ink-box back' : 'ink-box icon'}
                  />
                ))}
              </g>
            ))}
          {selected && (
            <g className="selection">
              <rect x={selected.rect.x} y={selected.rect.y} width={selected.rect.w} height={selected.rect.h} />
              <rect
                x={selected.rect.x + selected.rect.w - 5}
                y={selected.rect.y + selected.rect.h - 5}
                width={10}
                height={10}
                className="resize-handle"
              />
              <text x={selected.rect.x + 3} y={Math.max(9, selected.rect.y - 4)} className="selection-label">
                {selected.id}
              </text>
            </g>
          )}
          {ripple && (
            <circle key={ripple.key} cx={ripple.x} cy={ripple.y} r={2} className="tap-ripple" />
          )}
        </svg>
      </div>
      <div className="device-meta">
        <span>ILI9341 / 320x240</span>
        <span>RGB565 / LANDSCAPE</span>
        <span>{mode === 'touch' ? 'TOUCH INJECT' : 'EDIT MODE'}</span>
      </div>
    </div>
  );
}
