#!/usr/bin/env node
// Pixel-level layout linter. Uses the same geometry engine as the studio and
// the firmware geometry contract. Exit code 1 means the UI must not ship.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFonts } from './lib/fonts.mjs';
import { createLayoutEngine, contrastRatio, boxesIntersect } from '../shared/lib/layout-engine.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const theme = readJson('shared/theme.json');
const icons = readJson('shared/icons.json');
const layout = readJson('shared/layout.json');
const scenarios = readJson('shared/scenarios.json');
const fonts = loadFonts(path.join(ROOT, 'shared/fonts'));
const engine = createLayoutEngine({ theme, icons, fonts });

const issues = [];
const seen = new Set();

function add(severity, code, message, where = {}) {
  const key = `${severity}|${code}|${where.screen ?? ''}|${where.widget ?? ''}|${message}`;
  if (seen.has(key)) return;
  seen.add(key);
  issues.push({ severity, code, message, ...where });
}

const WIDGET_TYPES = new Set([
  'header', 'panel', 'text', 'icon', 'button', 'progress', 'statCard',
  'resultBadge', 'heatmap', 'errorList', 'settingRow', 'divider', 'logo',
]);
const colorKeys = new Set(Object.keys(theme.colors));
const fontKeys = new Set(Object.keys(theme.fonts));
const iconKeys = new Set(Object.keys(icons.icons));
const actionKeys = new Set(layout.screens.flatMap((s) => s.widgets.map((w) => w.action).filter(Boolean)));
const screenIds = new Set();

// ---------- display invariants ----------
const W = theme.display?.width ?? layout.meta.display.width;
const H = theme.display?.height ?? layout.meta.display.height;
if (layout.meta.display.width !== W || layout.meta.display.height !== H) {
  add('error', 'display-mismatch', `layout.json meta display ${layout.meta.display.width}x${layout.meta.display.height} does not match theme ${W}x${H}`);
}

