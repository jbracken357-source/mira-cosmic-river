// Opening phase captures (#28, ticket 03): deterministic screenshots of the full
// cinematic, frozen at chosen instants by the dev-only `?capture=1&cinematic-t=<ms>`
// pin (src/lib/captureMode.ts + src/lib/openingTimeline.ts).
//
//   node experiments/capture-opening-28.mjs
//
// Writes docs/design-audit-2026-09-17/baselines/opening-28/ with one PNG per phase
// (desktop 0s/3s/6s/9s/13s, portrait 1s/6s/9s) plus a manifest.json recording the
// epoch, seeds, phase instants and camera poses. Boots its own dev server on a free
// port; safe to run while nothing else is running.
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import {
  BASELINE_EPOCH,
  DESKTOP_VIEWPORT,
  PORTRAIT_VIEWPORT,
  buildManifest,
  freePort,
  gitCommit,
  sceneResourcesReady,
  startDevServer,
  writeManifest,
} from './baseline-harness.mjs';

const OUT_DIR = path.join('docs', 'design-audit-2026-09-17', 'baselines', 'opening-28');

// 起 hold → 中 pull-back / river pass → tail reveal → 末 settle, one still per beat.
const PHASES = [
  { name: 't0-hold', ms: 0, viewport: DESKTOP_VIEWPORT },
  { name: 't3-stars', ms: 3000, viewport: DESKTOP_VIEWPORT },
  { name: 't6-river-pass', ms: 6000, viewport: DESKTOP_VIEWPORT },
  { name: 't9-tail-reveal', ms: 9000, viewport: DESKTOP_VIEWPORT },
  { name: 't13-settle', ms: 13000, viewport: DESKTOP_VIEWPORT },
  { name: 'portrait-t1-hold', ms: 1000, viewport: PORTRAIT_VIEWPORT },
  { name: 'portrait-t6-river-pass', ms: 6000, viewport: PORTRAIT_VIEWPORT },
  { name: 'portrait-t9-tail-reveal', ms: 9000, viewport: PORTRAIT_VIEWPORT },
];

const port = await freePort();
const server = await startDevServer(port);
const browser = await chromium.launch({ headless: true });
const views = [];
try {
  console.log(`capturing opening phases from ${server.baseUrl} into ${OUT_DIR}`);
  for (const phase of PHASES) {
    const context = await browser.newContext({ viewport: phase.viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.clear();
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    });
    const url = `${server.baseUrl}/?capture=1&epoch=${encodeURIComponent(BASELINE_EPOCH)}&cinematic-t=${phase.ms}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    // The opening waits on the entry gate: the overlay mounts when the gate opens.
    await page.getByTestId('cinematic-overlay').waitFor({ timeout: 30_000 });
    const texturesReady = await sceneResourcesReady(page);
    if (!texturesReady) {
      throw new Error(`scene resources never reported ready for phase "${phase.name}"`);
    }
    // Captions and the final title are JS-driven fades (Framer Motion); the frozen
    // clock holds them in place, so a wall-clock settle lets them reach full opacity.
    await page.waitForTimeout(2500);
    const file = `${phase.name}.png`;
    await page.screenshot({ path: path.join(OUT_DIR, file) });
    views.push({
      name: phase.name,
      file,
      cinematicT: phase.ms,
      viewport: phase.viewport,
      deviceScaleFactor: 1,
      texturesReady,
      pageErrors: errors,
    });
    console.log(`  ${file}${errors.length ? ' — page errors: ' + errors.join('; ') : ''}`);
    await context.close();
  }
  const manifest = {
    ...buildManifest({ label: 'opening-28', views }),
    url: `/?capture=1&epoch=${encodeURIComponent(BASELINE_EPOCH)}&cinematic-t=<ms>`,
    note: 'full cinematic frozen by ?capture=1&cinematic-t=<ms>; camera poses come from src/lib/openingTimeline.ts',
    gitCommit: gitCommit(),
  };
  await mkdir(OUT_DIR, { recursive: true });
  await writeManifest(OUT_DIR, manifest);
  console.log(`opening phases captured at ${manifest.gitCommit ?? 'unknown commit'}`);
} finally {
  await browser.close();
  server.child.kill();
}
