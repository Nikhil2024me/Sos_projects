import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const outDir = '/tmp/opencode/interaction';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 980 } });
const errors = [];
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error' && !msg.text().includes('404')) errors.push(`console: ${msg.text()}`);
});

try {
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=device-frame]');
  await page.waitForTimeout(300);

  assert.equal(await page.locator('.screen-thumb').count(), 8, '8 screen thumbnails');
  assert.match(await page.locator('.top-status').innerText(), /LINT CLEAN/);

  const canvas = page.locator('.device-screen canvas');
  const box = await canvas.boundingBox();
  assert(box, 'device canvas has a box');
  const at = (x, y) => ({ x: box.x + (x / 320) * box.width, y: box.y + (y / 240) * box.height });

  // Select home.run, drag it +6px, then resize it -20px from the corner handle.
  const run = at(160, 170);
  await page.mouse.move(run.x, run.y);
  await page.mouse.down();
  await page.mouse.move(run.x + 6 * (box.width / 320), run.y, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  assert.match(await page.locator('.selected-readout').innerText(), /home\.run @ 14,148 304x44/, 'drag moved home.run by +6px');
  assert.match(await page.locator('.top-status').innerText(), /UNSAVED/);

  const handle = at(318, 192);
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x - 20 * (box.width / 320), handle.y, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  assert.match(await page.locator('.selected-readout').innerText(), /home\.run @ 14,148 284x44/, 'resize reduced width by 20px');
  await page.screenshot({ path: `${outDir}/drag-resize.png` });

  // Revert to the source layout.
  await page.getByRole('button', { name: 'Revert' }).click();
  await page.waitForTimeout(150);
  assert.match(await page.locator('.selected-readout').innerText(), /home\.run @ 8,148 304x44/);
  assert.doesNotMatch(await page.locator('.top-status').innerText(), /UNSAVED/);

  // Scenario switching.
  await page.locator('.screen-thumb').filter({ hasText: 'running' }).click();
  await page.getByRole('button', { name: /Worst-case text/ }).click();
  await page.waitForTimeout(150);
  assert.match(await page.locator('.stage-title').innerText(), /running\s*\/\s*Worst-case text/);
  assert.equal(await page.locator('.scenario.active span').first().innerText(), 'Worst-case text');
  await page.screenshot({ path: `${outDir}/running-worst.png` });

  // Create a cross-widget collision and confirm the issues panel focuses it.
  await page.locator('.screen-thumb').filter({ hasText: 'home' }).click();
  await page.getByRole('button', { name: '+ Text' }).click();
  await page.waitForTimeout(150);
  const dirtyStatus = await page.locator('.top-status').innerText();
  assert.match(dirtyStatus, /UNSAVED/);
  assert.match(dirtyStatus, /ERR/);

  await page.getByRole('button', { name: /^Issues/ }).click();
  const issueRows = page.locator('.issue-row');
  assert((await issueRows.count()) > 0, 'collision produced lint issues');
  const issueLoc = await issueRows.first().locator('.issue-loc').innerText();
  const issueWidget = issueLoc.split('/').map((s) => s.trim())[1];
  await issueRows.first().click();
  await page.waitForTimeout(150);
  assert.match(await page.locator('.stage-title').innerText(), /home/);
  assert(issueWidget, `issue names a widget (${issueLoc})`);
  assert.match(await page.getByTestId('inspector').innerText(), new RegExp(issueWidget.replace('.', '\\.')));
  await page.screenshot({ path: `${outDir}/issue-focus.png` });
  await page.getByRole('button', { name: 'Revert' }).click();
  await page.waitForTimeout(150);
  assert.match(await page.locator('.top-status').innerText(), /LINT CLEAN/);

  // Save API + codegen: post the current generated layout back unchanged.
  const saveResult = await page.evaluate(async () => {
    const layout = await (await fetch('/src/generated/layout.json')).json();
    const res = await fetch('/api/save-layout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(layout),
    });
    return { status: res.status, body: await res.json() };
  });
  assert.equal(saveResult.status, 200, 'save API status');
  assert.equal(saveResult.body.ok, true, 'save API ok');
  assert.match(saveResult.body.output, /Generated \d+ files/);

  // Device mirror: mock frames, then inject a tap into the mirror.
  await page.getByRole('button', { name: 'Device', exact: true }).click();
  await page.getByRole('button', { name: 'Mock device' }).click();
  await page.waitForTimeout(1250);
  const stats = await page.locator('.mirror-stats').innerText();
  assert.match(stats, /CONNECTED/);
  assert.match(stats, /320x240/);
  const frames = Number((stats.match(/(\d+) frames/) ?? [])[1] ?? 0);
  assert(frames >= 2, `mock produced frames (got ${frames})`);
  const mirrorShot = await page.locator('.mirror-frame canvas').screenshot({ path: `${outDir}/mock-frame.png` });
  assert(mirrorShot.length > 2000, 'mirror canvas has rendered pixels');

  const mirrorBox = await page.locator('.mirror-frame canvas').boundingBox();
  assert(mirrorBox, 'mirror canvas box');
  await page.mouse.click(
    mirrorBox.x + (160 / 320) * mirrorBox.width,
    mirrorBox.y + (170 / 240) * mirrorBox.height
  );
  await page.waitForTimeout(250);
  assert.match(await page.locator('.stage-title').innerText(), /running/);
  assert.match(await page.locator('.toast').innerText(), /TOUCH 160,170 -> home\.run/);
  await page.screenshot({ path: `${outDir}/mirror-tap.png` });
  await page.getByRole('button', { name: 'Stop mock' }).click();

  // Return to a clean studio state.
  await page.locator('.screen-thumb').filter({ hasText: 'home' }).click();
  await page.getByRole('button', { name: 'Default data' }).click();
  assert.match(await page.locator('.top-status').innerText(), /LINT CLEAN/);
  assert.deepEqual(errors, [], 'no console or page errors');

  console.log(JSON.stringify({
    ok: true,
    frames,
    stats,
    saveStatus: saveResult.status,
    dragResize: true,
    issueFocus: true,
    mirrorTap: true,
  }, null, 2));
} catch (err) {
  await page.screenshot({ path: `${outDir}/failure.png`, fullPage: true });
  console.error(err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
