// Cold-start / parse measurement for ticket 08 (#24).
//
//   npm run build && node experiments/measure-cold-start.mjs
//
// Serves the PRODUCTION build (vite preview — real bundle, real parse cost) and
// loads it cold in N fresh browser contexts. Per run it records, from
// performance navigation/resource timing plus the app's own probe
// (window.__miraEntry, written by src/components/Scene/Scene.tsx):
//
//   responseEnd          HTML fully arrived
//   mainJsMs             download + ... of the main bundle (resource timing)
//   domContentLoaded     parse + module eval done enough for DCL
//   contextCreatedMs     navigation start -> WebGL context created (onCreated)
//   firstFrameMs         navigation start -> first COMPLETED frame (the first
//                        presentable picture; the SPEC-relevant point)
//
// The verdict line feeds the SPEC decision "测量冷启动和解析后再拆分加载":
// splitting the bundle is justified only if these numbers say the monolith is
// what keeps the first frame late — chunk counts are not evidence.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { freePort } from './baseline-harness.mjs';

const RUNS = 5;

function startPreviewServer(port) {
  const child = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return child;
}

async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`preview server exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('preview server did not start within 60s');
}

const port = await freePort();
const child = startPreviewServer(port);
const baseUrl = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ headless: true });
const runs = [];
try {
  await waitForServer(baseUrl, child);
  for (let i = 0; i < RUNS; i++) {
    // A fresh context per run: no HTTP cache, no warm module graph in the page.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${baseUrl}/?quality=low`, { waitUntil: 'load' });
    await page.waitForFunction(() => {
      const probe = window.__miraEntry;
      return probe && typeof probe.firstFrameMs === 'number';
    }, null, { timeout: 30_000 });
    const sample = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const mainJs = performance.getEntriesByType('resource')
        .filter((entry) => entry.name.endsWith('.js'))
        .sort((a, b) => b.transferSize - a.transferSize)[0];
      return {
        firstFrameMs: window.__miraEntry.firstFrameMs,
        contextCreatedMs: window.__miraEntry.contextCreatedMs,
        responseEnd: Math.round(nav.responseEnd),
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
        loadEvent: Math.round(nav.loadEventEnd),
        mainJsTransferKb: Math.round((mainJs?.transferSize ?? 0) / 1024),
        mainJsMs: Math.round(mainJs?.duration ?? 0),
      };
    });
    runs.push(sample);
    console.log(`run ${i + 1}:`, JSON.stringify(sample));
    await context.close();
  }
} finally {
  await browser.close();
  child.kill();
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const summary = {
  runs: RUNS,
  firstFrameMs: median(runs.map((r) => r.firstFrameMs)),
  contextCreatedMs: median(runs.map((r) => r.contextCreatedMs)),
  responseEnd: median(runs.map((r) => r.responseEnd)),
  domContentLoaded: median(runs.map((r) => r.domContentLoaded)),
  loadEvent: median(runs.map((r) => r.loadEvent)),
  mainJsTransferKb: median(runs.map((r) => r.mainJsTransferKb)),
  mainJsMs: median(runs.map((r) => r.mainJsMs)),
};
console.log('median:', JSON.stringify(summary, null, 2));
