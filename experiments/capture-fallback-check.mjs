// One-off: capture the default view with the density texture 404'd, proving the procedural
// fallback keeps the river visibly non-empty. Not part of the baseline sets.
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { BASELINE_EPOCH, DESKTOP_VIEWPORT, freePort, startDevServer } from './baseline-harness.mjs';

const port = await freePort();
const server = await startDevServer(port);
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: DESKTOP_VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('mira:seen-opening', '1');
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  });
  await page.route('**/materials/*.webp', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto(`${server.baseUrl}/?capture=1&epoch=${encodeURIComponent(BASELINE_EPOCH)}&cam=default`, { waitUntil: 'networkidle' });
  await page.getByTestId('explore-ui').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(300);
  const hint = page.getByTestId('milestone-hint');
  if ((await hint.count()) > 0) {
    await hint.waitFor({ state: 'detached', timeout: 20_000 }).catch(() => {});
  }
  await page.waitForTimeout(1500);
  const outDir = path.join('docs', 'design-audit-2026-09-17', 'baselines', 'scratch');
  await mkdir(outDir, { recursive: true });
  const out = path.join(outDir, 'fallback-default.png');
  await page.screenshot({ path: out });
  console.log('fallback capture written to', out);
} finally {
  await browser.close();
  server.child.kill();
}
