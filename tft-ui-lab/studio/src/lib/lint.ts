import type {
  LayoutDoc,
  LayoutEngine,
  Scene,
  ScreenSpec,
  Theme,
  IconDoc,
  LayoutIssue,
  LaidOutScreen,
} from '@shared/lib/layout-engine';
import { boxesIntersect, contrastRatio } from '@shared/lib/layout-engine';

export interface LintIssue {
  id: string;
  code: string;
  severity: 'error' | 'warning';
  screen: string;
  scenario: string;
  widget?: string;
  message: string;
}

export interface ScenarioDoc {
  defaults: Record<string, string>;
  maxText: Record<string, string>;
  maxProgress?: number;
  maxTone?: Record<string, string>;
  maxErrors?: Array<Record<string, string>>;
  scenarios: Array<{
    id: string;
    label: string;
    screen: string;
    text?: Record<string, string>;
    tone?: Record<string, string>;
    progress?: number;
    bitErrors?: number[];
    addrErrors?: number[];
    errors?: Array<Record<string, string>>;
  }>;
}

const WIDGET_TYPES = new Set([
  'header', 'panel', 'text', 'icon', 'button', 'progress', 'statCard',
  'resultBadge', 'heatmap', 'errorList', 'settingRow', 'divider', 'logo',
]);

export function sceneFor(screenId: string, scenario: ScenarioDoc['scenarios'][number] | null, doc: ScenarioDoc, worstCase = false): Scene {
  return {
    screenId,
    values: {
      ...doc.defaults,
      ...(worstCase ? doc.maxText : {}),
      ...(scenario?.text ?? {}),
    },
    tones: { ...(worstCase ? doc.maxTone ?? {} : scenario?.tone ?? {}) },
    progress: worstCase ? doc.maxProgress ?? 0 : scenario?.progress ?? 0,
    bitErrors: scenario?.bitErrors ?? [],
    addrErrors: scenario?.addrErrors ?? [],
    errors: worstCase ? doc.maxErrors ?? [] : scenario?.errors ?? [],
    errorPage: 0,
  };
}

function issue(
  severity: 'error' | 'warning',
  code: string,
  screen: string,
  scenario: string,
  message: string,
  widget?: string
): LintIssue {
  return {
    id: `${severity}|${code}|${screen}|${scenario}|${widget ?? ''}|${message}`,
    code,
    severity,
    screen,
    scenario,
    widget,
    message,
  };
}