// ---------- structural ----------
for (const screen of layout.screens) {
  if (!screen.id || screenIds.has(screen.id)) {
    add('error', 'duplicate-screen', `duplicate screen id "${screen.id}"`, { screen: screen.id });
  }
  screenIds.add(screen.id);
  if (!colorKeys.has(screen.background ?? 'bg')) {
    add('error', 'unknown-color', `screen background "${screen.background}" is not in theme`, { screen: screen.id });
  }
  const widgetIds = new Set();
  for (const w of screen.widgets) {
    const where = { screen: screen.id, widget: w.id };
    if (!w.id || widgetIds.has(w.id)) {
      add('error', 'duplicate-widget', `duplicate widget id "${w.id}"`, where);
    }
    widgetIds.add(w.id);
    if (!WIDGET_TYPES.has(w.type)) {
      add('error', 'unknown-type', `unknown widget type "${w.type}"`, where);
      continue;
    }
    for (const field of ['x', 'y', 'w', 'h']) {
      if (!Number.isFinite(w[field])) add('error', 'bad-number', `${field} must be a number`, where);
    }
    if (w.x < 0 || w.y < 0 || w.x + w.w > W || w.y + w.h > H) {
      add('error', 'out-of-bounds', `${w.type} at ${w.x},${w.y} ${w.w}x${w.h} leaves the ${W}x${H} display`, where);
    }
    if (w.w <= 0 || w.h <= 0) {
      add('error', 'empty-widget', `${w.type} has a non-positive size`, where);
    }
    for (const field of ['font', 'color', 'tone', 'background']) {
      if (w[field] && field === 'font' && !fontKeys.has(w[field])) {
        add('error', 'unknown-font', `unknown font "${w[field]}"`, where);
      }
      if ((field === 'color' || field === 'tone' || field === 'background') && w[field] && !colorKeys.has(w[field])) {
        add('error', 'unknown-color', `unknown color "${w[field]}"`, where);
      }
    }
    if (w.icon && !iconKeys.has(w.icon)) {
      add('error', 'unknown-icon', `unknown icon "${w.icon}"`, where);
    }
    if (w.action && !actionKeys.has(w.action)) {
      add('error', 'unknown-action', `unknown action "${w.action}"`, where);
    }
    if (w.mode && !['bit', 'address', 'scan'].includes(w.mode)) {
      add('error', 'unknown-mode', `unknown heatmap mode "${w.mode}"`, where);
    }
    if (w.align && !['left', 'center', 'right'].includes(w.align)) {
      add('error', 'unknown-align', `unknown align "${w.align}"`, where);
    }
    if (w.valign && !['top', 'middle', 'bottom'].includes(w.valign)) {
      add('error', 'unknown-valign', `unknown valign "${w.valign}"`, where);
    }
    if (['button', 'settingRow', 'errorList'].includes(w.type)) {
      if (w.h < theme.metrics.touchMin) {
        add('error', 'touch-height', `${w.type} is ${w.h}px tall; minimum is ${theme.metrics.touchMin}px`, where);
      }
      if (w.w < 44) {
        add('error', 'touch-width', `${w.type} is ${w.w}px wide; minimum is 44px`, where);
      }
    }
    if (w.type === 'button' && w.variant === 'primary' && w.h < theme.metrics.touchPrimary) {
      add('warning', 'touch-primary', `primary button is ${w.h}px tall; recommended ${theme.metrics.touchPrimary}px`, where);
    }
    if (w.type === 'header' && w.back) {
      const hit = { x0: w.x + 2, y0: w.y + 2, x1: w.x + 32, y1: w.y + w.h - 2 };
      const target = { x0: w.x + 8, y0: w.y + (w.h - 16) / 2, x1: w.x + 24, y1: w.y + (w.h + 16) / 2 };
      if (!(hit.x0 <= target.x0 && hit.y0 <= target.y0 && hit.x1 >= target.x1 && hit.y1 >= target.y1)) {
        add('error', 'back-hit', 'header back hit area does not cover the arrow', where);
      }
    }
  }

  // interactive targets must not collide, and need separation
  const targets = screen.widgets.filter((w) => ['button', 'settingRow', 'errorList'].includes(w.type));
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      const a = targets[i];
      const b = targets[j];
      const ar = { x0: a.x, y0: a.y, x1: a.x + a.w, y1: a.y + a.h };
      const br = { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h };
      if (boxesIntersect(ar, br)) {
        add('error', 'target-overlap', `${a.id} overlaps touch target ${b.id}`, { screen: screen.id, widget: a.id });
        continue;
      }
      const gapX = Math.max(br.x0 - ar.x1, ar.x0 - br.x1);
      const gapY = Math.max(br.y0 - ar.y1, ar.y0 - br.y1);
      const gap = Math.max(gapX, gapY);
      if (gap < 4) {
        add('warning', 'target-spacing', `${a.id} and ${b.id} are only ${gap.toFixed(0)}px apart`, { screen: screen.id, widget: a.id });
      }
    }
  }
}

