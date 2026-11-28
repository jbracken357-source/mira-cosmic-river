import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { TRANSITIONS } from '../../src/constants/animation';
import {
  dragOffMainView,
  IDLE_FAST,
  manipulateScene,
  MID_DECLINE_EPOCH,
  PORTRAIT_FRAME,
  SE_FRAME,
} from './helpers';

// 顶栏 (#90): free viewing opens with three controls only — 环境音, 语言, 完整开场.
// The visit's first drag or zoom graduates 暂停 and 今晚的 Mira; 主视角 exists only
// while the camera is off the main view; the epilogue hushes the whole bar within
// its 0.3–0.5s budget; and the full cinematic's way out is 「我自己看」, kept clear
// of the language switch.
//
// `?quality=low` keeps the scene light enough for software rendering (headless CI
// has no GPU). The epoch pins tonight off every milestone window, so the lower
// edge (#88) always holds the closing line in these tests.
const APP = `/?quality=low&epoch=${MID_DECLINE_EPOCH}`;
// Explore framing on a landscape viewport, as written by the dev-only pose attribute.
const EXPLORE_POSE = '8.0,7.0,28.0';

async function gotoExplore(page: Page, url = APP) {
  await page.addInitScript(() => {
    localStorage.setItem('mira:seen-opening', '1');
    localStorage.removeItem('mira:learned-controls');
  });
  await page.goto(url);
  await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('loading')).toHaveCount(0);
  // The pose attribute lands at the end of the first completed frame: the scene is
  // really running. A keypress restamps the shared idle clock — and proves keys do
  // not graduate the bar on their own.
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });
  await page.keyboard.press('Shift');
}

test.describe('the quiet bar and its graduation', () => {
  test('the first look holds three controls; the first zoom graduates 暂停 and 今晚的 Mira', async ({ page }) => {
    await gotoExplore(page);

    // 自由观看第一眼: 环境音, 语言, 完整开场 — and nothing else, even after the
    // keypress above.
    await expect(page.getByTestId('ambient-toggle')).toBeVisible();
    await expect(page.getByTestId('language-toggle')).toBeVisible();
    await expect(page.getByTestId('replay-opening')).toBeVisible();
    await expect(page.getByTestId('pause-toggle')).toHaveCount(0);
    await expect(page.getByTestId('tonight-save')).toHaveCount(0);
    await expect(page.getByTestId('return-to-view')).toHaveCount(0);

    // 第一次拖拽或缩放之后.
    await manipulateScene(page);
    await expect(page.getByTestId('pause-toggle')).toBeVisible();
    await expect(page.getByTestId('tonight-save')).toBeVisible();
    // 今晚的 Mira keeps its own casing — never set as all-caps MIRA.
    const transform = await page.getByTestId('tonight-save').evaluate((el) => getComputedStyle(el).textTransform);
    expect(transform).toBe('none');
  });

  test('a ritual replay returns the bar to the quiet first look', async ({ page }) => {
    await gotoExplore(page, `${APP}&cinematic-scale=2`);

    await manipulateScene(page);
    await expect(page.getByTestId('pause-toggle')).toBeVisible();

    await page.getByTestId('replay-opening').click();
    await expect(page.getByTestId('cinematic-overlay')).toBeVisible();
    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 45000 });

    // 落地之后又是第一眼: the graduated controls wait for this visit's own first
    // drag or zoom; the three constants never left.
    await expect(page.getByTestId('pause-toggle')).toHaveCount(0);
    await expect(page.getByTestId('tonight-save')).toHaveCount(0);
    await expect(page.getByTestId('return-to-view')).toHaveCount(0);
    await expect(page.getByTestId('ambient-toggle')).toBeVisible();
    await expect(page.getByTestId('replay-opening')).toBeVisible();
    await expect(page.getByTestId('language-toggle')).toBeVisible();
  });

  test('主视角 appears once the camera leaves the main view and is gone on return', async ({ page }) => {
    await gotoExplore(page);
    await expect(page.getByTestId('return-to-view')).toHaveCount(0);

    await dragOffMainView(page);
    const back = page.getByTestId('return-to-view');
    await expect(back).toBeVisible({ timeout: 15000 });
    await back.click();

    // 回到之后消失: the camera settles on the explore framing and the control leaves.
    await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', EXPLORE_POSE, { timeout: 15000 });
    await expect(back).toHaveCount(0);
  });
});

