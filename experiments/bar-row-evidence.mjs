// Evidence for a change to how the compact top bar lays out (#149).
//
//   node experiments/bar-row-evidence.mjs layout <base-dist> <head-dist> <out-dir>
//   node experiments/bar-row-evidence.mjs shots <base-checkout> <head-checkout> <out-dir>
//   node experiments/bar-row-evidence.mjs contrast <checkout> <out-dir>
//   node experiments/bar-row-evidence.mjs panel <base-dist> <head-dist> <out-dir>
//   node experiments/bar-row-evidence.mjs wide <base-dist> <head-dist> <out-dir>
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
//
// `panel` opens the save panel of 今晚的 Mira on both production builds, at 390
// wide in English, 320 wide in Chinese and 1024 wide in English, and reads the
// bar at each step. The panel opens over the page from inside the row's element,
// so it must not move the wordmark's verdict. Each ResizeObserver made is
// counted: a new measurement of the row makes one.
//
// `wide` measures the wide bar on both production builds, 660 to 1440 in steps
// of 20, both languages, the four labels, camera off the main view. It prints
// the cells where the two builds differ, then reads those again on fresh pages.
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

// English is chosen through the panel, as a viewer does on the phone. The wide
// bar keeps the language switch on its row.
async function chooseLanguage(page, language) {
  if (language !== 'en') return;
  const more = page.getByTestId('more-toggle');
  const tucked = (await more.count()) > 0;
  if (tucked) await more.click();
  await page.getByTestId('language-toggle').click();
  if (tucked) {
    await page.keyboard.press('Escape');
    await page.getByTestId('more-panel').waitFor({ state: 'detached' });
  }
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
// whether the wordmark is showing. On the wide bar the row holds more controls
// than these four, so the rows are counted over everything in the row's flow.
async function readBar(page) {
  return page.evaluate((ids) => {
    const header = document.querySelector('[data-testid="top-bar"]');
    const group = document.querySelector('[data-testid="ambient-toggle"]').parentElement;
    const wordmark = header.querySelector('span.font-display');
    const round = (v) => Math.round(v * 10) / 10;
    const inRow = [...group.children].filter(
      (child) => !/^(absolute|fixed)$/.test(getComputedStyle(child).position),
    );
    const boxes = Object.fromEntries(ids.map((id) => {
      const box = document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect();
      return [id, box ? { x: Math.floor(box.left), y: Math.floor(box.top), w: Math.ceil(box.width), h: Math.ceil(box.height), left: round(box.left) } : null];
    }));
    return {
      rows: new Set(inRow.map((child) => Math.floor(child.getBoundingClientRect().top))).size,
      barHeight: Math.round(header.getBoundingClientRect().height),
      wordmark: wordmark !== null && getComputedStyle(wordmark).visibility !== 'hidden',
      boxes,
      toggleLabel: document.querySelector('[data-testid="ambient-toggle"]')?.textContent.trim() ?? null,
      groupWidth: round(group.getBoundingClientRect().width),
    };
  }, IDS);
}

// One label state of the ambient toggle, swapped into its text node. The
// wordmark's verdict comes from a resize seen a frame later, so the read waits
// two frames.
async function swapLabel(page, label) {
  await page.evaluate((text) => {
    const toggle = document.querySelector('[data-testid="ambient-toggle"]');
    [...toggle.childNodes].find((node) => node.nodeType === Node.TEXT_NODE).textContent = text;
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))));
  }, label);
  return readBar(page);
}

async function openAway(browser, base, frame, language, init) {
  const context = await browser.newContext({ viewport: frame, deviceScaleFactor: 1 });
  await context.addInitScript(() => localStorage.setItem('mira:seen-opening', '1'));
  if (init) await context.addInitScript(init);
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
            rows.push({ build, width: frame.width, language, state: label, ...await swapLabel(page, label) });
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
  for (const row of rows) printRow(row);
}

