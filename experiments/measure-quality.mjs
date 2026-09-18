// Real-GPU quality measurement for ticket 09 (#26).
//
//   npm run build && node experiments/measure-quality.mjs
//
// Serves the PRODUCTION build (vite preview) and drives a HEADED Chromium on the
// machine's real GPU — the SPEC is explicit that software rendering is not
// performance evidence. The run follows the SPEC's long-run protocol:
//
//   idle       ~2min untouched viewing (the auto camera resumes naturally)
//   drag       ~30s of continuous dragging
//   background the real window is minimised through CDP for ~20s, then restored
//   watch      ~5min continuous viewing (long-run frame times, resource growth)
//   throttle   CDP CPU throttling forces real slow frames, so the governor's
//              tier changes are recorded on real hardware; then the throttle
//              lifts and recovery behaviour is observed
//
// All numbers come from the app's own always-on recorder (window.__miraQuality,
// src/lib/qualityGovernor.ts): per-frame times, tier change events, and 5s
// resource samples (geometries / textures / JS heap / dpr / resolution / tier).
// Output: docs/design-audit-2026-09-17/evidence/quality-26.json + a console summary.
//
// QUALITY_MEASURE_PROFILE=short runs a ~2min smoke of the same protocol.
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { freePort, startPreviewServer, waitForServer } from './baseline-harness.mjs';

const PROFILE =
  process.env.QUALITY_MEASURE_PROFILE === 'short'
    ? { idle: 15_000, drag: 10_000, background: 8_000, watch: 20_000, throttle: 20_000, recovery: 25_000 }
    : { idle: 120_000, drag: 30_000, background: 20_000, watch: 300_000, throttle: 30_000, recovery: 40_000 };

const SAMPLE_EVERY_MS = 5000;
const OUT_FILE = 'docs/design-audit-2026-09-17/evidence/quality-26.json';

// A tiny pointer jiggle every sample keeps Windows from turning the display off
// mid-run (a sleeping screen throttles the very frames being measured). It never
// lands on a control, and mousemove is deliberately not intentional input, so the
// scene behaves exactly as if untouched.
let jiggleCount = 0;
async function keepAwake(page) {
  jiggleCount += 1;
  await page.mouse.move(jiggleCount % 2 === 0 ? 4 : 6, 6);
}

function readGpuStrings(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { renderer: null, vendor: null };
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      vendor: info ? gl.getParameter(info.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    };
  });
}

function sample(page) {
  return page.evaluate(() => {
    const q = window.__miraQuality;
    const canvas = document.querySelector('canvas');
    return {
      at: Math.round(performance.now()),
      frames: q.frameCount(),
      stats: q.frameStats(),
      changes: q.changes.slice(),
      lastResource: q.resources[q.resources.length - 1] ?? null,
      tier: canvas?.dataset.qualityTier ?? null,
      lastChange: canvas?.dataset.qualityLastChange ?? null,
    };
  });
}

// Run one phase: sample every few seconds until the duration elapses, while the
// optional activity callback keeps the phase's interaction going.
async function runPhase(name, durationMs, page, timeline, activity) {
  console.log(`[phase] ${name} for ${Math.round(durationMs / 1000)}s`);
  const started = Date.now();
  const first = await sample(page);
  while (Date.now() - started < durationMs) {
    if (activity) await activity();
    else await keepAwake(page);
    await new Promise((resolve) => setTimeout(resolve, SAMPLE_EVERY_MS));
    const point = await sample(page);
    point.phase = name;
    timeline.push(point);
  }
  const last = await sample(page);
  const frames = last.frames - first.frames;
  const seconds = (Date.now() - started) / 1000;
  const summary = {
    name,
    durationMs: Date.now() - started,
    framesRendered: frames,
    meanFps: frames > 0 ? Math.round((frames / seconds) * 10) / 10 : 0,
    stats: last.stats,
    tierAtEnd: last.tier,
    changesDuring: last.changes.filter((c) => c.at >= first.at),
    resourcesStart: first.lastResource,
    resourcesEnd: last.lastResource,
  };
  console.log(
    `[phase] ${name} done: ${frames} frames, mean ${summary.meanFps}fps, tier=${summary.tierAtEnd}, changes=${summary.changesDuring.length}`,
  );
  return summary;
}

