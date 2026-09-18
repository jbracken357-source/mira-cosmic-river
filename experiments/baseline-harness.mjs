// Shared harness for reproducible screenshot baselines (design-audit ticket 01).
//
// One server, one browser, one frozen sky: boots its own vite dev server on a free port,
// then captures the baseline view set. Everything that could vary between runs is pinned
// either here or by the app's dev-only capture mode (`?capture=1`, src/lib/captureMode.ts):
//
//   date            -> ?epoch=BASELINE_EPOCH (pinned star clock, dev-only)
//   random seeds    -> fixed in code (StarField mulberry32 0x5eed1a, the tail LCG 17,
//                      MaterialStream index hash)
//   camera          -> ?cam=<preset> applied after the scene is ready, auto-rotate off
//   animation phase -> all uTime-style uniforms frozen at CAPTURE_TIME
//   twinkle         -> StarField uTime frozen, so the twinkle phase never advances
//   quality tier    -> navigator.deviceMemory/hardwareConcurrency pinned to 8 ("high")
//   CSS animation   -> a style tag kills animations/transitions (e.g. the pulsing dot)
//
// Used by capture-baseline.mjs (writes a labelled baseline set) and verify-baseline.mjs
// (captures twice and asserts pixel equality).
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

export const BASELINE_EPOCH = '2026-09-12T00:00:00Z';
export const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
export const PORTRAIT_VIEWPORT = { width: 390, height: 844 };

// The full baseline view set: default framing, a near view of the pair, three rotated
// azimuths, the portrait composition, and the reduced-motion path.
export const VIEWS = [
  { name: 'default', cam: 'default', viewport: DESKTOP_VIEWPORT },
  { name: 'near', cam: 'near', viewport: DESKTOP_VIEWPORT },
  { name: 'az90', cam: 'az90', viewport: DESKTOP_VIEWPORT },
  { name: 'az180', cam: 'az180', viewport: DESKTOP_VIEWPORT },
  { name: 'az270', cam: 'az270', viewport: DESKTOP_VIEWPORT },
  { name: 'portrait', cam: 'default', viewport: PORTRAIT_VIEWPORT },
  { name: 'reduced-motion', cam: 'default', viewport: DESKTOP_VIEWPORT, reducedMotion: 'reduce' },
];

export function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

// The production counterpart of startDevServer: serve `dist` (run `npm run build`
// first) for measurements that must see the real bundle — cold start, quality.
export function startPreviewServer(port) {
  return spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

export async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('server did not start within 60s');
}

export async function startDevServer(port) {  // Spawn vite's JS entry directly so killing the child kills the server (no npm shim
  // orphaning a process on Windows).
  const child = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let log = '';
  child.stdout.on('data', (chunk) => { log += chunk; });
  child.stderr.on('data', (chunk) => { log += chunk; });

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`dev server exited with ${child.exitCode}\n${log}`);
    }
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) return { child, baseUrl, log: () => log };
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  child.kill();
  throw new Error(`dev server did not start within 120s\n${log}`);
}

// Every baseline page gets the same starting state: direct entry (the full cinematic
// belongs to the ritual moment, not a baseline) and the device capabilities pinned so
// the quality tier resolves to "high" on any machine.
export function baselineInitScript() {
  localStorage.clear();
  localStorage.setItem('mira:seen-opening', '1');
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
}

// Wait until the explore UI is mounted and the milestone hint has finished its
// self-dismiss cycle. The hint self-dismisses 8s after it arms, and Framer Motion
// animates it in JS, which the freeze CSS cannot stop — so it must be gone from the
// DOM before the screenshot, never mid-fade.
export async function waitForExploreReady(page) {
  await page.getByTestId('explore-ui').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(300);
  const hint = page.getByTestId('milestone-hint');
  if ((await hint.count()) > 0) {
    await hint.waitFor({ state: 'detached', timeout: 20_000 }).catch(() => {});
  }
}

// Kill animations and transitions (the explore UI has a pulsing dot) so the DOM overlay
// is as frozen as the WebGL scene.
const FREEZE_CSS = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
  }
