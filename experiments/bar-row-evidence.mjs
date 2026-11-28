// Evidence for a change to how the compact top bar lays out (#149).
//
//   node experiments/bar-row-evidence.mjs layout <base-dist> <head-dist> <out-dir>
//   node experiments/bar-row-evidence.mjs shots <base-checkout> <head-checkout> <out-dir>
//   node experiments/bar-row-evidence.mjs contrast <checkout> <out-dir>
//
// `layout` serves both production builds and measures the bar at 320, 360, 375 and
// 390 wide, in both languages, with the camera off the main view: once as the page
// has it, then once per label state of the ambient toggle, each label swapped into
// the toggle's text node. It prints one line per case and writes layout.json.
//
// `shots` captures the frozen near view on each checkout's dev server, through the
// waits of baseline-harness.mjs, after a drag that brings 今晚的 Mira into the bar.
// Three views: 320 wide in English, 320 wide in Chinese, 390 wide in English. It
// prints the pixel diff of each view between the two builds.
//
// `contrast` measures the four labels' WCAG contrast over the backing at 320 wide
// in English, by the method of docs/evidence-137. For every glyph pixel of a label
// it takes the pixel behind it, from the same frozen frame with the labels not
// painted, and composites the label colour, white at 55% opacity, over it.
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const [mode, ...args] = process.argv.slice(2);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const IDS = ['return-to-view', 'tonight-save', 'ambient-toggle', 'more-toggle'];
// 320 and 390 are the compact verdict's frames (#111). 360 is the common Android
// width and 375 the small iPhone one: there the wordmark must stay.
const FRAMES = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
];
// The ambient toggle's label in each of its states, by language.
const LABELS = {
  en: ['Ambient sound', 'Tap to start ambient sound', 'Starting ambient sound…', 'Retry ambient sound'],
  'zh-CN': ['环境音', '点按开启环境音', '正在开启环境音…', '重试环境音'],
};
// The frame docs/evidence-137 used: brightness maximum, the hardest backdrop.
const EPOCH = '2026-04-10T12:00:00Z';
const FREEZE_CSS = '*, *::before, *::after { animation: none !important; transition: none !important; }';

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

