// Evidence for a change to the top bar backing (#148): before/after of the moment it
// mounts and leaves, and proof that nothing else moved.
//
//   node experiments/backing-fade-evidence.mjs steady <base-checkout> <head-checkout> <out-dir>
//   node experiments/backing-fade-evidence.mjs strips <base-dist> <head-dist> <out-dir> <base-label> <head-label>
//   node experiments/backing-fade-evidence.mjs sheets <out-dir> <base-label> <head-label>
//
// `steady` captures four frozen views through baseline-harness.mjs on each checkout's
// dev server and prints the pixel diff per view. The backing only exists on the tall
// narrow frame, so desktop is in the set to show it is still left out.
//
// `strips` serves both production builds with serve-dist.mjs and plays the same
// inputs on each: a phone frame at 390×844, real GPU headless Chromium. It keeps
// every frame with its page time, writes one strip per moment, before above after,
// at the same offsets from the moment the backing mounts or starts to leave, each
// frame labelled with the backing's computed opacity. With ffmpeg on PATH it also
// writes one side-by-side video per moment that has a ramp, real time then four
// times slower.
// `sheets` writes the strips again from a `strips` run, without a new capture.
// A label may hold one "|": a line break in the strips, a middle dot in the videos.
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------- steady ----

async function steady(baseDir, headDir, out) {
  const harness = await import('./baseline-harness.mjs');
  // The frame docs/evidence-137 used: brightness maximum, the hardest backdrop.
  const epoch = '2026-04-10T12:00:00Z';
  const views = [
    { name: 'portrait390-default', cam: 'default', viewport: harness.PORTRAIT_VIEWPORT },
    { name: 'portrait390-near', cam: 'near', viewport: harness.PORTRAIT_VIEWPORT },
    { name: 'portrait390-near-reduced', cam: 'near', viewport: harness.PORTRAIT_VIEWPORT, reducedMotion: 'reduce' },
    { name: 'desktop1440-near', cam: 'near', viewport: harness.DESKTOP_VIEWPORT },
  ];

  async function startVite(dir, port) {
    const child = spawn(
      process.execPath,
      ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
      { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let log = '';
    child.stdout.on('data', (chunk) => { log += chunk; });
    child.stderr.on('data', (chunk) => { log += chunk; });
    const baseUrl = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`dev server in ${dir} exited with ${child.exitCode}\n${log}`);
      try {
        const response = await fetch(`${baseUrl}/`);
        if (response.ok) return { child, baseUrl };
      } catch {
        // Not up yet.
      }
      await sleep(400);
    }
    child.kill();
    throw new Error(`dev server in ${dir} did not start\n${log}`);
  }

  // Is the backing there at all in this view, once everything has settled?
  async function probeBacking(browser, baseUrl, view) {
    const context = await browser.newContext({
      viewport: view.viewport,
      deviceScaleFactor: 1,
      reducedMotion: view.reducedMotion ?? 'no-preference',
    });
    const page = await context.newPage();
    await page.addInitScript(harness.baselineInitScript);
    await page.goto(`${baseUrl}/?capture=1&epoch=${encodeURIComponent(epoch)}&cam=${view.cam}`, { waitUntil: 'networkidle' });
    await harness.waitForExploreReady(page);
    await page.waitForTimeout(2000);
    const read = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="top-bar-backing"]');
      return el ? { present: true, opacity: getComputedStyle(el).opacity } : { present: false, opacity: null };
    });
    await context.close();
    return read;
  }

  const probes = {};
  for (const [label, dir] of [['base', baseDir], ['head', headDir]]) {
    const { child, baseUrl } = await startVite(dir, await harness.freePort());
    try {
      const browser = await chromium.launch({ headless: true });
      try {
        probes[label] = {};
        for (const view of views) probes[label][view.name] = await probeBacking(browser, baseUrl, view);
      } finally {
        await browser.close();
      }
      await harness.captureViews({ baseUrl, outDir: path.join(out, label), views, epoch });
    } finally {
      child.kill();
    }
  }
  console.log(`backing once settled: ${JSON.stringify(probes)}`);

  const browser = await chromium.launch({ headless: true });
  try {
    for (const view of views) {
      const a = await readFile(path.join(out, 'base', `${view.name}.png`));
      const b = await readFile(path.join(out, 'head', `${view.name}.png`));
      console.log(`${view.name}: base vs head ${JSON.stringify(await harness.pixelDiffPngs(browser, a, b))}`);
    }
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------- strips ----

const CLIP = { x: 0, y: 0, width: 390, height: 260 };
const OFFSETS = [-100, 0, 100, 200, 300, 450];
const FPS = 30;
const WINDOW = [-300, 900];
const SPEEDS = [
  { caption: 'real time', msPerFrame: 1000 / FPS, timeExpr: 'n*100/3-300' },
  // Four times slower: four output frames for every 33 ms of source time.
  { caption: '4x slow motion', msPerFrame: 1000 / FPS / 4, timeExpr: 'n*25/3-300' },
];
const FONT = process.platform === 'win32' ? "fontfile='C\\:/Windows/Fonts/arial.ttf'" : '';

// Runs in the page from the first document: one read of the backing's computed
// opacity per animation frame, and the frames where it mounts and unmounts.
const RECORDER = () => {
  const log = [];
  const events = [];
  let present = false;
  const tick = () => {
    const el = document.querySelector('[data-testid="top-bar-backing"]');
    const now = el !== null;
    const at = performance.now();
    if (now) log.push({ at, opacity: Number(getComputedStyle(el).opacity) });
    if (now && !present) events.push({ at, type: 'mount' });
    if (!now && present) events.push({ at, type: 'unmount' });
    present = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__fade = { log, events };
};

async function serve(dist, port) {
  const child = spawn(process.execPath, [path.join(here, 'serve-dist.mjs'), dist, String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${base}/`);
      if (response.ok) return { child, base };
    } catch {
      // Not up yet.
    }
    await sleep(200);
  }
  child.kill();
  throw new Error(`serve-dist did not start for ${dist}`);
}

async function shot(page) {
  const before = await page.evaluate(() => performance.now());
  const buffer = await page.screenshot({ clip: CLIP });
  const after = await page.evaluate(() => performance.now());
  return { at: (before + after) / 2, buffer };
}

async function burst(page, ms, gap = 0) {
  const frames = [];
  const end = Date.now() + ms;
  while (Date.now() < end) {
    frames.push(await shot(page));
    if (gap) await sleep(gap);
  }
  return frames;
}

async function touchDrag(context, page, from, to, steps) {
  const touch = await context.newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  for (let step = 1; step <= steps; step += 1) {
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from.x + (to.x - from.x) * step / steps, y: from.y + (to.y - from.y) * step / steps }],
    });
    await sleep(16);
  }
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

const mounted = (page) => page.evaluate(() => window.__fade.events.some((event) => event.type === 'mount'));

// The visit's first drag graduates the bar and, on this frame, carries the camera
// off the main view. Wheel steps stand by in case the drag alone does not.
async function leaveMainView(context, page) {
  const box = await page.locator('canvas').boundingBox();
  await touchDrag(
    context,
    page,
    { x: box.x + box.width * 0.5, y: box.y + box.height * 0.6 },
    { x: box.x + box.width * 0.58, y: box.y + box.height * 0.64 },
    8,
  );
  await sleep(700);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.6);
  for (let step = 0; step < 14; step += 1) {
    if (await mounted(page)) return;
    await page.mouse.wheel(0, -400);
    await sleep(350);
  }
}

async function newPage(browser, base, reduced) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  await context.addInitScript(() => localStorage.setItem('mira:seen-opening', '1'));
  await context.addInitScript(RECORDER);
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('explore-ui').waitFor({ timeout: 60_000 });
  await page.waitForTimeout(3500);
  return { context, page };
}

async function saveTake(outDir, name, frames, recorder, extra = {}) {
  await mkdir(path.join(outDir, name), { recursive: true });
  await Promise.all(frames.map((frame, index) => writeFile(path.join(outDir, name, `${String(index).padStart(3, '0')}.png`), frame.buffer)));
  // The frame times and the page's own record go with the frames, so the videos
  // can be cut from the same take.
  await writeFile(path.join(outDir, name, 'frames.json'), JSON.stringify({
    frames: frames.map(({ at }, index) => ({ file: `${String(index).padStart(3, '0')}.png`, at })),
    events: recorder.events,
    log: recorder.log,
    ...extra,
  }));
  return { dir: path.join(outDir, name), frames: frames.map(({ at }, index) => ({ file: `${String(index).padStart(3, '0')}.png`, at })), recorder, ...extra };
}

async function recordBuild(browser, base, outDir) {
  const build = {};

  // 1. The camera leaves the main view.
  {
    const { context, page } = await newPage(browser, base, false);
    const framesPromise = burst(page, 4000);
    await leaveMainView(context, page);
    build.enter = await saveTake(outDir, 'enter', await framesPromise, await page.evaluate(() => window.__fade));
    await sleep(1500);

    // 2. 「主视角」 brings the camera back.
    const tapAt = await page.evaluate(() => performance.now());
    const exitFrames = burst(page, 3200, 40);
    await page.getByTestId('return-to-view').tap();
    build.exit = await saveTake(outDir, 'exit', await exitFrames, await page.evaluate(() => window.__fade), { tapAt });

    // 3. No input from here: the idle creep carries the camera off again. The take
    // keeps the tap's page time, so the wait is on record.
    await page.waitForFunction((t) => performance.now() >= t, tapAt + 40_000, { polling: 200, timeout: 120_000 });
    const idleFrames = [];
    while (await page.evaluate((t) => performance.now() < t, tapAt + 58_000)) {
      idleFrames.push(await shot(page));
      await sleep(70);
    }
    build.idle = await saveTake(outDir, 'idle', idleFrames, await page.evaluate(() => window.__fade), { tapAt });
    await context.close();
  }

  // 4. The same first moment with reduced motion on.
  {
    const { context, page } = await newPage(browser, base, true);
    const framesPromise = burst(page, 4000);
    await leaveMainView(context, page);
    build.reduced = await saveTake(outDir, 'reduced', await framesPromise, await page.evaluate(() => window.__fade));
    await context.close();
  }
  return build;
}

const mountAt = (take) => take.recorder.events.find((event) => event.type === 'mount').at;
const lastMountAt = (take) => take.recorder.events.filter((event) => event.type === 'mount').at(-1).at;

// The instant the backing starts to leave: the first frame below full opacity, or
// the frame it is gone.
function exitStart(take) {
  const log = take.recorder.log.filter((entry) => entry.at >= take.tapAt);
  const full = log.findIndex((entry) => entry.opacity >= 0.999);
  const drop = log.slice(full).find((entry) => entry.opacity < 0.999);
  if (drop) return drop.at;
  return take.recorder.events.find((event) => event.type === 'unmount' && event.at >= take.tapAt).at;
}

function stateAt(recorder, at) {
  let present = false;
  for (const event of recorder.events) {
    if (event.at > at) break;
    present = event.type === 'mount';
  }
  if (!present) return { present, opacity: null };
  let nearest = recorder.log[0];
  for (const entry of recorder.log) {
    if (Math.abs(entry.at - at) < Math.abs(nearest.at - at)) nearest = entry;
  }
  return { present, opacity: nearest.opacity };
}

// The frames nearest to each offset, one frame per offset: where the capture rate
// dipped, two offsets would otherwise show the same frame twice.
function pick(take, anchor) {
  const used = new Set();
  return OFFSETS.map((offset) => {
    const want = anchor + offset;
    let frame = null;
    for (const candidate of take.frames) {
      if (used.has(candidate) || (frame && Math.abs(candidate.at - want) >= Math.abs(frame.at - want))) continue;
      frame = candidate;
    }
    used.add(frame);
    return { file: path.join(take.dir, frame.file), offset: Math.round(frame.at - anchor), ...stateAt(take.recorder, frame.at) };
  });
}

const MOMENTS = [
  ['enter', 'Enter: the camera leaves the main view. 390×844, the visit\'s first drag.', mountAt],
  ['exit', 'Exit: 「主视角」 brings the camera back. 390×844.', exitStart],
  ['idle', 'Idle creep: the camera leaves the main view on its own, about 46.5 s after the tap. 390×844.', lastMountAt],
  ['reduced', 'Reduced motion: the same first moment. 390×844.', mountAt],
];

async function renderMoments(browser, out, base, head, baseLabel, headLabel) {
  const secondsAfterTap = (take) => ((lastMountAt(take) - take.tapAt) / 1000).toFixed(1);
  console.log(`idle: the backing mounts ${secondsAfterTap(base.idle)} s after the tap (base), ${secondsAfterTap(head.idle)} s (head)`);
  for (const [name, title, anchorOf] of MOMENTS) {
    const cut = (build) => pick(build[name], anchorOf(build[name]));
    const rows = [[baseLabel, cut(base)], [headLabel, cut(head)]];
    for (const [label, frames] of rows) {
      console.log(`${name} ${label.replaceAll('|', ' ')}: ${frames.map((f) => `${f.offset}:${f.present ? f.opacity.toFixed(2) : 'absent'}`).join('  ')}`);
    }
    await strip(browser, path.join(out, `${name}.png`), title, rows);
  }
}

async function strip(browser, file, title, rows) {
  const tile = async (frame) => {
    const state = frame.present ? `opacity ${frame.opacity.toFixed(2)}` : 'absent';
    const image = (await readFile(frame.file)).toString('base64');
    return `<figure style="margin:0 6px"><img src="data:image/png;base64,${image}" width="390" height="260">
      <figcaption style="padding:4px 0 0;text-align:center">+${frame.offset} ms · ${state}</figcaption></figure>`;
  };
  const row = async ([label, frames]) => `<div style="display:flex;align-items:flex-start;margin:0 0 10px">
      <div style="width:126px;padding:108px 8px 0 0;text-align:right;font-weight:600">${label.replaceAll('|', '<br>')}</div>${(await Promise.all(frames.map(tile))).join('')}</div>`;
  const html = `<body style="margin:0;background:#0b0b0d;color:#e8e8ea;font:14px/1.35 system-ui,sans-serif">
    <div style="padding:12px 14px 10px;font-size:17px">${title}</div>${(await Promise.all(rows.map(row))).join('')}</body>`;
  const page = await browser.newPage({ viewport: { width: 2540, height: 700 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
}

const hasFfmpeg = () => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const draw = (options) => `drawtext=${FONT ? `${FONT}:` : ''}${options}`;

const half = (text, speed) => 'pad=390:300:0:40:color=0x0b0b0d,'
  + draw(`text='${text}':fontsize=18:fontcolor=0xe8e8ea:x=12:y=10`)
  + `,${draw(`text='${speed.caption}':fontsize=16:fontcolor=0xbdbdc2:x=w-tw-12:y=11`)}`
  + `,${draw(`text='t = %{eif\\:${speed.timeExpr}\\:d} ms':fontsize=16:fontcolor=0xbdbdc2:x=12:y=274`)}`;

// The frame shown is always the latest one captured at or before that instant.
function frameAt(take, time) {
  let chosen = take.frames[0];
  for (const frame of take.frames) {
    if (frame.at > time) break;
    chosen = frame;
  }
  return chosen;
}

async function sequence(take, anchor, speed, dir) {
  await mkdir(dir, { recursive: true });
  const count = Math.round((WINDOW[1] - WINDOW[0]) / speed.msPerFrame);
  for (let i = 0; i < count; i += 1) {
    const frame = frameAt(take, anchor + WINDOW[0] + i * speed.msPerFrame);
    await writeFile(path.join(dir, `${String(i + 1).padStart(4, '0')}.png`), await readFile(path.join(take.dir, frame.file)));
  }
  return path.join(dir, '%04d.png');
}

async function videos(out, base, head, baseLabel, headLabel) {
  if (!hasFfmpeg()) {
    console.log('ffmpeg not on PATH: strips only, no videos');
    return;
  }
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'backing-fade-'));
  try {
    // Reduced motion has no ramp to show, so its strip is the whole record.
    for (const [name, anchorOf] of [['enter', mountAt], ['exit', exitStart], ['idle', lastMountAt]]) {
      const segments = [];
      for (const [index, speed] of SPEEDS.entries()) {
        const inputs = [];
        for (const [take, anchor] of [[base[name], anchorOf(base[name])], [head[name], anchorOf(head[name])]]) {
          inputs.push(await sequence(take, anchor, speed, path.join(tmp, name, String(index), String(inputs.length))));
        }
        const segment = path.join(tmp, name, `segment-${index}.mp4`);
        execFileSync('ffmpeg', [
          '-y', '-loglevel', 'error',
          '-framerate', String(FPS), '-i', inputs[0],
          '-framerate', String(FPS), '-i', inputs[1],
          '-filter_complex',
          `[0:v]${half(baseLabel.replaceAll('|', ' · '), speed)}[a];[1:v]${half(headLabel.replaceAll('|', ' · '), speed)}[b];[a][b]hstack=inputs=2[v]`,
          '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-r', String(FPS),
          segment,
        ]);
        segments.push(segment);
      }
      // Re-encode on the join: a stream copy of two segments drops frames of the second one.
      execFileSync('ffmpeg', [
        '-y', '-loglevel', 'error',
        '-i', segments[0], '-i', segments[1],
        '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]',
        '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-r', String(FPS),
        path.join(out, `${name}.mp4`),
      ]);
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

async function strips(baseDist, headDist, out, baseLabel, headLabel) {
  const servers = {};
  try {
    servers.base = await serve(baseDist, 43301);
    servers.head = await serve(headDist, 43302);
    const browser = await chromium.launch({ headless: true, channel: 'chromium' });
    try {
      const probe = await browser.newContext();
      const renderer = await (await probe.newPage()).evaluate(() => {
        const gl = document.createElement('canvas').getContext('webgl2');
        const info = gl?.getExtension('WEBGL_debug_renderer_info');
        return gl && info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'no webgl2';
      });
      await probe.close();
      console.log(`renderer: ${renderer}`);
      const base = await recordBuild(browser, servers.base.base, path.join(out, 'base'));
      const head = await recordBuild(browser, servers.head.base, path.join(out, 'head'));
      await renderMoments(browser, out, base, head, baseLabel, headLabel);
      await videos(out, base, head, baseLabel, headLabel);
    } finally {
      await browser.close();
    }
  } finally {
    for (const server of Object.values(servers)) server.child.kill();
  }
}

// The strips again from takes already on disk, under <out>/base and <out>/head.
async function sheets(out, baseLabel, headLabel) {
  const load = async (build, name) => {
    const dir = path.join(out, build, name);
    const meta = JSON.parse(await readFile(path.join(dir, 'frames.json'), 'utf8'));
    return { dir, frames: meta.frames, recorder: { events: meta.events, log: meta.log }, ...(meta.tapAt ? { tapAt: meta.tapAt } : {}) };
  };
  const loadBuild = async (build) => Object.fromEntries(
    await Promise.all(MOMENTS.map(async ([name]) => [name, await load(build, name)])),
  );
  const browser = await chromium.launch({ headless: true });
  try {
    await renderMoments(browser, out, await loadBuild('base'), await loadBuild('head'), baseLabel, headLabel);
  } finally {
    await browser.close();
  }
}

const [mode, ...args] = process.argv.slice(2);
if (mode === 'steady' && args.length === 3) {
  await steady(...args);
} else if (mode === 'strips' && args.length === 5) {
  await strips(...args);
} else if (mode === 'sheets' && args.length === 3) {
  await sheets(...args);
} else {
  throw new Error('usage: backing-fade-evidence.mjs steady <base-checkout> <head-checkout> <out-dir> | strips <base-dist> <head-dist> <out-dir> <base-label> <head-label> | sheets <out-dir> <base-label> <head-label>');
}