const port = await freePort();
const child = startPreviewServer(port);
const baseUrl = `http://127.0.0.1:${port}`;
// Headed on purpose: the machine's real GPU does the rendering, and the window
// can genuinely be minimised for the background phase.
const browser = await chromium.launch({ headless: false });
const phases = [];
const timeline = [];
let gpu = null;

try {
  await waitForServer(baseUrl, child);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('mira:seen-opening', '1');
  });

  gpu = await (async () => {
    await page.goto('about:blank');
    return readGpuStrings(page);
  })();
  console.log('[gpu]', JSON.stringify(gpu));
  if (!gpu.renderer || /swiftshader|llvmpipe|software/i.test(gpu.renderer)) {
    throw new Error(`software rendering detected (${gpu.renderer}) — not valid performance evidence; run on a real GPU`);
  }

  await page.goto(`${baseUrl}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas');
    return window.__miraQuality && canvas && canvas.dataset.qualityTier;
  }, null, { timeout: 30_000 });
  // The scene renders its own first frames; give shaders a moment to settle.
  await page.waitForTimeout(3000);

  phases.push(await runPhase('idle', PROFILE.idle, page, timeline));

  phases.push(
    await runPhase('drag', PROFILE.drag, page, timeline, async () => {
      // One slow arc per call; together they make ~30s of continuous dragging.
      await page.mouse.move(720, 450);
      await page.mouse.down();
      for (let i = 0; i <= 24; i += 1) {
        const angle = (i / 24) * Math.PI * 2;
        await page.mouse.move(720 + Math.cos(angle) * 240, 450 + Math.sin(angle) * 140, { steps: 2 });
      }
      await page.mouse.up();
    }),
  );

  // Background: minimise the real window through CDP, so the OS and the browser
  // produce a genuine visibilitychange — not a synthetic getter override. (Opening
  // a second tab does NOT hide the first in Playwright's headed windows; that was
  // tried and the scene kept being throttled-but-visible.)
  const cdp = await context.newCDPSession(page);
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  const beforeHide = await sample(page);
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
  await new Promise((resolve) => setTimeout(resolve, PROFILE.background));
  const duringHide = await sample(page);
  const hiddenState = await page.evaluate(() => document.visibilityState);
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
  await page.bringToFront();
  await page.waitForTimeout(3000);
  const afterShow = await sample(page);
  const backgroundSummary = {
    name: 'background',
    durationMs: PROFILE.background,
    visibilityWhileMinimized: hiddenState,
    framesWhileHidden: duringHide.frames - beforeHide.frames,
    framesAfterReturn: afterShow.frames - duringHide.frames,
    changesDuring: afterShow.changes.filter((c) => c.at >= beforeHide.at),
  };
  console.log('[phase] background done:', JSON.stringify(backgroundSummary));
  phases.push(backgroundSummary);

  phases.push(await runPhase('watch', PROFILE.watch, page, timeline));

  // Forced slow frames on real hardware: 10x CPU throttling through CDP. If even
  // that cannot push P75 past the downgrade threshold, the headroom is the story.
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 10 });
  phases.push(await runPhase('throttle-10x', PROFILE.throttle, page, timeline));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  phases.push(await runPhase('recovery', PROFILE.recovery, page, timeline));

  await context.close();
} finally {
  await browser.close();
  child.kill();
}

const report = {
  ticket: '#26 adaptive quality',
  recordedAt: new Date().toISOString(),
  environment: {
    headed: true,
    gpu,
    viewport: { width: 1440, height: 900 },
    build: 'production (vite preview)',
    profile: process.env.QUALITY_MEASURE_PROFILE === 'short' ? 'short' : 'full',
  },
  phases,
  timeline,
};
await mkdir('docs/design-audit-2026-09-17/evidence', { recursive: true });
await writeFile(OUT_FILE, JSON.stringify(report, null, 2));
console.log(`\nwrote ${OUT_FILE}`);
for (const p of phases) {
  console.log(
    `${p.name.padEnd(14)} frames=${p.framesRendered ?? '-'} fps=${p.meanFps ?? '-'} tier=${p.tierAtEnd ?? '-'} changes=${(p.changesDuring ?? []).length}`,
  );
}
