# TFT UI Lab — agent guide

The `tft-ui-lab/` folder is a **visual bug-finding workbench for 320x240
embedded UIs**. There is no firmware here: what remains is the pipeline that
makes a small screen's defects visible without hardware — a shared geometry
engine, a browser studio, a linter, a content audit, a pixel-exact renderer and
a screenshot oracle.

The `shared/layout.json` screens are sample data (a diagnostic-device UI, 8
screens / 75 widgets / 11 scenarios). They exist so every tool has something
real to exercise. Replace them freely; nothing in the tooling depends on their
content.

---

## Repository layout

The repository root holds exactly two things: this guide and the tool.

```
ADWS/
├── AGENTS.md        <- this file (the guide)
└── tft-ui-lab/      <- the workbench; every command below runs from here
    ├── package.json     npm scripts (gen, lint:ui, audit, shots, probe, check)
    ├── shared/          layout/theme/icons/scenarios/fonts + geometry engine
    ├── tools/           gen.mjs, lint-layout.mjs, audit.mjs, shots.mjs, probe.mjs
    ├── studio/          Vite + React studio (preview, editor, issues, device)
    └── docs/            MIRROR-PROTOCOL.md
```

All paths below are relative to `tft-ui-lab/`, except absolute paths
(`/tmp/opencode/...`, the screenshot directory) and the `ADWS/` tree diagram
above. If you are at the repository root, `cd tft-ui-lab` first.

---

## The one rule

**Never make a visual claim you have not measured.** Open the PNG, and when a
collision or overlap is suspected, prove it with `tools/probe.mjs` before
reporting it or "fixing" it. Scroll-jumping at 2x has produced false positives
before (a 5 px gap looked like an overlap). Numbers or it didn't happen.

---

## How the pipeline works

```
shared/layout.json      screens + widgets            <- source of truth
shared/theme.json       colors, fonts, metrics
shared/icons.json       vector icons (24x24 viewBox)
shared/scenarios.json   sample values, incl. worst case
shared/fonts/*.h        GFX font headers (parsed at gen time)
shared/lib/layout-engine.mjs   geometry + text metrics (shared by studio & CLI)
            |
tools/gen.mjs ──► studio/src/generated/*.json            studio data
              └─► shared/generated/firmware/ui_data.*    C++ tables (export)
```

There is **no code conversion** between the browser and a device. The studio
renderer (`studio/src/lib/framebuffer.ts`) and any device renderer are separate
implementations of the same JSON contract, kept in sync by data generated from
one source. That is why the preview is trustworthy: same files, same metrics.

## Where things live

| Path | Purpose |
| --- | --- |
| `shared/layout.json` | screens, widgets, bindings, actions (source of truth) |
| `shared/theme.json` | colours, font aliases, metrics, display size |
| `shared/icons.json` | vector icons |
| `shared/scenarios.json` | default / worst-case / named scenario data |
| `shared/lib/layout-engine.mjs` | geometry, text measurement, wrapping (types in `.d.ts`) |
| `tools/gen.mjs` | emits `studio/src/generated/*` and the C++ export |
| `tools/lint-layout.mjs` | geometry linter (the hard gate) |
| `tools/audit.mjs` | content audit (text, duplicates, empty bindings) |
| `tools/shots.mjs` | one-command screenshot run |
| `tools/probe.mjs` | pixel measurement of a PNG crop |
| `studio/` | Vite + React studio (preview, editor, issues, device) |
| `studio/src/lib/framebuffer.ts` | the Canvas2D renderer |
| `docs/MIRROR-PROTOCOL.md` | `MLF1`/`MLT1` device mirror format |

---

## Setup

```sh
cd tft-ui-lab          # the tool folder; every command runs from here
npm run setup          # npm --prefix studio install && node tools/gen.mjs
npm run studio         # http://127.0.0.1:5173/
```

Requirements: Node 20+, `/usr/bin/google-chrome` for the Playwright scripts,
ImageMagick (`convert`) for zoom/probe. Nothing else.

---

## Commands

Run these from `tft-ui-lab/`.

| Command | Purpose | Exit code |
| --- | --- | --- |
| `npm run gen` | regenerate everything from `shared/*.json` | 0 |
| `npm run gen:check` | fail if generated files are stale | 1 when stale |
| `npm run lint:ui` | geometry gate: contrast, padding, clipping, box overlap | 1 on errors |
| `npm run lint:ui -- --strict` | also fail on warnings | 1 on warnings |
| `npm run audit` | content gate: text overflow, ink collisions, duplicate values, empty bindings | 0 (report) |
| `npm run audit -- --strict` | same, but fail when anything is found | 1 on findings |
| `npm run audit -- --screen running` | one screen only | |
| `npm run shots` | start studio if needed, screenshot every screen/scenario, stop it | 1 on failure |
| `npm run probe -- <png> --box x,y,w,h` | measure ink in a crop | 2 on bad input |
| `npm run check` | gen:check + lint + audit + studio build | 1 on failure |
| `npm run studio:build` | type-check + production build | 1 on error |