`;

export async function sceneResourcesReady(page) {
  // Best effort: inspect the mounted scene the same way capture-integration.mjs does.
  // Falls back to a plain wait when the vite dep bundle is not where we expect it.
  const probe = () => page.waitForFunction(async () => {
    const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js');
    const state = _roots.get(document.querySelector('canvas'))?.store.getState();
    if (!state) return false;
    const veil = state.scene.getObjectByName('river-veil');
    if (!veil || veil.children.some((mesh) => mesh.material.uniforms.uReady.value !== 1)) {
      return false;
    }
    let surfaceReady = 0;
    state.scene.traverse((object) => {
      if (object.material?.uniforms?.uSurfaceReady) {
        surfaceReady = object.material.uniforms.uSurfaceReady.value;
      }
    });
    return surfaceReady === 1;
  }, null, { timeout: 10_000 }).then(() => true, () => false);
  if (await probe()) return true;
  // On a loaded machine the first paint (shader compile, texture upload) can outlast
  // a probe; keep re-probing with pauses before declaring the textures missing.
  // Returning false is only honest after real patience — a degraded screenshot must
  // never be mistaken for a ready one.
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.waitForTimeout(2000);
    if (await probe()) return true;
  }
  return false;
}

async function readCameraPose(page) {
  try {
    return await page.evaluate(async () => {
      const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js');
      const state = _roots.get(document.querySelector('canvas'))?.store.getState();
      if (!state) return null;
      const camera = state.camera;
      return {
        position: camera.position.toArray().map((n) => Number(n.toFixed(4))),
        fov: Number(camera.fov.toFixed(4)),
      };
    });
  } catch {
    return null;
  }
}

// Capture the given views into outDir. Returns the manifest (also written by the caller).
export async function captureViews({ baseUrl, outDir, views = VIEWS }) {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const manifestViews = [];
  try {
    for (const view of views) {
      const context = await browser.newContext({
        viewport: view.viewport,
        deviceScaleFactor: 1,
        reducedMotion: view.reducedMotion ?? 'no-preference',
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(baselineInitScript);
      const url = `${baseUrl}/?capture=1&epoch=${encodeURIComponent(BASELINE_EPOCH)}&cam=${view.cam}`;
      await page.goto(url, { waitUntil: 'networkidle' });
      await waitForExploreReady(page);
      await page.addStyleTag({ content: FREEZE_CSS });
      const texturesReady = await sceneResourcesReady(page);
      // A degraded capture is not a baseline: fail loudly instead of writing a shot
      // whose pixels silently came from the fallback path.
      if (!texturesReady) {
        throw new Error(`scene resources never reported ready for view "${view.name}"`);
      }
      // Web fonts can swap after the settle window on a loaded machine; wait for the
      // font pipeline to be quiet so header text renders identically across runs.
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      // Let the first frozen frames settle (bloom chain warm-up, font swap).
      await page.waitForTimeout(1200);
      const file = `${view.name}.png`;
      await page.screenshot({ path: path.join(outDir, file) });
      const pose = await readCameraPose(page);
      manifestViews.push({
        name: view.name,
        file,
        cam: view.cam,
        viewport: view.viewport,
        deviceScaleFactor: 1,
        reducedMotion: view.reducedMotion === 'reduce',
        texturesReady,
        cameraPose: pose,
        pageErrors: errors,
      });
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return manifestViews;
}

export function gitCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

export function buildManifest({ label, views }) {
  return {
    label,
    epoch: BASELINE_EPOCH,
    captureTimeSeconds: 8,
    seeds: {
      starField: 'mulberry32:0x5eed1a',
      miraTail: 'lcg:17',
      materialStream: 'index-sin-hash',
    },
    qualityTier: 'high (navigator.deviceMemory/hardwareConcurrency pinned to 8)',
    url: `/?capture=1&epoch=${encodeURIComponent(BASELINE_EPOCH)}&cam=<preset>`,
    gitCommit: gitCommit(),
    views,
  };
}

export async function writeManifest(outDir, manifest) {
  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}

// Decode two PNG buffers in a headless page and compare pixel by pixel. PNG decode and
// canvas read-back are lossless for the opaque screenshots playwright produces.
export async function pixelDiffPngs(browser, bufferA, bufferB) {
  const page = await browser.newPage();
  try {
    return await page.evaluate(async ([a64, b64]) => {
      const load = (data) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('png decode failed'));
        img.src = `data:image/png;base64,${data}`;
      });
      const [imgA, imgB] = await Promise.all([load(a64), load(b64)]);
      if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
        return { error: `size mismatch: ${imgA.width}x${imgA.height} vs ${imgB.width}x${imgB.height}` };
      }
      const pixels = (img) => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        return canvas.getContext('2d').getImageData(0, 0, img.width, img.height).data;
      };
      const dataA = pixels(imgA);
      const dataB = pixels(imgB);
      let maxDiff = 0;
      let diffPixels = 0;
      for (let i = 0; i < dataA.length; i += 4) {
        const diff = Math.max(
          Math.abs(dataA[i] - dataB[i]),
          Math.abs(dataA[i + 1] - dataB[i + 1]),
          Math.abs(dataA[i + 2] - dataB[i + 2]),
        );
        if (diff > 0) {
          diffPixels += 1;
          if (diff > maxDiff) maxDiff = diff;
        }
      }
      return { maxDiff, diffPixels, totalPixels: dataA.length / 4 };
    }, [bufferA.toString('base64'), bufferB.toString('base64')]);
  } finally {
    await page.close();
  }
}
