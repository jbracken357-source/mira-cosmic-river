// Capture the default view with the density texture 404'd, proving the procedural
// fallback keeps the river visibly non-empty. Writes baselines/fallback/default.png —
// the evidence README.md and EVIDENCE-19.md cite — so re-running reproduces it.
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import {
  BASELINE_EPOCH,
  DESKTOP_VIEWPORT,
  baselineInitScript,
  freePort,
  startDevServer,
  waitForExploreReady,
} from './baseline-harness.mjs';

const port = await freePort();
const server = await startDevServer(port);
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: DESKTOP_VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.addInitScript(baselineInitScript);
  await page.route('**/materials/*.webp', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto(`${server.baseUrl}/?capture=1&epoch=${encodeURIComponent(BASELINE_EPOCH)}&cam=default`, { waitUntil: 'networkidle' });
  await waitForExploreReady(page);
  await page.waitForTimeout(1500);
  const outDir = path.join('docs', 'design-audit-2026-09-17', 'baselines', 'fallback');
  await mkdir(outDir, { recursive: true });
  const out = path.join(outDir, 'default.png');
  await page.screenshot({ path: out });
  console.log('fallback capture written to', out);
} finally {
  await browser.close();
  server.child.kill();
}