`npm run shots` writes **27 PNGs for 8 screens** to `/tmp/opencode/clean` by
default — 8 native + 8 worst-case + 11 named scenarios, named after the
scenario **id**:

```
<screen>-native.png          the screen as it opens (default data), 320x240
<screen>-max.png             the global worst case (maxText/maxTone/maxErrors)
<screen>-<scenario-id>.png   one per named scenario, e.g. errors-errors-max.png
```

Every file is the raw canvas: exactly 320x240, no editor chrome, no 2x zoom, so
a `probe --box` crop uses screen coordinates directly. There is no
`<screen>-default.png` — the default view *is* `<screen>-native.png`. Multiple
named scenarios that paint the same pixels produce identical files on purpose
(see Known open findings).

Pass `--out <dir>` or set `SHOTS_DIR` to change the destination.

---

## The bug-hunting loop

Run these five steps for every change, in this order:

```sh
npm run gen                 # 1. layout JSON -> generated data
npm run lint:ui             # 2. geometry gate (must be 0 errors / 0 warnings)
npm run audit               # 3. content gate (triage every warning)
npm run shots               # 4. render every screen and scenario
```

5. Look at the PNGs, confirm anything suspicious with `probe`, fix, repeat.

Fixing is a JSON edit (or a studio drag) followed by `npm run gen`. Never edit
`studio/src/generated/*` or `shared/generated/*` by hand.

### What each step catches

| Step | Sees | Blind to |
| --- | --- | --- |
| `lint:ui` | contrast, padding, clipping, widget-box overlap, unknown colors/fonts/icons/actions | text ink, duplicated information, impossible states |
| `audit` | text wider than its box, text ink collisions, ink outside the screen, the same value in two widgets, bindings that resolve empty, systematically tight glyphs | visual weight, alignment aesthetics, intent |
| `shots` | everything a human would see | needs someone to look |
| `probe` | exact pixel geometry of any crop | only answers what you ask |

---

## Reading a screenshot like an agent

1. Always start from `*-native.png`. It is exactly 320x240, one image pixel per
   screen pixel. Ignore the 2x editor view for judgement.
2. Zoom with nearest-neighbour, never smooth:

   ```sh
   convert /tmp/opencode/clean/settings-native.png \
     -crop 160x36+160+118 +repage -filter point -resize 400% /tmp/opencode/zoom.png
   ```

3. When you think two things touch, measure instead of arguing:

   ```sh
   npm run probe -- /tmp/opencode/clean/home-native.png --box 0,120,150,26 \
     --color 8ca2b5,21d2ef
   ```

   ```
   col runs    19-26  29-40  43-53  56-64  70-132
   ```

   Four separate runs for `LAST`, one for the pill, a 5 px gap at 65-69: no
   collision. Compare with a real one:

   ```sh
   npm run probe -- /tmp/opencode/clean/settings-native.png --box 160,118,160,36 \
     --color eff3ff
   ```

   ```
   col runs    11-19  22-30  32-53  67-74  88-96  99-107  110-118  120-141
   ```

   `32-53` and `120-141` are merged runs: adjacent letters share pixel columns,
   i.e. the glyphs physically touch. That is a typography defect, proven.

4. `--color` takes the ink colours to measure; without it the probe treats every
   pixel that differs from the most common colour as ink, which also catches
   borders and shadows. Get colours from the `top colors` line of a first pass.
5. `--json` emits the same data for scripting.

---

## The studio UI

| Area | What it does |
| --- | --- |
| Screen list (left) | one thumbnail per screen with its widget count |
| Scenario list (left) | `Default data`, `Worst-case text`, then per-screen scenarios |
| Canvas (centre) | drag to move, drag the corner handle to resize, Shift snaps to the grid |
| Add grid | `+ Text`, `+ Stat`, `+ Button` … inserts a widget on the selected screen |
| Inspector (right) | numeric geometry, font, colour, binding, action of the selection |
| Issues tab | every lint finding; clicking one jumps to the screen, scenario and widget |
| Code tab | the generated C++ tables for the current screen; Download JSON |
| Device tab | live mirror of a real device framebuffer, plus tap injection |
| `Save + generate` | POSTs `shared/layout.json` through the Vite dev server, then runs `tools/gen.mjs` |
| `Revert` | drops unsaved edits |

Unsaved edits mark the status `UNSAVED`; a clean lint shows `LINT CLEAN`. The
save endpoint is `POST /api/save-layout` (see `studio/vite.config.ts`).

---

## Scenarios

`shared/scenarios.json` has five global pieces and a named list:

- `defaults` — the value behind every binding in the default view
- `maxText` — worst-case long strings (widest text)
- `maxTone` — worst-case colour states
- `maxProgress` — 0..100 progress extreme
- `maxErrors` — a full error list / long addresses
- `scenarios[]` — per-screen overrides: `{ id, label, screen, text, tone, progress, errors }`

