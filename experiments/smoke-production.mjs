// Production smoke: verify the deployed build end to end against the live URL.
//
//   node experiments/smoke-production.mjs [https://mira-cosmic-river.vercel.app]
//
// Desktop first visit must play the full cinematic and reach the scene; a
// mobile-viewport return visit must enter directly, flip the sound toggle, open the
// save flow, and survive a touch tap — with zero page errors anywhere. Production
// strips the dev-only observability attributes, so this asserts only what the shipped
// build exposes (testIds, aria state, canvas presence). Pair it with a bundle-hash
// comparison (local `npm run build` vs the live index.html asset names) to pin WHICH
// commit is live — see the #30 acceptance evidence for the worked example.
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'https://mira-cosmic-river.vercel.app';

const browser = await chromium.launch({ headless: true });
const report = { desktopFirstVisit: {}, mobileReturnVisit: {} };

try {
  // --- Desktop, first visit: the full cinematic plays, then the scene. ---
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByTestId('cinematic-overlay').waitFor({ timeout: 60_000 });
    report.desktopFirstVisit.openingShown = true;
    await page.getByTestId('explore-ui').waitFor({ timeout: 90_000 });
    report.desktopFirstVisit.exploreReached = true;
    report.desktopFirstVisit.canvasVisible = await page.locator('canvas').isVisible();
    await page.waitForTimeout(2000);
    report.desktopFirstVisit.errors = errors;
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
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    await page.addInitScript(() => localStorage.setItem('mira:seen-opening', '1'));
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByTestId('explore-ui').waitFor({ timeout: 60_000 });
    report.mobileReturnVisit.exploreReached = true;
    report.mobileReturnVisit.openingAbsent = (await page.getByTestId('cinematic-overlay').count()) === 0;
    report.mobileReturnVisit.canvasVisible = await page.locator('canvas').isVisible();

    // Sound: the toggle flips to pressed on the shipped build (a real gesture).
    await page.getByTestId('ambient-toggle').click();
    report.mobileReturnVisit.soundPressed = await page.getByTestId('ambient-toggle').getAttribute('aria-pressed') === 'true';

    // Tonight's Mira: the entry opens the panel and locks a preview.
    await page.getByTestId('tonight-save').click();
    const panel = page.getByTestId('tonight-panel');
    report.mobileReturnVisit.savePanel = await panel.isVisible();
    if (report.mobileReturnVisit.savePanel) {
      await page.getByTestId('tonight-preview').waitFor({ timeout: 30_000 }).then(
        () => { report.mobileReturnVisit.savePreview = true; },
        () => { report.mobileReturnVisit.savePreview = false; },
      );
      await page.getByTestId('tonight-close').click();
    }

    // Touch drag on the canvas does not break anything.
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (box) {
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2).catch(() => {});
    }
    await page.waitForTimeout(1500);
    report.mobileReturnVisit.errors = errors;
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
const clean = report.desktopFirstVisit.errors.length === 0 && report.mobileReturnVisit.errors.length === 0
  && report.desktopFirstVisit.openingShown && report.desktopFirstVisit.exploreReached
  && report.mobileReturnVisit.exploreReached && report.mobileReturnVisit.openingAbsent
  && report.mobileReturnVisit.soundPressed && report.mobileReturnVisit.savePanel && report.mobileReturnVisit.savePreview;
console.log(clean ? 'PRODUCTION SMOKE: PASS' : 'PRODUCTION SMOKE: FAIL');
