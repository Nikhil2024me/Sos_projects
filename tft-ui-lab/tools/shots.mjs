#!/usr/bin/env node
// One-command screenshots of every screen and scenario.
//
// Starts the Vite dev server when it is not already running, drives the studio
// with headless Chrome, writes 320x240 PNGs, then stops the server it started.
//
//   node tools/shots.mjs
//   node tools/shots.mjs --out /tmp/opencode/clean
//   SHOTS_DIR=/tmp/opencode/clean node tools/shots.mjs
//
// Output (default /tmp/opencode/clean):
//   <screen>-native.png          the 320x240 canvas, no editor overlay
//   <screen>-<scenario>.png      same screen with that scenario's data
//
// Requires the studio dependencies (npm --prefix studio install) and
// /usr/bin/google-chrome.

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STUDIO = path.join(ROOT, 'studio');
const SCRIPT = path.join(STUDIO, 'scripts-clean.mjs');
const URL = 'http://127.0.0.1:5173/';

const args = process.argv.slice(2);
const outDir = args.includes('--out')
  ? path.resolve(args[args.indexOf('--out') + 1])
  : path.resolve(process.env.SHOTS_DIR ?? '/tmp/opencode/clean');

if (!fs.existsSync(SCRIPT)) {
  console.error(`shots: missing ${SCRIPT}`);
  process.exit(2);
}

async function reachable() {
  try {
    const res = await fetch(URL, { signal: AbortSignal.timeout(1200) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await reachable()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

let server = null;
let startedHere = false;

if (!(await reachable())) {
  console.log('shots: starting the studio dev server');
  server = spawn('npm', ['--prefix', STUDIO, 'run', 'dev', '--', '--host', '127.0.0.1'], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
  });
  startedHere = true;
  const ok = await waitForServer();
  if (!ok) {
    console.error('shots: dev server did not come up on ' + URL);
    try { process.kill(-server.pid, 'SIGTERM'); } catch {}
    process.exit(2);
  }
}

fs.mkdirSync(outDir, { recursive: true });

const runScript = () =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT], {
      cwd: STUDIO,
      stdio: 'inherit',
      env: { ...process.env, SHOTS_DIR: outDir },
    });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`screenshot script exited ${code}`))));
  });

let code = 0;
try {
  await runScript();
  console.log(`\nshots: PNGs in ${outDir}`);
} catch (error) {
  console.error(`shots: ${error.message}`);
  code = 1;
} finally {
  if (server && startedHere) {
    try { process.kill(-server.pid, 'SIGTERM'); } catch {}
  }
}

process.exit(code);