The studio and the audit lay out `default` (= `defaults`), `max` (= defaults +
maxText/maxTone/maxProgress/maxErrors) and every named scenario for its screen.
`tools/audit.mjs` mirrors `sceneFor()` from `studio/src/lib/lint.ts`, so CLI and
studio always see the same values.

To add a state: append to `scenarios[]` with a unique `id`, run `npm run gen`.
Give the state coherent values — a summary that says `3 OF 37` next to an empty
list is exactly the kind of lie this tool exists to expose.

---

## Defect catalogue (real examples from this repo)

| Pattern | How it looks | How it was found |
| --- | --- | --- |
| Duplicated value | `PASS 1/2` in a dedicated widget **and** inside `0x55555555 \| PASS 1/2` | `npm run audit` → `DUPLICATE_TEXT` |
| Duplicated counter | page `1/37` in the header and again in the footer | `DUPLICATE_TEXT` |
| Impossible state | default `errors` screen: summary `3 OF 37 ERRORS`, list `NO ERRORS DETECTED` | reading `errors-native.png` |
| Format drift | scenario text `… \| TAP ROW` where the renderer/app prints `… \| PAGE 1/37` | comparing JSON with the string builder |
| Glyph touching | `SRAM + PSRAM` at 1x; merged column runs | `probe --color` |
| Tight font | every glyph draws 1 px past its advance | `audit` (`TIGHT_FONT`, systematic cases only) |

Sample rows in `errors` also repeat `READ \| bit 10` on two lines — plausible
data, still worth a look, and the audit flags it.

---

## Known open findings

`npm run audit` currently reports 10 warnings, all real:

1. `errors` — page counter rendered twice (header + footer), in 4 scenes.
2. `errors` — two rows show the same `READ | bit N` in 3 scenes.
3. `running` — pass counter rendered twice (`pass` + `pattern`), in 3 scenes.

Two things the audit cannot see:

1. The default `errors` screen claims 37 errors while the list is empty, because
   no zero-error scenario exists.
2. The named `settings` scenario is a **no-op**: all four of its overrides
   (`suiteLabel`, `passesLabel`, `targetsLabel`, `brightnessLabel`) repeat the
   `defaults` values, so `settings-settings.png` is byte-identical to
   `settings-native.png` — it claims coverage it does not have.

The remaining duplicate images are legitimate: `errors-max.png` equals
`errors-errors-max.png` (both fill every field), and `about` / `calibrate`
collapse their `-max` and named-scenario images into the native one because
those screens bind none of the `maxText` keys. Net: 4 duplicate groups,
6 redundant files, **21 unique images out of 27**.

Treat this list as a regression baseline. Fix them and the audit drops to zero;
add a new one and it shows up immediately. A scenario that changes nothing is
still a defect — it claims coverage it does not have.

---

## Rules

- `shared/layout.json` is the source of truth. Edit it directly or through the
  studio; never by patching generated files.
- Run `npm run gen` after any change to layout/theme/icons/scenarios, then
  `npm run check`.
- `lint:ui` must stay at **0 errors, 0 warnings**. `audit` warnings must be
  triaged, not ignored: each one is either fixed or explained.
- Take screenshots after every visual change. A change without a PNG is a
  guess.
- One finding, one fix. Do not "clean up" geometry you were not asked about.

---

## Environment quirks

- Playwright uses `/usr/bin/google-chrome`; headless, `--no-sandbox`.
- Rollup's native binary SIGILLs on this host. `studio/package.json` aliases
  `rollup` to `@rollup/wasm-node`; **do not remove that alias**.
- `npm run shots` starts Vite on 127.0.0.1:5173 when it is not already up, and
  stops only the server it started.
- The studio logs one `404` for the favicon in headless runs. Expected.
- `npm run probe` and the zoom command need ImageMagick (`convert`).
- The studio has no automated browser test suite. Use
  `studio/scripts-interaction.mjs` (drag/resize/save/mirror smoke test) against a
  running dev server when you change interaction code.

---

## Extending the tool

- **New widget type:** layout logic in `shared/lib/layout-engine.mjs`, drawing
  in `studio/src/lib/framebuffer.ts`, rules in `tools/lint-layout.mjs`, then a
  scenario that exercises it. The C++ export in `tools/gen.mjs` is optional.
- **New audit rule:** add a check inside the per-scene loop in
  `tools/audit.mjs`, emit via `add(severity, code, screen, scenario, widget,
  message)`. Keep the code upper-snake and the message numeric where possible.
- **New scenario:** see above; run `gen` then `shots`.
- **New screen:** add to `layout.screens` with a unique id; widgets carry
  unique ids within the screen (`screen.widget`).

---

## Reporting a finding

Use this shape so the next agent can reproduce it:

```
screen/scenario : running/default
widget          : running.pass x running.pattern
expected        : pass count shown once
actual          : "PASS 1/2" and "0x55555555 | PASS 1/2"
evidence        : npm run audit -> DUPLICATE_TEXT; /tmp/opencode/clean/running-native.png
severity        : content (ships to every state)
```