function printRow(row) {
  const state = row.state ? `[${row.state}] ` : '';
  const step = row.step ? `${row.step.padEnd(30)} ` : '';
  const observers = row.observers === undefined ? '' : `ResizeObservers=${String(row.observers).padStart(2)} `;
  const widths = IDS.filter((id) => row.boxes[id]).map((id) => row.boxes[id].w).join('/');
  console.log(`${row.build.padEnd(4)} ${row.width} ${row.language.padEnd(5)} ${state}${step}${observers}rows=${row.rows} bar=${row.barHeight}px wordmark=${row.wordmark ? 'shown' : 'yielded'} group=${row.groupWidth} controls=${widths}`);
}

// ------------------------------------------------------------------ shots ----

const VIEWS = [
  { name: 'portrait320-near-en', frame: { width: 320, height: 568 }, language: 'en' },
  { name: 'portrait320-near-zh', frame: { width: 320, height: 568 }, language: 'zh-CN' },
  { name: 'portrait390-near-en', frame: { width: 390, height: 844 }, language: 'en' },
  // The save panel open: the bar must read as it does with the panel closed.
  { name: 'portrait390-near-en-tonight', frame: { width: 390, height: 844 }, language: 'en', panel: true },
  // 820 is the iPad Air across. The long label is swapped in.
  { name: 'tablet820-near-en-tap', frame: { width: 820, height: 1180 }, language: 'en', label: LABELS.en[1] },
];

// What a view needs after the drag: a label state, or the save panel opened.
async function viewStep(view, page) {
  if (view.label) await swapLabel(page, view.label);
  if (view.panel) {
    await page.getByTestId('tonight-save').click();
    await page.getByTestId('tonight-panel').waitFor({ state: 'visible' });
    // The panel's own entrance runs in script, outside the frozen CSS.
    await page.waitForTimeout(700);
  }
}

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
  await viewStep(view, page);
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

// ------------------------------------------------------------------ panel ----

const PANEL_FRAMES = [
  { width: 390, height: 844, language: 'en' },
  { width: 320, height: 568, language: 'zh-CN' },
  { width: 1024, height: 900, language: 'en' },
];

// Every ResizeObserver made is counted. The row's fit makes one each time it
// measures, so the count tells when a new measurement started.
function COUNT_OBSERVERS() {
  const Native = window.ResizeObserver;
  window.__resizeObserversCreated = 0;
  window.ResizeObserver = class extends Native {
    constructor(callback) {
      super(callback);
      window.__resizeObserversCreated += 1;
    }
  };
}

async function panel(baseDist, headDist, out) {
  await mkdir(out, { recursive: true });
  const servers = { base: await serve(baseDist, 43401), head: await serve(headDist, 43402) };
  const browser = await chromium.launch({ headless: true });
  const log = [];
  try {
    for (const [build, server] of Object.entries(servers)) {
      for (const frame of PANEL_FRAMES) {
        const { context, page } = await openAway(browser, server.base, frame, frame.language, COUNT_OBSERVERS);
        const read = async (step) => {
          const observers = await page.evaluate(() => window.__resizeObserversCreated);
          const row = { build, width: frame.width, language: frame.language, step, observers, ...await readBar(page) };
          log.push(row);
          printRow(row);
        };
        await read('away, panel closed');
        await page.getByTestId('tonight-save').click();
        await page.getByTestId('tonight-panel').waitFor({ state: 'visible' });
        await page.waitForTimeout(800);
        await read('panel opened');
        await page.setViewportSize({ width: frame.width + 1, height: frame.height });
        await page.waitForTimeout(800);
        await read('resized with the panel open');
        await page.getByTestId('tonight-close').click();
        await page.getByTestId('tonight-panel').waitFor({ state: 'detached' });
        await page.waitForTimeout(800);
        await read('panel closed');
        await context.close();
      }
    }
  } finally {
    await browser.close();
    for (const server of Object.values(servers)) server.child.kill();
  }
  await writeFile(path.join(out, 'panel.json'), JSON.stringify(log, null, 2));
}

