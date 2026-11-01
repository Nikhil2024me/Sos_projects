import { useEffect, useRef } from 'react';
import type { LayoutEngine, IconDoc, Theme, ScreenSpec } from '@shared/lib/layout-engine';
import { SceneRenderer } from '../lib/framebuffer';
import type { ScenarioDoc } from '../lib/lint';
import { sceneFor } from '../lib/lint';

interface Props {
  screen: ScreenSpec;
  theme: Theme;
  icons: IconDoc;
  engine: LayoutEngine;
  scenarios: ScenarioDoc;
  active: boolean;
  issues: number;
  onClick: () => void;
}

export default function ScreenThumb({ screen, theme, icons, engine, scenarios, active, issues, onClick }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const renderer = new SceneRenderer(theme, icons, engine);
    const laid = engine.layoutScreen(screen, sceneFor(screen.id, null, scenarios, false));
    renderer.draw(laid);
    ctx.putImageData(renderer.fb.toImageData(), 0, 0);
  }, [screen, theme, icons, engine, scenarios]);

  return (
    <button className={`screen-thumb${active ? ' active' : ''}`} onClick={onClick} title={screen.title}>
      <span className="thumb-canvas">
        <canvas ref={ref} width={320} height={240} />
      </span>
      <span className="thumb-meta">
        <span className="thumb-title">{screen.title}</span>
        <span className="thumb-id">{screen.id}</span>
      </span>
      {issues > 0 && <span className="thumb-badge">{issues}</span>}
    </button>
  );
}
