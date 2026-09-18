// Representative-date evidence for the daily sky (issue #27).
//
//   node experiments/capture-daily-sky.mjs
//
// Captures the default framing at four phases of one pulsation cycle — near maximum,
// mid-decline, near minimum, mid-rise — through the same frozen-moment harness as every
// other baseline, with only `?epoch=` varying between the shots. The baseline epoch itself
// (CAPTURE_EPOCH_ISO) is untouched: these dates are passed explicitly per capture.
//
// Besides the PNGs, the manifest records the sky attributes the page reported for each
// date plus quantitative frame statistics (mean luma of the whole frame; mean luma and
// warmth of the tail region), so "the nights differ, subtly" is a number, not an opinion.
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import {
  DESKTOP_VIEWPORT,
  buildManifest,
  captureViews,
  freePort,
  startDevServer,
  writeManifest,
} from './baseline-harness.mjs';

// The star-clock constants (src/lib/starClock.ts is the source of truth; this script is
// plain ESM and cannot import the TS). Cycle 16 is the cycle the baseline date
// 2026-09-12 falls in, so the comparison stays close to the tuned present.
const DAY_MS = 86_400_000;
const MAXIMUM_EPOCH_MS = Date.UTC(2011, 8, 25);
const PERIOD_DAYS = 331.96;
const RISE_DAYS = 100;
const CYCLE = 16;
const DECLINE_FRACTION = 1 - RISE_DAYS / PERIOD_DAYS;
const CYCLE_MAXIMUM_MS = MAXIMUM_EPOCH_MS + CYCLE * PERIOD_DAYS * DAY_MS;

const EPOCHS = [
  { name: 'near-maximum', ms: CYCLE_MAXIMUM_MS },
  { name: 'mid-decline', ms: CYCLE_MAXIMUM_MS + (DECLINE_FRACTION / 2) * PERIOD_DAYS * DAY_MS },
  { name: 'near-minimum', ms: CYCLE_MAXIMUM_MS + DECLINE_FRACTION * PERIOD_DAYS * DAY_MS },
  { name: 'mid-rise', ms: CYCLE_MAXIMUM_MS + (DECLINE_FRACTION + (1 - DECLINE_FRACTION) / 2) * PERIOD_DAYS * DAY_MS },
];

// The tail region of the default framing (veil and tail points live left of the pair).
const TAIL_REGION = { x0: 0.02, x1: 0.55, y0: 0.15, y1: 0.85 };

// Decode a PNG in a headless page and measure it: mean luma of the whole frame, and mean
// luma plus a warmth proxy (mean R−B) inside the tail region. Lossless decode, same
// technique as pixelDiffPngs in the harness.
async function measurePng(browser, buffer) {
  const page = await browser.newPage();
  try {
    return await page.evaluate(async ([b64, region]) => {
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('png decode failed'));
        image.src = `data:image/png;base64,${b64}`;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, img.width, img.height).data;
      const luma = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      let frameSum = 0;
      let tailSum = 0;
      let warmthSum = 0;
      let tailPixels = 0;
      const x0 = Math.floor(region.x0 * img.width);
      const x1 = Math.floor(region.x1 * img.width);
      const y0 = Math.floor(region.y0 * img.height);
      const y1 = Math.floor(region.y1 * img.height);
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const i = (y * img.width + x) * 4;
          frameSum += luma(i);
          if (x >= x0 && x < x1 && y >= y0 && y < y1) {
            tailSum += luma(i);
            warmthSum += data[i] - data[i + 2];
            tailPixels += 1;
          }
        }
      }
      const total = img.width * img.height;
      return {
        frameLuma: frameSum / total,
        tailLuma: tailSum / tailPixels,
        tailWarmth: warmthSum / tailPixels,
      };
    }, [buffer.toString('base64'), TAIL_REGION]);
  } finally {
    await page.close();
  }
}

const outDir = path.join('docs', 'design-audit-2026-09-17', 'baselines', 'daily-sky-27');
const port = await freePort();
const server = await startDevServer(port);
try {
  const views = [];
  for (const epoch of EPOCHS) {
    const iso = new Date(epoch.ms).toISOString();
    const captured = await captureViews({
      baseUrl: server.baseUrl,
      outDir,
      views: [{ name: epoch.name, cam: 'default', viewport: DESKTOP_VIEWPORT }],
      epoch: iso,
    });
    views.push({ ...captured[0], epoch: iso });
    console.log(`captured ${epoch.name} (${iso})`);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    for (const view of views) {
      view.stats = await measurePng(browser, await readFile(path.join(outDir, view.file)));
    }
  } finally {
    await browser.close();
  }

  const manifest = {
    ...buildManifest({ label: 'daily-sky-27', views, epoch: '<per view: see views[].epoch>' }),
    purpose: 'Representative dates of one pulsation cycle (issue #27): same camera, same frozen animation phase, only the star clock differs.',
    tailRegion: TAIL_REGION,
  };
  await writeManifest(outDir, manifest);

  console.log('\nepoch            brightness  density  frameLuma  tailLuma  tailWarmth(R-B)');
  for (const view of views) {
    console.log(
      `${view.name.padEnd(16)} ${String(view.sky?.brightness).padEnd(11)} ${String(view.sky?.density).padEnd(8)} ` +
      `${view.stats.frameLuma.toFixed(3).padStart(9)}  ${view.stats.tailLuma.toFixed(3).padStart(8)}  ${view.stats.tailWarmth.toFixed(3).padStart(9)}`,
    );
  }
} finally {
  server.child.kill();
}