// ---------- scenario data ----------
const defaults = scenarios.defaults ?? {};
const maxText = scenarios.maxText ?? {};
const maxTone = scenarios.maxTone ?? {};
const maxErrors = scenarios.maxErrors ?? [];
const maxProgress = scenarios.maxProgress ?? 0;
const bindingNames = new Set();
for (const screen of layout.screens) {
  for (const w of screen.widgets) {
    for (const field of ['binding', 'binding2', 'valueBinding', 'detailBinding', 'statusBinding', 'rightBinding']) {
      if (w[field]) bindingNames.add(w[field]);
    }
  }
}
for (const name of bindingNames) {
  if (!(name in defaults)) add('error', 'missing-default', `binding "${name}" has no value in scenarios.defaults`);
  if (!(name in maxText)) add('error', 'missing-max', `binding "${name}" has no max-length probe in scenarios.maxText`);
}
for (const [name, value] of Object.entries(defaults)) {
  if (!bindingNames.has(name)) add('warning', 'unused-default', `scenario default "${name}" is not used by any widget`);
  if (engine.missingGlyphs('body', String(value)).length) {
    add('error', 'missing-glyph', `default "${name}" contains unsupported characters: ${engine.missingGlyphs('body', String(value)).join(' ')}`);
  }
}
for (const [name, value] of Object.entries(maxText)) {
  if (!bindingNames.has(name)) add('warning', 'unused-max', `maxText "${name}" is not used by any widget`);
}
for (const [key, value] of Object.entries(maxTone)) {
  if (!colorKeys.has(value)) add('error', 'scenario-tone', `maxTone "${key}" uses unknown color "${value}"`);
}
if (maxProgress < 0 || maxProgress > 100) add('error', 'scenario-progress', `maxProgress ${maxProgress} is outside 0..100`);
for (const err of maxErrors) {
  for (const field of ['address', 'expected', 'actual', 'bits', 'operation']) {
    if (typeof err[field] !== 'string') add('error', 'scenario-error', `maxErrors entry is missing "${field}"`);
  }
}
const toneKeys = new Set(Object.keys(scenarios.defaults ?? {}).length ? [] : []);
for (const sc of scenarios.scenarios) {
  if (!screenIds.has(sc.screen)) {
    add('error', 'scenario-screen', `scenario "${sc.id}" targets missing screen "${sc.screen}"`, { screen: sc.screen });
  }
  for (const [key, value] of Object.entries(sc.text ?? {})) {
    if (!bindingNames.has(key)) add('error', 'scenario-binding', `scenario "${sc.id}" sets unknown binding "${key}"`, { screen: sc.screen });
    if (engine.missingGlyphs('body', String(value)).length) {
      add('error', 'missing-glyph', `scenario "${sc.id}" value "${key}" has unsupported characters`, { screen: sc.screen });
    }
  }
  for (const [key, value] of Object.entries(sc.tone ?? {})) {
    if (!colorKeys.has(value)) add('error', 'scenario-tone', `scenario "${sc.id}" sets tone "${key}" to unknown color "${value}"`, { screen: sc.screen });
  }
  for (const err of sc.errors ?? []) {
    for (const field of ['address', 'expected', 'actual', 'bits', 'operation']) {
      if (typeof err[field] !== 'string') {
        add('error', 'scenario-error', `scenario "${sc.id}" error is missing "${field}"`, { screen: sc.screen });
      }
    }
  }
}

// ---------- geometry, overflow, overlap, contrast ----------
function sceneFor(screenId, overrides = {}) {
  return {
    screenId,
    values: { ...defaults, ...(overrides.text ?? {}) },
    tones: { ...(overrides.tone ?? {}) },
    progress: overrides.progress ?? 0,
    errors: overrides.errors ?? [],
    bitErrors: overrides.bitErrors ?? [],
    addrErrors: overrides.addrErrors ?? [],
    errorPage: overrides.errorPage ?? 0,
  };
}

