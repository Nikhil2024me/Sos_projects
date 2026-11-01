import { chromium } from 'playwright';
import fs from 'node:fs';

const outDir = '/tmp/opencode/shots';
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
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/app-home.png` });

const thumbs = page.locator('.screen-thumb');
const count = await thumbs.count();
console.log('screen thumbs:', count);
for (let i = 0; i < count; i++) {
  const thumb = thumbs.nth(i);
  const id = await thumb.locator('.thumb-id').innerText();
  await thumb.click();
  await page.waitForTimeout(250);
  await page.locator('[data-testid=device-frame]').screenshot({ path: `${outDir}/screen-${id}.png` });
}

console.log('logs:', JSON.stringify(logs, null, 2));
await browser.close();
