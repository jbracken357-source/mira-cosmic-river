// Does a hidden canvas stall the next page load (#143, gap 4)?
//
//   node experiments/hidden-canvas-stall.mjs <base-url>               the four cells
//   node experiments/hidden-canvas-stall.mjs <base-url> context-wait  where the wait sits
//
// The four cells: the headless default renderer and the real GPU (`channel:
// 'chromium'`), each with a visible canvas and with the canvas hidden by a style
// added to the document. Per cell it runs a phone visit alone, then the production
// smoke's two visits in one browser, the desktop first visit and the phone return
// visit, and prints the time to domcontentloaded of each. On 2026-11-27 the
// default renderer was SwiftShader, and only its hidden cell stalled.
//
// `context-wait` runs on the default renderer with the canvas hidden. It times the
// phone page's first `getContext` after a desktop visit that rendered for 2
// seconds, then for 6. On 2026-11-27 the wait was about 24 seconds per second the
// first page had rendered, and a shorter first render meant a shorter wait. That
// fits work the first page queued in the shared GPU process, which software
// rendering drains slowly and a closed page does not cancel. The timings show
// that queue only indirectly. A real GPU and a visible canvas showed none of it,
// and the smoke never hides the canvas.
import { chromium } from 'playwright';

const [base, mode = 'cells'] = process.argv.slice(2);
if (!base) throw new Error('usage: node hidden-canvas-stall.mjs <base-url> [context-wait]');

const HIDE = 'canvas{visibility:hidden}';
const CAP_MS = 45_000;
const DESKTOP = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

async function newContext(browser, options, hidden) {
  const context = await browser.newContext(options);
  if (!hidden) return context;
  await context.route((url) => url.pathname === '/', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace('</head>', `<style>${HIDE}</style></head>`);
    await route.fulfill({ response, body });
  });
  return context;
}

async function timedGoto(page) {
  const t0 = Date.now();
  return page.goto(base, { waitUntil: 'domcontentloaded', timeout: CAP_MS })
    .then(() => `${Date.now() - t0} ms`, (e) => `not within ${CAP_MS} ms (${String(e.message).split('\n')[0]})`);
}

async function visit(browser, options, hidden, firstVisit) {
  const context = await newContext(browser, options, hidden);
  const page = await context.newPage();
  if (!firstVisit) await page.addInitScript(() => localStorage.setItem('mira:seen-opening', '1'));
  const domcontentloaded = await timedGoto(page);
  if (firstVisit) {
    // As the smoke runs it: the scene is reached, and the context closes two seconds later.
    await page.getByTestId('explore-ui').waitFor({ timeout: 90_000 });
    await page.waitForTimeout(2000);
  }
  const styleInDocument = await page.evaluate(
    (rule) => [...document.querySelectorAll('style')].some((style) => style.textContent.includes(rule)),
    HIDE,
  );
  await context.close();
  return { domcontentloaded, styleInDocument };
}

async function cells(browser, launcher) {
  const probe = await browser.newContext();
  const renderer = await (await probe.newPage()).evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return gl && info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'no webgl2';
  });
  await probe.close();
  console.log(`renderer (${launcher}): ${renderer}`);
  for (const canvas of ['visible', 'hidden']) {
    const alone = await visit(browser, PHONE, canvas === 'hidden', false);
    const desktop = await visit(browser, DESKTOP, canvas === 'hidden', true);
    const phone = await visit(browser, PHONE, canvas === 'hidden', false);
    console.log(
      `${launcher} / ${canvas} canvas: phone alone ${alone.domcontentloaded}; `
      + `desktop first visit ${desktop.domcontentloaded}; phone after it ${phone.domcontentloaded} `
      + `(hidden style in document: ${phone.styleInDocument})`,
    );
  }
}

// The page reports its own clock just before and just after its first getContext,
// because a beacon sent from a blocked page can arrive late.
async function contextWait(browser, seconds) {
  const desktop = await newContext(browser, DESKTOP, true);
  await (await desktop.newPage()).goto(base, { waitUntil: 'domcontentloaded' });
  await desktop.pages()[0].waitForTimeout(seconds * 1000);
  await desktop.close();

  const marks = [];
  const phone = await newContext(browser, PHONE, true);
  phone.on('request', (request) => {
    if (request.url().includes('/__probe?')) marks.push(Number(new URL(request.url()).searchParams.get('page')));
  });
  await phone.addInitScript(() => localStorage.setItem('mira:seen-opening', '1'));
  await phone.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      if (args[0] !== 'webgl2' && args[0] !== 'webgl') return original.apply(this, args);
      navigator.sendBeacon(`/__probe?page=${Math.round(performance.now())}`);
      const gl = original.apply(this, args);
      navigator.sendBeacon(`/__probe?page=${Math.round(performance.now())}`);
      return gl;
    };
  });
  await phone.route('**/__probe*', (route) => route.abort());
  const page = await phone.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 240_000 });
  await page.waitForTimeout(500);
  console.log(`desktop rendered ${seconds} s: the phone page's first getContext returned after ${marks[1] - marks[0]} ms of page time`);
  await phone.close();
}

if (mode === 'context-wait') {
  const browser = await chromium.launch({ headless: true });
  for (const seconds of [2, 6]) await contextWait(browser, seconds);
  await browser.close();
} else {
  for (const launcher of ['default', 'gpu']) {
    const browser = await chromium.launch({ headless: true, ...(launcher === 'gpu' ? { channel: 'chromium' } : {}) });
    await cells(browser, launcher);
    await browser.close();
  }
}
