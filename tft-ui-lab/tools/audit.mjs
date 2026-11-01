#!/usr/bin/env node
// Content + geometry audit for the layout.
//
// The linter (tools/lint-layout.mjs) checks contrast, padding, clipping and
// widget-box overlap. It cannot see two things that actually break screens:
//
//   1. text drawn by different widgets that collides even though the widget
//      boxes do not overlap (padding, icon offsets, badges, right alignment),
//   2. text that repeats the same information in two places, or bindings that
//      resolve to nothing in a given scenario.
//
// This tool lays out every screen with every scenario (the same scenes the
// studio shows), then measures the *ink* boxes the renderer will draw.
//
//   node tools/audit.mjs              # report, exit 0
//   node tools/audit.mjs --strict     # exit 1 when anything is found
//   node tools/audit.mjs --screen running [--json]
//
// Exit codes: 0 = no findings (or non-strict), 1 = findings with --strict,
// 2 = tool error.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLayoutEngine, boxesIntersect } from '../shared/lib/layout-engine.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GEN = path.join(ROOT, 'studio/src/generated');

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const asJson = args.includes('--json');
const onlyScreen = args.includes('--screen') ? args[args.indexOf('--screen') + 1] : null;

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(GEN, name), 'utf8'));

let theme, icons, fonts, layout, scenarios;
try {
  theme = readJson('theme.json');
  icons = readJson('icons.json');
  fonts = readJson('fonts.json');
  layout = readJson('layout.json');
  scenarios = readJson('scenarios.json');
} catch (error) {
  console.error(`audit: cannot read generated data (${error.message}). Run: npm run gen`);
  process.exit(2);
}

const engine = createLayoutEngine({ theme, icons, fonts });

// Mirrors sceneFor() in studio/src/lib/lint.ts so the audit sees exactly the
// values the studio renders.
function scene(screenId, scenario, worstCase = false) {
  return {
    screenId,
    values: {
      ...scenarios.defaults,
      ...(worstCase ? scenarios.maxText : {}),
      ...(scenario?.text ?? {}),
    },
    tones: { ...(worstCase ? scenarios.maxTone ?? {} : scenario?.tone ?? {}) },
    progress: worstCase ? scenarios.maxProgress ?? 0 : scenario?.progress ?? 0,
    bitErrors: scenario?.bitErrors ?? [],
    addrErrors: scenario?.addrErrors ?? [],
    errors: worstCase ? scenarios.maxErrors ?? [] : scenario?.errors ?? [],
    errorPage: 0,
  };
}

const scenesFor = (screenId) => {
  const out = [
    { id: 'default', scene: scene(screenId, null, false) },
    { id: 'max', scene: scene(screenId, null, true) },
  ];
  for (const item of scenarios.scenarios ?? []) {
    if (item.screen === screenId) out.push({ id: item.id, scene: scene(screenId, item, false) });
  }
  return out;
};

const findings = [];
const add = (severity, code, screen, scenarioId, widget, message) => {
  findings.push({ severity, code, screen, scenario: scenarioId, widget, message });
};

const normalize = (text) => text.replace(/\s+/g, ' ').trim();

// Fonts whose glyph ink is consistently wider than the advance make
// neighbouring letters touch at 1x. One or two glyphs doing it is normal for
// rasterised GFX fonts, so only flag a font when it happens across many
// glyphs (>20% of the printable range). Reported once per font.
const tightFonts = new Map();
for (const [key, font] of Object.entries(fonts.fonts ?? fonts)) {
  const glyphs = Object.entries(font.glyphs ?? {});
  if (!glyphs.length) continue;
  let worst = 0;
  let worstChar = '';
  let overCount = 0;
  for (const [ch, glyph] of glyphs) {
    const over = (glyph.xOffset ?? 0) + (glyph.width ?? 0) - (glyph.xAdvance ?? 0);
    if (over > 0) overCount++;
    if (over > worst) {
      worst = over;
      worstChar = ch;
    }
  }
  if (worst > 0 && overCount / glyphs.length > 0.2) {
    tightFonts.set(key, { worst, worstChar, overCount, total: glyphs.length });
  }
}

const screens = layout.screens.filter((screen) => !onlyScreen || screen.id === onlyScreen);
if (!screens.length) {
  console.error(`audit: no screen matches "${onlyScreen}"`);
  process.exit(2);
}

