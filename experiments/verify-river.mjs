import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const out = 'docs/visual-direction/evidence';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('http://127.0.0.1:5186/experiments/river-study.html', { waitUntil: 'networkidle' });
  await page.locator('canvas[data-ready="true"]').waitFor();
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  const before = await page.screenshot({ path: `${out}/desktop.png` });
  await page.mouse.move(750, 450);
  await page.mouse.down();
  await page.mouse.move(980, 490, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  const after = await page.screenshot({ path: `${out}/dragged.png` });
  assert.notDeepEqual(before, after, 'drag must change rendered view with autonomous motion disabled');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('canvas[data-ready="true"]').waitFor();
  await page.screenshot({ path: `${out}/mobile.png` });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const movingA = await page.screenshot();
  await page.waitForTimeout(1200);
  const movingB = await page.screenshot();
  assert.notDeepEqual(movingA, movingB, 'material must animate without input');
  assert.deepEqual(errors, []);
  console.log('PASS: texture loads; no browser errors; drag changes view; material animates; 390px has no horizontal overflow. Screenshots saved. This is not physical-device performance proof.');
} finally {
  await browser.close();
}