async function startVite(dir, port) {
  const child = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const baseUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`dev server in ${dir} exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) return { child, baseUrl };
    } catch {
      // Not up yet.
    }
    await sleep(400);
  }
  child.kill();
  throw new Error(`dev server in ${dir} did not start`);
}

// English is chosen through the panel, as a viewer does on the phone.
async function chooseLanguage(page, language) {
  if (language !== 'en') return;
  await page.getByTestId('more-toggle').click();
  await page.getByTestId('language-toggle').click();
  await page.keyboard.press('Escape');
  await page.getByTestId('more-panel').waitFor({ state: 'detached' });
}

// One drag carries the camera off the main view, so the bar is at its fullest.
async function dragScene(page) {
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.58, box.y + box.height * 0.64, { steps: 8 });
  await page.mouse.up();
}

// The bar as laid out: the rows the controls top out on, each one's box, and
// whether the wordmark is showing.
async function readBar(page) {
  return page.evaluate((ids) => {
    const header = document.querySelector('[data-testid="top-bar"]');
    const group = document.querySelector('[data-testid="ambient-toggle"]').parentElement;
    const wordmark = header.querySelector('span.font-display');
    const round = (v) => Math.round(v * 10) / 10;
    const boxes = Object.fromEntries(ids.map((id) => {
      const box = document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect();
      return [id, box ? { x: Math.floor(box.left), y: Math.floor(box.top), w: Math.ceil(box.width), h: Math.ceil(box.height), left: round(box.left) } : null];
    }));
    return {
      rows: new Set(Object.values(boxes).filter(Boolean).map((box) => box.y)).size,
      barHeight: Math.round(header.getBoundingClientRect().height),
      wordmark: wordmark !== null && getComputedStyle(wordmark).visibility !== 'hidden',
      boxes,
      toggleLabel: document.querySelector('[data-testid="ambient-toggle"]')?.textContent.trim() ?? null,
      groupWidth: round(group.getBoundingClientRect().width),
    };
  }, IDS);
}

async function openAway(browser, base, frame, language) {
  const context = await browser.newContext({ viewport: frame, deviceScaleFactor: 1 });
  await context.addInitScript(() => localStorage.setItem('mira:seen-opening', '1'));
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('explore-ui').waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  await chooseLanguage(page, language);
  await dragScene(page);
  await page.getByTestId('return-to-view').waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1200);
  return { context, page };
}

// ----------------------------------------------------------------- layout ----

async function layout(baseDist, headDist, out) {
  await mkdir(out, { recursive: true });
  const servers = { base: await serve(baseDist, 43401), head: await serve(headDist, 43402) };
  const browser = await chromium.launch({ headless: true });
  const rows = [];
  try {
    for (const [build, server] of Object.entries(servers)) {
      for (const frame of FRAMES) {
        for (const language of ['zh-CN', 'en']) {
          const { context, page } = await openAway(browser, server.base, frame, language);
          rows.push({ build, width: frame.width, language, state: 'live', ...await readBar(page) });
          for (const label of LABELS[language]) {
            // The wordmark's verdict comes from a resize seen a frame later, so the
            // read waits two frames after the swap.
            const read = await page.evaluate((text) => {
              const toggle = document.querySelector('[data-testid="ambient-toggle"]');
              [...toggle.childNodes].find((node) => node.nodeType === Node.TEXT_NODE).textContent = text;
              return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))));
            }, label).then(() => readBar(page));
            rows.push({ build, width: frame.width, language, state: label, ...read });
          }
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
    for (const server of Object.values(servers)) server.child.kill();
  }
  await writeFile(path.join(out, 'layout.json'), JSON.stringify(rows, null, 2));
  for (const row of rows) {
    const widths = IDS.map((id) => row.boxes[id]?.w).join('/');
    console.log(`${row.build.padEnd(4)} ${row.width} ${row.language.padEnd(5)} [${row.state}] rows=${row.rows} bar=${row.barHeight}px wordmark=${row.wordmark ? 'shown' : 'yielded'} group=${row.groupWidth} controls=${widths}`);
  }
}

// ------------------------------------------------------------------ shots ----

const VIEWS = [
  { name: 'portrait320-near-en', frame: { width: 320, height: 568 }, language: 'en' },
  { name: 'portrait320-near-zh', frame: { width: 320, height: 568 }, language: 'zh-CN' },
  { name: 'portrait390-near-en', frame: { width: 390, height: 844 }, language: 'en' },
];

// The frozen near view on a dev server, with 今晚的 Mira in the bar. With
// `bare`, the labels are not painted: what shows through them.
async function frozenShot(browser, baseUrl, view, harness, bare = false) {
  const context = await browser.newContext({ viewport: view.frame, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.addInitScript(harness.baselineInitScript);
  await page.goto(`${baseUrl}/?capture=1&epoch=${encodeURIComponent(EPOCH)}&cam=near`, { waitUntil: 'networkidle' });
  await harness.waitForExploreReady(page);
  await page.addStyleTag({ content: FREEZE_CSS });
  if (!(await harness.sceneResourcesReady(page))) throw new Error(`scene resources never reported ready for ${view.name}`);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await harness.waitForOverlaySettle(page);
  await page.waitForTimeout(1200);
  await chooseLanguage(page, view.language);
  await dragScene(page);
  await page.waitForTimeout(1200);
  const bar = await readBar(page);
  let hidden;
  if (bare) {
    hidden = await page.addStyleTag({ content: '[data-testid="top-bar"] button { visibility: hidden !important; }' });
    await page.waitForTimeout(300);
  }
  const buffer = await page.screenshot();
  await hidden?.evaluate((el) => el.remove());
  await context.close();
  return { buffer, bar };
}

async function shots(baseDir, headDir, out) {
  const harness = await import('./baseline-harness.mjs');
  const bars = {};
  for (const [build, dir] of [['base', baseDir], ['head', headDir]]) {
    const { child, baseUrl } = await startVite(dir, await harness.freePort());
    const browser = await chromium.launch({ headless: true });
    try {
      bars[build] = {};
      for (const view of VIEWS) {
        const shot = await frozenShot(browser, baseUrl, view, harness);
        bars[build][view.name] = shot.bar;
        await mkdir(path.join(out, build), { recursive: true });
        await writeFile(path.join(out, build, `${view.name}.png`), shot.buffer);
      }
    } finally {
      await browser.close();
      child.kill();
    }
  }
  const browser = await chromium.launch({ headless: true });
  try {
    for (const view of VIEWS) {
      const a = await readFile(path.join(out, 'base', `${view.name}.png`));
      const b = await readFile(path.join(out, 'head', `${view.name}.png`));
      console.log(`${view.name}: base vs head ${JSON.stringify(await harness.pixelDiffPngs(browser, a, b))}`);
      for (const build of ['base', 'head']) {
        const { rows, barHeight, wordmark, groupWidth } = bars[build][view.name];
        console.log(`  ${build.padEnd(4)} rows=${rows} bar=${barHeight}px wordmark=${wordmark ? 'shown' : 'yielded'} group=${groupWidth}`);
      }
    }
  } finally {
    await browser.close();
  }
}

// --------------------------------------------------------------- contrast ----

async function contrast(checkout, out) {
  const harness = await import('./baseline-harness.mjs');
  const view = VIEWS[0];
  const { child, baseUrl } = await startVite(checkout, await harness.freePort());
  const browser = await chromium.launch({ headless: true });
  try {
    const withLabels = await frozenShot(browser, baseUrl, view, harness);
    const bare = await frozenShot(browser, baseUrl, view, harness, true);
    await mkdir(out, { recursive: true });
    await writeFile(path.join(out, 'portrait320-near-en.png'), withLabels.buffer);
    const helper = await browser.newPage();
    const result = await helper.evaluate(async ([a64, b64, boxes]) => {
      const load = (data) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('png decode failed'));
        img.src = `data:image/png;base64,${data}`;
      });
      const pixels = async (data) => {
        const img = await load(data);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return { width: img.width, data: ctx.getImageData(0, 0, img.width, img.height).data };
      };
      const a = await pixels(a64);
      const b = await pixels(b64);
      const luminance = ([r, g, bl]) => {
        const channel = (v) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(bl);
      };
      const result = {};
      for (const [id, box] of Object.entries(boxes)) {
        if (!box) continue;
        const ratios = [];
        for (let y = box.y; y < box.y + box.h; y += 1) {
          for (let x = box.x; x < box.x + box.w; x += 1) {
            const i = (y * a.width + x) * 4;
            if (a.data[i] === b.data[i] && a.data[i + 1] === b.data[i + 1] && a.data[i + 2] === b.data[i + 2]) continue;
            // White at 55% opacity over what is behind it.
            const behind = [b.data[i], b.data[i + 1], b.data[i + 2]];
            const fg = behind.map((v) => 0.55 * 255 + 0.45 * v);
            const l1 = luminance(fg);
            const l2 = luminance(behind);
            ratios.push((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
          }
        }
        ratios.sort((p, q) => p - q);
        result[id] = {
          box: [box.x, box.y, box.w, box.h],
          glyphPixels: ratios.length,
          median: ratios[Math.floor(ratios.length / 2)],
          belowAA: ratios.filter((r) => r < 4.5).length / ratios.length,
        };
      }
      return result;
    }, [withLabels.buffer.toString('base64'), bare.buffer.toString('base64'), withLabels.bar.boxes]);
    const { rows, barHeight, wordmark, groupWidth } = withLabels.bar;
    console.log(`bar rows=${rows} height=${barHeight}px wordmark=${wordmark ? 'shown' : 'yielded'} group=${groupWidth}`);
    await writeFile(path.join(out, 'contrast.json'), JSON.stringify({ bar: withLabels.bar, labels: result }, null, 2));
    for (const [id, r] of Object.entries(result)) {
      console.log(`${id.padEnd(16)} box ${r.box.join(',')}  median ${r.median.toFixed(2)}:1  below 4.5:1 ${(r.belowAA * 100).toFixed(1)}%  (${r.glyphPixels} px)`);
    }
  } finally {
    await browser.close();
    child.kill();
  }
}

if (mode === 'layout' && args.length === 3) {
  await layout(...args);
} else if (mode === 'shots' && args.length === 3) {
  await shots(...args);
} else if (mode === 'contrast' && args.length === 2) {
  await contrast(...args);
} else {
  throw new Error('usage: bar-row-evidence.mjs layout <base-dist> <head-dist> <out-dir> | shots <base-checkout> <head-checkout> <out-dir> | contrast <checkout> <out-dir>');
}