export function lintLayout(
  layout: LayoutDoc,
  engine: LayoutEngine,
  theme: Theme,
  icons: IconDoc,
  doc: ScenarioDoc
): LintIssue[] {
  const out: LintIssue[] = [];
  const colorKeys = new Set(Object.keys(theme.colors));
  const fontKeys = new Set(Object.keys(theme.fonts));
  const iconKeys = new Set(Object.keys(icons.icons));
  const screenIds = new Set(layout.screens.map((s) => s.id));

  for (const screen of layout.screens) {
    const screenScenario = 'layout';

    for (const widget of screen.widgets) {
      if (!WIDGET_TYPES.has(widget.type)) {
        out.push(issue('error', 'unknown-type', screen.id, screenScenario, `unknown widget type "${widget.type}"`, widget.id));
        continue;
      }
      if (widget.x < 0 || widget.y < 0 || widget.x + widget.w > layout.meta.display.width || widget.y + widget.h > layout.meta.display.height) {
        out.push(issue('error', 'out-of-bounds', screen.id, screenScenario, `${widget.type} at ${widget.x},${widget.y} leaves the display`, widget.id));
      }
      if (widget.w <= 0 || widget.h <= 0) {
        out.push(issue('error', 'empty-widget', screen.id, screenScenario, `${widget.type} has a non-positive size`, widget.id));
      }
      if (widget.font && !fontKeys.has(widget.font)) {
        out.push(issue('error', 'unknown-font', screen.id, screenScenario, `unknown font "${widget.font}"`, widget.id));
      }
      for (const key of ['color', 'tone', 'background'] as const) {
        const value = widget[key];
        if (value && !colorKeys.has(value)) {
          out.push(issue('error', 'unknown-color', screen.id, screenScenario, `unknown color "${value}"`, widget.id));
        }
      }
      if (widget.icon && !iconKeys.has(widget.icon)) {
        out.push(issue('error', 'unknown-icon', screen.id, screenScenario, `unknown icon "${widget.icon}"`, widget.id));
      }
      if (['button', 'settingRow', 'errorList'].includes(widget.type)) {
        if (widget.h < theme.metrics.touchMin) {
          out.push(issue('error', 'touch-height', screen.id, screenScenario, `${widget.type} is ${widget.h}px tall; minimum is ${theme.metrics.touchMin}px`, widget.id));
        }
        if (widget.w < 44) {
          out.push(issue('error', 'touch-width', screen.id, screenScenario, `${widget.type} is ${widget.w}px wide; minimum is 44px`, widget.id));
        }
      }
    }

    const targets = screen.widgets.filter((w) => ['button', 'settingRow', 'errorList'].includes(w.type));
    for (let i = 0; i < targets.length; i++) {
      for (let j = i + 1; j < targets.length; j++) {
        const a = targets[i];
        const b = targets[j];
        const ar = { x0: a.x, y0: a.y, x1: a.x + a.w, y1: a.y + a.h };
        const br = { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h };
        if (boxesIntersect(ar, br)) {
          out.push(issue('error', 'target-overlap', screen.id, screenScenario, `${a.id} overlaps touch target ${b.id}`, a.id));
        }
      }
    }
  }

  const check = (screen: ScreenSpec, scene: Scene, label: string) => {
    let laid: LaidOutScreen;
    try {
      laid = engine.layoutScreen(screen, scene);
    } catch (err) {
      out.push(issue('error', 'layout-crash', screen.id, label, String(err)));
      return;
    }
    for (const e of laid.issues) {
      out.push(
        issue(e.severity, e.code, screen.id, label, e.message, e.widget?.id)
      );
    }
    for (const text of laid.texts) {
      if (colorKeys.has(text.color) && colorKeys.has(text.bg)) {
        const ratio = contrastRatio(theme.colors[text.color], theme.colors[text.bg]);
        if (ratio < 3) {
          out.push(issue('error', 'contrast', screen.id, label, `${text.color} on ${text.bg} is ${ratio.toFixed(2)}:1 for "${text.text}"`, text.id));
        } else if (ratio < 4.5 && text.color !== 'dim') {
          out.push(issue('warning', 'contrast-aa', screen.id, label, `${text.color} on ${text.bg} is ${ratio.toFixed(2)}:1 for "${text.text}"`, text.id));
        }
      }
    }
    const content = [
      ...laid.widgets.flatMap((w) => w.texts.map((t) => ({ id: t.id, ink: t.ink, widget: w.id }))),
      ...laid.widgets.flatMap((w) => w.icons.map((i) => ({ id: i.id, ink: i.ink, widget: w.id }))),
    ];
    for (let i = 0; i < content.length; i++) {
      for (let j = i + 1; j < content.length; j++) {
        if (content[i].widget === content[j].widget) continue;
        if (boxesIntersect(content[i].ink, content[j].ink)) {
          out.push(issue('error', 'content-overlap', screen.id, label, `${content[i].id} overlaps ${content[j].id}`, content[i].widget));
        }
      }
    }
    for (const widget of laid.widgets) {
      for (const node of [...widget.texts, ...widget.icons]) {
        const { x0, y0, x1, y1 } = node.ink;
        const r = widget.rect;
        if (x0 < r.x - 0.01 || y0 < r.y - 0.01 || x1 > r.x + r.w + 0.01 || y1 > r.y + r.h + 0.01) {
          out.push(issue('error', 'content-clip', screen.id, label, `${node.id} ink leaves ${widget.id}`, widget.id));
        }
      }
      if (widget.type === 'button' && widget.extra?.content) {
        const content = widget.extra.content;
        const padL = content.x - widget.rect.x;
        const padR = widget.rect.x + widget.rect.w - (content.x + content.w);
        if (padL < 6 || padR < 6) {
          out.push(issue('error', 'button-padding', screen.id, label, `${widget.id} has ${padL.toFixed(1)}px/${padR.toFixed(1)}px side padding (min 6px)`, widget.id));
        }
      }
    }
  };

  for (const screen of layout.screens) {
    check(screen, sceneFor(screen.id, null, doc, false), 'default');
    check(screen, sceneFor(screen.id, null, doc, true), 'max');
  }
  for (const scenario of doc.scenarios) {
    const screen = layout.screens.find((s) => s.id === scenario.screen);
    if (!screen) {
      out.push(issue('error', 'scenario-screen', scenario.screen, scenario.id, `scenario "${scenario.id}" targets missing screen`, scenario.screen));
      continue;
    }
    check(screen, sceneFor(screen.id, scenario, doc, false), `scenario:${scenario.id}`);
  }

  return out;
}

export function issueCounts(issues: LintIssue[]) {
  let errors = 0;
  let warnings = 0;
  for (const i of issues) {
    if (i.severity === 'error') errors++;
    else warnings++;
  }
  return { errors, warnings };
}
