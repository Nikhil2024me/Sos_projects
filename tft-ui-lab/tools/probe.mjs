#!/usr/bin/env node
// Pixel probe: answer "did these two things actually touch?" from a PNG.
//
// Screenshots are 320x240 with no scaling, so a 1:1 crop is the ground truth.
// This tool reports the ink layout inside a crop: the background colour, the
// ink bounding box, and the runs of columns/rows that contain ink. Two glyph
// clusters that look merged in a zoomed screenshot but have a gap here are
// *not* a collision.
//
//   node tools/probe.mjs /tmp/opencode/clean/home-native.png --box 0,120,150,26
//   node tools/probe.mjs shot.png --box 160,38,160,20 --json
//   node tools/probe.mjs shot.png --box 0,0,320,240 --threshold 12
//
// Requires ImageMagick (`convert`) to decode the PNG.
//
// Exit codes: 0 = probed, 2 = bad input.

import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const asJson = args.includes('--json');
const threshold = Number(flag('threshold', '8'));
const colorFilter = flag('color', null)
  ?.split(',')
  .map((value) => value.trim().replace(/^#/, ''))
  .filter(Boolean)
  .map((value) => [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)));

const file = positional[0];
if (!file) {
  console.error('probe: usage: node tools/probe.mjs <png> --box x,y,w,h [--json]');
  process.exit(2);
}

const boxArg = flag('box', null);
let box = null;
if (boxArg) {
  const parts = boxArg.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    console.error(`probe: bad --box "${boxArg}" (expected x,y,w,h)`);
    process.exit(2);
  }
  box = parts;
}

function readPpm(buffer) {
  // P6 <w> <h> <max>\n<binary data>, comments allowed before the max value.
  let pos = 0;
  const tokens = [];
  while (tokens.length < 4 && pos < buffer.length) {
    const ch = String.fromCharCode(buffer[pos]);
    if (/\s/.test(ch)) { pos++; continue; }
    if (ch === '#') { while (pos < buffer.length && buffer[pos] !== 10) pos++; continue; }
    let token = '';
    while (pos < buffer.length && !/\s/.test(String.fromCharCode(buffer[pos]))) {
      token += String.fromCharCode(buffer[pos++]);
    }
    tokens.push(token);
  }
  const [magic, width, height, max] = tokens;
  if (magic !== 'P6') throw new Error(`unsupported PNM magic "${magic}"`);
  pos++; // single whitespace after maxval
  const w = Number(width);
  const h = Number(height);
  const scale = Number(max) > 255 ? 2 : 1;
  return { w, h, scale, data: buffer.subarray(pos), max: Number(max) };
}

const convertArgs = ['-depth', '8'];
if (box) convertArgs.push('-crop', `${box[2]}x${box[3]}+${box[0]}+${box[1]}`, '+repage');
convertArgs.push('ppm:-');

const result = spawnSync('convert', [file, ...convertArgs], { maxBuffer: 64 * 1024 * 1024 });
if (result.status !== 0) {
  console.error(`probe: convert failed: ${result.stderr?.toString().trim() || 'is ImageMagick installed?'}`);
  process.exit(2);
}

let image;
try {
  image = readPpm(result.stdout);
} catch (error) {
  console.error(`probe: ${error.message}`);
  process.exit(2);
}

const { w, h, data } = image;
const at = (x, y) => {
  const i = (y * w + x) * 3;
  return [data[i], data[i + 1], data[i + 2]];
};

// Background = most frequent colour, which is correct for these flat UIs.
const counts = new Map();
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const key = at(x, y).join(',');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
}
const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
const bg = ranked[0][0].split(',').map(Number);
const isInk = colorFilter?.length
  ? (rgb) =>
      colorFilter.some(
        (ref) => Math.max(...[0, 1, 2].map((i) => Math.abs(rgb[i] - ref[i]))) <= threshold
      )
  : (rgb) => Math.max(...[0, 1, 2].map((i) => Math.abs(rgb[i] - bg[i]))) > threshold;

let minX = w, minY = h, maxX = -1, maxY = -1;
let inkPixels = 0;
const colInk = new Array(w).fill(false);
const rowInk = new Array(h).fill(false);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    if (!isInk(at(x, y))) continue;
    inkPixels++;
    colInk[x] = true;
    rowInk[y] = true;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
}

const runs = (flags) => {
  const out = [];
  let start = null;
  for (let i = 0; i < flags.length; i++) {
    if (flags[i] && start === null) start = i;
    if (!flags[i] && start !== null) { out.push([start, i - 1]); start = null; }
  }
  if (start !== null) out.push([start, flags.length - 1]);
  return out;
};

const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
const summary = {
  file,
  box: box ?? [0, 0, w, h],
  size: { w, h },
  background: hex(bg),
  inkPixels,
  inkBox: maxX < 0 ? null : { x0: minX, y0: minY, x1: maxX, y1: maxY },
  columnRuns: runs(colInk),
  rowRuns: runs(rowInk),
  colors: ranked.slice(0, 6).map(([key, count]) => ({ color: hex(key.split(',').map(Number)), count })),
};

if (asJson) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(`file        ${file}`);
  console.log(`box         ${summary.box.join(',')}  (${w}x${h})`);
  console.log(`background  ${summary.background}${colorFilter ? `   ink filter ${colorFilter.map((c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')).join(' ')}` : ''}`);
  console.log(`ink pixels  ${summary.inkPixels}`);
  console.log(`ink box     ${summary.inkBox ? `${summary.inkBox.x0},${summary.inkBox.y0} .. ${summary.inkBox.x1},${summary.inkBox.y1}` : 'none'}`);
  console.log(`col runs    ${summary.columnRuns.map((r) => `${r[0]}-${r[1]}`).join('  ') || 'none'}`);
  console.log(`row runs    ${summary.rowRuns.map((r) => `${r[0]}-${r[1]}`).join('  ') || 'none'}`);
  console.log('top colors  ' + summary.colors.map((c) => `${c.color} x${c.count}`).join('  '));
}
