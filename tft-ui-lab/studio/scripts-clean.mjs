import { chromium } from 'playwright';
import fs from 'node:fs';

const outDir = process.env.SHOTS_DIR ?? '/tmp/opencode/clean';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 980 } });
const logs = [];
page.on('console', (msg) => logs.push(`console.${msg.type()}: ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`pageerror: ${err.message}`));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-testid=device-frame]');
await page.addStyleTag({ content: '.preview-overlay{display:none!important}' });
await page.waitForTimeout(300);

const thumbs = page.locator('.screen-thumb');
const count = await thumbs.count();
console.log('screens:', count);

for (let i = 0; i < count; i++) {
  const thumb = thumbs.nth(i);
  const id = await thumb.locator('.thumb-id').innerText();
  await thumb.click();
  await page.waitForTimeout(150);

  // Native 320x240 framebuffer PNG, no DOM overlays at all.
  const dataUrl = await page.evaluate(() => {
    const canvas = document.querySelector('.device-screen canvas');
    return canvas ? canvas.toDataURL('image/png') : null;
  });
  if (dataUrl) {
    fs.writeFileSync(`${outDir}/${id}-native.png`, Buffer.from(dataUrl.split(',')[1], 'base64'));
  }

  // Native 320x240 canvas, one PNG per scenario, named after the scenario id
  // (stable, unlike labels). Same pixel space as `<screen>-native.png`, so
  // tools/probe.mjs crops work on every file.
  const slug = (value) =>
    value.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  const scenarios = page.locator('.scenario-list .scenario');
  const scCount = await scenarios.count();
  const seen = new Set();
  for (let j = 0; j < scCount; j++) {
    const sc = scenarios.nth(j);
    const scenarioId =
      (await sc.getAttribute('data-scenario')) ??
      slug(await sc.locator('span').first().innerText());
    if (!scenarioId || seen.has(scenarioId)) continue;
    seen.add(scenarioId);
    // The default-data view is already the canvas captured as -native.png.
    if (scenarioId === 'default') continue;
    await sc.click();
    await page.waitForTimeout(120);
    const png = await page.evaluate(() => {
      const canvas = document.querySelector('.device-screen canvas');
      return canvas ? canvas.toDataURL('image/png') : null;
    });
    if (!png) throw new Error(`${id}: canvas disappeared for scenario "${scenarioId}"`);
    fs.writeFileSync(`${outDir}/${id}-${scenarioId}.png`, Buffer.from(png.split(',')[1], 'base64'));
  }
  console.log(`${id}: 1 native + ${seen.size - (seen.has('default') ? 1 : 0)} scenario PNG(s)`);
}

console.log('logs:', JSON.stringify(logs, null, 2));
await browser.close();