// ------------------------------------------------------------------- wide ----

const WIDE_WIDTHS = Array.from({ length: 40 }, (_, i) => 660 + i * 20);
const WIDE_HEIGHT = 900;

// The part of a read the eye sees: the rows, the bar's height, the wordmark.
function verdict(row) {
  return `${row.rows} rows, ${row.barHeight}px, wordmark ${row.wordmark ? 'shown' : 'yielded'}`;
}

async function wide(baseDist, headDist, out) {
  await mkdir(out, { recursive: true });
  const servers = { base: await serve(baseDist, 43401), head: await serve(headDist, 43402) };
  const browser = await chromium.launch({ headless: true });
  const rows = [];
  const key = (row) => `${row.width} ${row.language} [${row.state}]`;
  try {
    for (const [build, server] of Object.entries(servers)) {
      for (const language of ['zh-CN', 'en']) {
        // One page per build and language; the window walks the widths.
        const { context, page } = await openAway(
          browser,
          server.base,
          { width: WIDE_WIDTHS[0], height: WIDE_HEIGHT },
          language,
        );
        for (const width of WIDE_WIDTHS) {
          await page.setViewportSize({ width, height: WIDE_HEIGHT });
          await page.waitForTimeout(500);
          for (const state of LABELS[language]) {
            rows.push({ build, width, language, state, ...await swapLabel(page, state) });
          }
        }
        await context.close();
      }
    }
    const cells = new Map(rows.map((row) => [`${row.build} ${key(row)}`, row]));
    const differing = rows
      .filter((row) => row.build === 'base')
      .filter((row) => verdict(row) !== verdict(cells.get(`head ${key(row)}`)));
    const total = rows.length / 2;
    console.log(`${total} cells per build. ${total - differing.length} read the same on both builds, ${differing.length} differ:`);
    for (const row of differing) {
      console.log(`  ${key(row)}: base ${verdict(row)}; head ${verdict(cells.get(`head ${key(row)}`))}`);
    }
    // The differing cells again, each on a fresh page.
    console.log('The differing cells on fresh pages:');
    for (const [build, server] of Object.entries(servers)) {
      for (const row of differing) {
        const { context, page } = await openAway(
          browser,
          server.base,
          { width: row.width, height: WIDE_HEIGHT },
          row.language,
        );
        const fresh = {
          build,
          width: row.width,
          language: row.language,
          state: row.state,
          fresh: true,
          ...await swapLabel(page, row.state),
        };
        rows.push(fresh);
        const same = verdict(fresh) === verdict(cells.get(`${build} ${key(fresh)}`));
        console.log(`  ${build.padEnd(4)} ${key(fresh)}: ${verdict(fresh)}${same ? '' : '  (differs from the walk)'}`);
        await context.close();
      }
    }
  } finally {
    await browser.close();
    for (const server of Object.values(servers)) server.child.kill();
  }
  await writeFile(path.join(out, 'wide.json'), JSON.stringify(rows, null, 2));
}

if (mode === 'layout' && args.length === 3) {
  await layout(...args);
} else if (mode === 'shots' && args.length === 3) {
  await shots(...args);
} else if (mode === 'contrast' && args.length === 2) {
  await contrast(...args);
} else if (mode === 'panel' && args.length === 3) {
  await panel(...args);
} else if (mode === 'wide' && args.length === 3) {
  await wide(...args);
} else {
  throw new Error('usage: bar-row-evidence.mjs layout <base-dist> <head-dist> <out-dir> | shots <base-checkout> <head-checkout> <out-dir> | contrast <checkout> <out-dir> | panel <base-dist> <head-dist> <out-dir> | wide <base-dist> <head-dist> <out-dir>');
}
