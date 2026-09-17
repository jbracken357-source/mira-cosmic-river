// Capture the recorded still behind the loading veil and the static fallback
// (design-audit ticket 08 / issue #24): one default view, textures confirmed
// ready, saved as a JPEG under public/materials/ so it ships with the build.
//
//   node experiments/capture-entry-still.mjs
//
// Provenance matters (TICKETS.md: the fallback still records its source scene
// version): the capture is pinned to the baseline epoch/pose like every
// baseline, and the scene commit it was captured from is written next to the
// image as entry-still-v1.SOURCE.txt. Ticket 11 (#29) re-makes the still once
// the 01/02 art lands — never pass this still off as the new scene.
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import {
  BASELINE_EPOCH,
  DESKTOP_VIEWPORT,
  baselineInitScript,
  freePort,
  gitCommit,
  sceneResourcesReady,
  startDevServer,
  waitForExploreReady,
} from './baseline-harness.mjs';

const STILL_FILE = 'entry-still-v1.jpg';

const port = await freePort();
const server = await startDevServer(port);
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: DESKTOP_VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.addInitScript(baselineInitScript);
  await page.goto(`${server.baseUrl}/?capture=1&epoch=${encodeURIComponent(BASELINE_EPOCH)}&cam=default`, { waitUntil: 'networkidle' });
  await waitForExploreReady(page);
  // A still from the fallback path must never stand in for the real scene.
  if (!(await sceneResourcesReady(page))) {
    throw new Error('scene resources never reported ready — refusing to record a degraded still');
  }
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // The still must never pose as explorable: no UI chrome baked into the image.
  await page.addStyleTag({ content: '[data-testid="explore-ui"] { display: none !important; }' });
  await page.waitForTimeout(1200);
  const outDir = path.join('public', 'materials');
  await mkdir(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, STILL_FILE), type: 'jpeg', quality: 82 });
  const provenance = [
    `file: ${STILL_FILE}`,
    `source-scene-commit: ${gitCommit() ?? 'unknown'}`,
    `captured-on: ${new Date().toISOString().slice(0, 10)}`,
    `epoch: ${BASELINE_EPOCH}`,
    `view: default (${DESKTOP_VIEWPORT.width}x${DESKTOP_VIEWPORT.height}, dpr 1, quality tier pinned high)`,
    'captured-by: experiments/capture-entry-still.mjs',
    'note: recorded from the pre-01/02 scene; ticket 11 (#29) re-makes this still when the new art lands',
    '',
  ].join('\n');
  await writeFile(path.join(outDir, 'entry-still-v1.SOURCE.txt'), provenance);
  console.log(`entry still written to ${path.join(outDir, STILL_FILE)}`);
  console.log(provenance);
} finally {
  await browser.close();
  server.child.kill();
}