let sceneCount = 0;
for (const screen of screens) {
  for (const { id: scenarioId, scene: active } of scenesFor(screen.id)) {
    sceneCount++;
    const laid = engine.layoutScreen(screen, active);
    const texts = laid.texts.filter((text) => text.text && text.text.trim());

    // 1. Text wider than the box it was given.
    for (const text of texts) {
      for (const line of text.lines ?? []) {
        if (line.width > text.box.w + 0.5) {
          add('error', 'TEXT_OVERFLOW', screen.id, scenarioId, text.id,
            `line "${line.text}" is ${line.width.toFixed(1)}px wide, box is ${text.box.w}px`);
        }
      }
    }

    // 2. Ink outside the screen.
    for (const text of texts) {
      const { ink } = text;
      if (!ink || ink.x1 <= ink.x0) continue;
      if (ink.x0 < 0 || ink.y0 < 0 || ink.x1 > laid.width + 0.5 || ink.y1 > laid.height + 0.5) {
        add('error', 'OUT_OF_BOUNDS', screen.id, scenarioId, text.id,
          `ink ${ink.x0.toFixed(1)},${ink.y0.toFixed(1)}..${ink.x1.toFixed(1)},${ink.y1.toFixed(1)} leaves the ${laid.width}x${laid.height} screen`);
      }
    }

    // 3. Ink collisions between different widgets.
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i];
        const b = texts[j];
        if (!a.ink || !b.ink || a.ink.x1 <= a.ink.x0 || b.ink.x1 <= b.ink.x0) continue;
        if (!boxesIntersect(a.ink, b.ink)) continue;
        add('error', 'TEXT_COLLISION', screen.id, scenarioId, `${a.id} x ${b.id}`,
          `"${normalize(a.text)}" overlaps "${normalize(b.text)}"`);
      }
    }

    // 4. The same information rendered twice. Only value-like strings (they
    //    carry a digit) are compared: repeating a label such as "ERRORS" in a
    //    title and a summary is normal, repeating "PASS 1/2" is not.
    const tokens = (text) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const a = normalize(texts[i].text);
        const b = normalize(texts[j].text);
        if (a.length < 4 || b.length < 4) continue;
        if (!/\d/.test(a) || !/\d/.test(b)) continue;
        const exact = a === b;
        const short = a.length <= b.length ? a : b;
        const long = a.length <= b.length ? b : a;
        // Token-aligned containment: "PASS 1/2" inside "0x5556 | PASS 1/2",
        // but not "ERR" inside "ERRORS".
        const nested = !exact && short.length >= 6 &&
          new RegExp(`(^|[^a-z0-9])${short.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(long);
        if (!exact && !nested) continue;
        add('warning', 'DUPLICATE_TEXT', screen.id, scenarioId, `${texts[i].id} x ${texts[j].id}`,
          `${exact ? 'same text' : 'one contains the other'}: "${a}" / "${b}"`);
      }
    }

    // 5. Bindings with no value: the screen is showing an empty slot.
    for (const text of laid.texts) {
      if (text.role === 'binding' && !text.text.trim()) {
        add('warning', 'EMPTY_BINDING', screen.id, scenarioId, text.id,
          'binding resolves to an empty string');
      }
    }
  }
}

for (const [font, info] of tightFonts) {
  add('warning', 'TIGHT_FONT', '-', '-', font,
    `glyph "${info.worstChar}" draws ${info.worst}px past its advance; adjacent glyphs touch at 1x`);
}

const order = { error: 0, warning: 1 };
findings.sort((a, b) =>
  order[a.severity] - order[b.severity] ||
  String(a.screen).localeCompare(String(b.screen)) ||
  String(a.scenario).localeCompare(String(b.scenario)) ||
  a.code.localeCompare(b.code));

const errors = findings.filter((f) => f.severity === 'error');
const warnings = findings.filter((f) => f.severity === 'warning');

if (asJson) {
  console.log(JSON.stringify({ screens: screens.length, scenes: sceneCount, findings }, null, 2));
} else {
  for (const f of findings) {
    const where = [f.screen, f.scenario].filter((v) => v && v !== '-').join('/');
    console.log(`${f.severity === 'error' ? 'error' : 'warn '}  ${f.code.padEnd(15)} [${where}] ${f.widget}  ${f.message}`);
  }
  if (findings.length) console.log('');
  console.log(`${screens.length} screens, ${sceneCount} scenes: ${errors.length} error(s), ${warnings.length} warning(s)`);
}

if (strict && findings.length) process.exit(1);
process.exit(0);
