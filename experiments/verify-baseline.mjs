// Verify the screenshot baseline is reproducible: capture the same views twice into two
// temp directories and assert pixel-level equality between the runs.
//
//   node experiments/verify-baseline.mjs
//
// Exit code 0 when every compared view is pixel-identical (max per-pixel channel diff 0),
// 1 otherwise. Against an app without the dev-only capture mode this MUST fail: uTime and
// the twinkle phases accumulate from the wall clock and auto-rotate keeps moving the
// camera, so two runs cannot match.
import os from 'node:os';
import path from 'node:path';
import { readFile, rm } from 'node:fs/promises';
import { chromium } from 'playwright';
import {
  VIEWS,
  captureViews,
  freePort,
  pixelDiffPngs,
  startDevServer,
} from './baseline-harness.mjs';

// Two views are enough to prove the point: one default framing (WebGL time, twinkle,
// bloom) and one rotated camera pose.
const VERIFY_VIEWS = VIEWS.filter((view) => view.name === 'default' || view.name === 'az90');

const port = await freePort();
const server = await startDevServer(port);
const runA = path.join(os.tmpdir(), `mira-baseline-verify-a-${process.pid}`);
const runB = path.join(os.tmpdir(), `mira-baseline-verify-b-${process.pid}`);

let exitCode = 0;
try {
  console.log(`verifying against ${server.baseUrl} (views: ${VERIFY_VIEWS.map((v) => v.name).join(', ')})`);
  await captureViews({ baseUrl: server.baseUrl, outDir: runA, views: VERIFY_VIEWS });
  await captureViews({ baseUrl: server.baseUrl, outDir: runB, views: VERIFY_VIEWS });

  const browser = await chromium.launch({ headless: true });
  try {
    for (const view of VERIFY_VIEWS) {
      const fileA = await readFile(path.join(runA, `${view.name}.png`));
      const fileB = await readFile(path.join(runB, `${view.name}.png`));
      if (fileA.equals(fileB)) {
        console.log(`PASS ${view.name}: byte-identical`);
        continue;
      }
      const diff = await pixelDiffPngs(browser, fileA, fileB);
      if (diff.error) {
        console.log(`FAIL ${view.name}: ${diff.error}`);
        exitCode = 1;
        continue;
      }
      const status = diff.maxDiff === 0 ? 'PASS' : 'FAIL';
      if (diff.maxDiff !== 0) exitCode = 1;
      console.log(
        `${status} ${view.name}: max per-pixel channel diff ${diff.maxDiff}/255, ` +
        `${diff.diffPixels}/${diff.totalPixels} pixels differ`,
      );
    }
  } finally {
    await browser.close();
  }
} finally {
  server.child.kill();
  await rm(runA, { recursive: true, force: true });
  await rm(runB, { recursive: true, force: true });
}

if (exitCode !== 0) {
  console.log('verify-baseline: FAIL — two identical captures did not match pixel for pixel');
} else {
  console.log('verify-baseline: PASS — two identical captures are pixel-identical');
}
process.exit(exitCode);