function checkScene(scene, label) {
  const screen = layout.screens.find((s) => s.id === scene.screenId);
  if (!screen) return null;
  const laid = engine.layoutScreen(screen, scene);
  for (const issue of laid.issues) {
    add(issue.severity, issue.code, `${label}: ${issue.message}`, { screen: screen.id, widget: issue.widget?.id });
  }
  for (const text of laid.texts) {
    if (!colorKeys.has(text.color)) add('error', 'unknown-color', `text color "${text.color}" is not in theme`, { screen: screen.id, widget: text.id });
    if (!colorKeys.has(text.bg)) add('error', 'unknown-color', `text background "${text.bg}" is not in theme`, { screen: screen.id, widget: text.id });
    if (colorKeys.has(text.color) && colorKeys.has(text.bg)) {
      const ratio = contrastRatio(theme.colors[text.color], theme.colors[text.bg]);
      if (ratio < 3.0) {
        add('error', 'contrast', `${text.color} on ${text.bg} is ${ratio.toFixed(2)}:1 for "${text.text}"`, { screen: screen.id, widget: text.id });
      } else if (ratio < 4.5 && text.color !== 'dim') {
        add('warning', 'contrast-aa', `${text.color} on ${text.bg} is ${ratio.toFixed(2)}:1 for "${text.text}"`, { screen: screen.id, widget: text.id });
      }
    }
  }
  // Cross-widget content collisions. Backgrounds are intentionally allowed to
  // sit behind content; only text and icon ink is compared.
  const content = [
    ...laid.widgets.flatMap((w) => w.texts.map((t) => ({ id: t.id, ink: t.ink, widget: w.id }))),
    ...laid.widgets.flatMap((w) => w.icons.map((i) => ({ id: i.id, ink: i.ink, widget: w.id }))),
  ];
  for (let i = 0; i < content.length; i++) {
    for (let j = i + 1; j < content.length; j++) {
      if (content[i].widget === content[j].widget) continue;
      if (boxesIntersect(content[i].ink, content[j].ink)) {
        add('error', 'content-overlap', `${label}: ${content[i].id} overlaps ${content[j].id}`, { screen: screen.id, widget: content[i].widget });
      }
    }
  }
  // Content must stay inside the widget that owns it, and button labels need
  // enough side padding to read as buttons rather than clipped text.
  for (const widget of laid.widgets) {
    for (const node of [...widget.texts, ...widget.icons]) {
      const { x0, y0, x1, y1 } = node.ink;
      const r = widget.rect;
      if (x0 < r.x - 0.01 || y0 < r.y - 0.01 || x1 > r.x + r.w + 0.01 || y1 > r.y + r.h + 0.01) {
        add('error', 'content-clip', `${label}: ${node.id} ink leaves ${widget.id}`, { screen: screen.id, widget: widget.id });
      }
    }
    if (widget.type === 'button' && widget.extra?.content) {
      const content = widget.extra.content;
      const padL = content.x - widget.rect.x;
      const padR = widget.rect.x + widget.rect.w - (content.x + content.w);
      if (padL < 6 || padR < 6) {
        add('error', 'button-padding', `${label}: ${widget.id} has ${padL.toFixed(1)}px/${padR.toFixed(1)}px side padding (min 6px)`, { screen: screen.id, widget: widget.id });
      }
    }
  }
  return laid;
}

for (const screen of layout.screens) {
  checkScene(sceneFor(screen.id), `${screen.id} default`);
  checkScene(
    sceneFor(screen.id, { text: maxText, tone: maxTone, progress: maxProgress, errors: maxErrors }),
    `${screen.id} max-text`
  );
}

for (const sc of scenarios.scenarios) {
  const scene = sceneFor(sc.screen, {
    text: sc.text,
    tone: sc.tone,
    progress: sc.progress,
    errors: sc.errors,
    bitErrors: sc.bitErrors,
    addrErrors: sc.addrErrors,
    errorPage: 0,
  });
  checkScene(scene, `scenario ${sc.id}`);
}

// ---------- report ----------
const order = { error: 0, warning: 1 };
issues.sort((a, b) => order[a.severity] - order[b.severity] || String(a.screen).localeCompare(String(b.screen)) || String(a.widget).localeCompare(String(b.widget)) || a.code.localeCompare(b.code));
const errors = issues.filter((i) => i.severity === 'error');
const warnings = issues.filter((i) => i.severity === 'warning');

for (const issue of issues) {
  const location = [issue.screen, issue.widget].filter(Boolean).join(' / ');
  console.log(`${issue.severity === 'error' ? 'ERROR' : 'warn '}  ${issue.code.padEnd(17)} ${location ? `[${location}] ` : ''}${issue.message}`);
}

console.log(
  `\n${layout.screens.length} screens, ${layout.screens.reduce((n, s) => n + s.widgets.length, 0)} widgets, ` +
  `${scenarios.scenarios.length} scenarios: ${errors.length} error(s), ${warnings.length} warning(s)`
);

if (errors.length || (strict && warnings.length)) process.exit(1);