test.describe('the epilogue hush', () => {
  test('the bar lets go of the screen within its 0.3–0.5s budget', async ({ page }) => {
    await gotoExplore(page, `${APP}${IDLE_FAST}`);
    const topBar = page.getByTestId('top-bar');
    // At rest the bar's fade is the slow return from the interrupt.
    expect(await topBar.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe(
      `${TRANSITIONS.TOP_BAR_EPILOGUE_RETURN}s`,
    );

    await expect(page.getByTestId('epilogue-text')).toBeVisible({ timeout: 15000 });
    // The exit runs on the epilogue's own budget (the window itself is pinned by
    // tests/unit/animationTiming.spec.ts)…
    expect(await topBar.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe(
      `${TRANSITIONS.TOP_BAR_EPILOGUE_EXIT}s`,
    );
    // …and once it has run, the bar is fully gone while the epilogue holds the screen.
    await expect(topBar).toHaveCSS('opacity', '0', { timeout: 5000 });
  });
});

// 顶栏衬底 (#137): the rule and its reason live at topBarBacking.
test.describe('顶栏衬底 (#137)', () => {
  const backing = (page: Page) => page.getByTestId('top-bar-backing');

  // #148: the page reads the backing's computed opacity when the element enters
  // the DOM and on every frame after that, up to the first frame at full
  // opacity. Reading inside the page keeps the result off the test's own timing.
  const recordBackingFade = (page: Page) => page.evaluate(
    () => new Promise<{ at: number; opacity: number }[]>((resolve) => {
      const samples: { at: number; opacity: number }[] = [];
      const read = () => {
        const el = document.querySelector('[data-testid="top-bar-backing"]');
        if (el) samples.push({ at: performance.now(), opacity: Number(getComputedStyle(el).opacity) });
        return el !== null;
      };
      const deadline = performance.now() + 20_000;
      const tick = () => {
        read();
        if (samples.at(-1)?.opacity === 1 || performance.now() > deadline) resolve(samples);
        else requestAnimationFrame(tick);
      };
      const observer = new MutationObserver(() => {
        if (!read()) return;
        observer.disconnect();
        requestAnimationFrame(tick);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }),
  );

  for (const frame of [PORTRAIT_FRAME, SE_FRAME]) {
    test(`${frame.width}×${frame.height} 竖屏 carries it only while the camera is off the main view`, async ({ page }) => {
      await page.setViewportSize(frame);
      await gotoExplore(page);
      await expect(backing(page)).toHaveCount(0);

      await manipulateScene(page);
      await expect(page.getByTestId('return-to-view')).toBeVisible({ timeout: 15000 });
      await expect(backing(page)).toHaveCount(1);
      // Painted, not merely mounted, and behind the row's words.
      await expect(backing(page)).toHaveCSS('background-image', /linear-gradient/);
      const barBox = await page.getByTestId('top-bar').boundingBox();
      const backingBox = await backing(page).boundingBox();
      expect(backingBox!.y).toBe(barBox!.y);
      expect(backingBox!.height / barBox!.height).toBeCloseTo(1.6, 1);
      const paint = await backing(page).evaluate((el) => getComputedStyle(el));
      expect(Number(paint.zIndex)).toBeLessThan(0);
      expect(paint.pointerEvents).toBe('none');

      await page.getByTestId('return-to-view').click();
      await expect(page.getByTestId('return-to-view')).toHaveCount(0, { timeout: 15000 });
      await expect(backing(page)).toHaveCount(0);
    });
  }

  test('横屏 carries none, wide or narrow, even off the main view', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await gotoExplore(page);
    await expect(backing(page)).toHaveCount(0);

    await manipulateScene(page);
    await expect(page.getByTestId('return-to-view')).toBeVisible({ timeout: 15000 });
    await expect(backing(page)).toHaveCount(0);

    // 568×320 is inside the compact breakpoint — 「更多」 proves it — and still
    // landscape: compact, but not tall.
    await page.setViewportSize({ width: 568, height: 320 });
    await gotoExplore(page);
    await expect(page.getByTestId('more-toggle')).toBeVisible();
    await expect(backing(page)).toHaveCount(0);

    await manipulateScene(page);
    await expect(page.getByTestId('return-to-view')).toBeVisible({ timeout: 15000 });
    await expect(backing(page)).toHaveCount(0);
  });

  test('390×844 竖屏 fades it in behind 「主视角」 (#148)', async ({ page }) => {
    await page.setViewportSize(PORTRAIT_FRAME);
    await gotoExplore(page);
    const fade = recordBackingFade(page);
    await manipulateScene(page);
    const samples = await fade;
    // Mounted transparent, and at full opacity one fade later.
    expect(samples[0].opacity).toBe(0);
    expect(samples.at(-1)!.opacity).toBe(1);
    const seconds = (samples.at(-1)!.at - samples[0].at) / 1000;
    expect(seconds).toBeGreaterThanOrEqual(TRANSITIONS.TOP_BAR_BACKING_FADE / 2);
    expect(seconds).toBeLessThanOrEqual(TRANSITIONS.TOP_BAR_BACKING_FADE * 2);
  });

  test('390×844 竖屏 shows it at once under reduced motion (#148)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(PORTRAIT_FRAME);
    await gotoExplore(page);
    const fade = recordBackingFade(page);
    await manipulateScene(page);
    const samples = await fade;
    // No ramp: full opacity within two frames of mounting, whatever the frame rate.
    expect(samples.findIndex((sample) => sample.opacity === 1)).toBeLessThanOrEqual(2);
  });
});

test.describe('完整开场里的「我自己看」', () => {
  test('the way out reads 我自己看, kept clear of the language switch', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('mira:seen-opening'));
    await page.goto(APP);
    await expect(page.getByTestId('cinematic-overlay')).toBeVisible({ timeout: 15000 });

    const leave = page.getByTestId('look-myself');
    await expect(leave).toHaveText('我自己看');
    // 它和语言开关分得开: the way out is a bordered pill, the language switch bare text.
    const pill = await leave.evaluate((el) => ({
      borderWidth: Number.parseFloat(getComputedStyle(el).borderTopWidth),
      radius: Number.parseFloat(getComputedStyle(el).borderTopLeftRadius),
    }));
    expect(pill.borderWidth).toBeGreaterThan(0);
    expect(pill.radius).toBeGreaterThan(10);
    expect(await page.getByTestId('language-toggle').evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('0px');

    // 完整开场期间仍有环境音和语言.
    await expect(page.getByTestId('ambient-toggle')).toBeVisible();
    await expect(page.getByTestId('language-toggle')).toBeVisible();

    // The self-hosted serif subset really carries the new copy's glyphs — no
    // silent system-font fallback (the same guard the fontSubset unit spec pins).
    const faceLoaded = await leave.evaluate(() => document.fonts.check('12px "Mira Serif SC"', '自'));
    expect(faceLoaded).toBe(true);

    await leave.click();
    await expect(page.getByTestId('explore-ui')).toBeVisible();
  });

  test('in English the way out reads “I’ll look myself.”', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('mira:seen-opening'));
    await page.goto(APP);
    await expect(page.getByTestId('cinematic-overlay')).toBeVisible({ timeout: 15000 });

    await page.getByTestId('language-toggle').click();
    await expect(page.getByTestId('look-myself')).toHaveText('I’ll look myself.');
  });
});
