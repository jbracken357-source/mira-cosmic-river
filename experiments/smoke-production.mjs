// Production smoke: verify a production build end to end. CI runs it against its
// own build, served by experiments/serve-dist.mjs, which answers a missing file
// with 404 as the live host does (#143). By hand it defaults to the live URL.
//
//   node experiments/smoke-production.mjs [https://mira-cosmic-river.vercel.app]
//
// Desktop first visit must play the full cinematic and reach the scene; a
// mobile-viewport return visit must enter directly, flip the sound toggle, drag the
// scene once, open the save flow, and survive a touch tap — with zero page errors
// anywhere. Every gesture on the phone is a touch event, so a broken touch path
// fails the run. The exit code carries the verdict: 0 for PASS, 1 for FAIL. The
// report prints even when a step throws. Production strips the dev-only
// observability attributes, so this asserts only what the shipped build exposes
// (testIds, aria state). Pair it with a bundle-hash comparison (local `npm run
// build` vs the live index.html asset names) to pin WHICH commit is live — see the
// #30 acceptance evidence for the worked example.
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'https://mira-cosmic-river.vercel.app';

const browser = await chromium.launch({ headless: true });
const report = {
  desktopFirstVisit: { errors: [] },
  mobileReturnVisit: { errors: [] },
};
let failure = null;

// One finger, from one point to another, in the given number of steps.
async function touchDrag(context, page, from, to, steps) {
  const touch = await context.newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  for (let step = 1; step <= steps; step += 1) {
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from.x + (to.x - from.x) * step / steps, y: from.y + (to.y - from.y) * step / steps }],
    });
  }
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

try {
  // --- Desktop, first visit: the full cinematic plays, then the scene. ---
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const { errors } = report.desktopFirstVisit;
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByTestId('cinematic-overlay').waitFor({ timeout: 60_000 });
    report.desktopFirstVisit.openingShown = true;
    await page.getByTestId('explore-ui').waitFor({ timeout: 90_000 });
    report.desktopFirstVisit.exploreReached = true;
    report.desktopFirstVisit.canvasVisible = await page.locator('canvas').isVisible();
    await page.waitForTimeout(2000);
    await context.close();
  }

  // --- Mobile viewport, return visit: direct entry, sound toggle, save panel. ---
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const page = await context.newPage();
    const { errors } = report.mobileReturnVisit;
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    await page.addInitScript(() => localStorage.setItem('mira:seen-opening', '1'));
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByTestId('explore-ui').waitFor({ timeout: 60_000 });
    report.mobileReturnVisit.exploreReached = true;
    report.mobileReturnVisit.openingAbsent = (await page.getByTestId('cinematic-overlay').count()) === 0;
    report.mobileReturnVisit.canvasVisible = await page.locator('canvas').isVisible();

    // Sound: the toggle flips to pressed on the shipped build (a real gesture).
    await page.getByTestId('ambient-toggle').tap();
    report.mobileReturnVisit.soundPressed = await page.getByTestId('ambient-toggle').getAttribute('aria-pressed') === 'true';

    // The visit's first drag or zoom graduates the quiet bar: 今晚的 Mira appears.
    // A drag is never a click, so no star card opens on the way.
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('the canvas has no box on the phone return visit');
    await touchDrag(
      context,
      page,
      { x: box.x + box.width * 0.5, y: box.y + box.height * 0.6 },
      { x: box.x + box.width * 0.58, y: box.y + box.height * 0.64 },
      8,
    );

    // Tonight's Mira: the entry opens the panel and locks a preview.
    await page.getByTestId('tonight-save').tap();
    const panel = page.getByTestId('tonight-panel');
    report.mobileReturnVisit.savePanel = await panel.isVisible();
    if (report.mobileReturnVisit.savePanel) {
      await page.getByTestId('tonight-preview').waitFor({ timeout: 30_000 }).then(
        () => { report.mobileReturnVisit.savePreview = true; },
        () => { report.mobileReturnVisit.savePreview = false; },
      );
      await page.getByTestId('tonight-close').tap();
    }

    // Touch tap on the canvas does not break anything.
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(1500);
    await context.close();
  }
} catch (error) {
  failure = error;
} finally {
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
const { desktopFirstVisit: desktop, mobileReturnVisit: mobile } = report;
const clean = failure === null && desktop.errors.length === 0 && mobile.errors.length === 0
  && desktop.openingShown && desktop.exploreReached
  && mobile.exploreReached && mobile.openingAbsent
  && mobile.soundPressed && mobile.savePanel && mobile.savePreview;
console.log(clean ? 'PRODUCTION SMOKE: PASS' : 'PRODUCTION SMOKE: FAIL');
// After the verdict, so the report and the verdict stay at the top of the output.
if (failure) console.error(failure);
// exitCode, not exit: exit can cut the lines above off on a pipe.
process.exitCode = clean ? 0 : 1;
