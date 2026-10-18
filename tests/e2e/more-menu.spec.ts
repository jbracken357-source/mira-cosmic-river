import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { IDLE_FAST, manipulateScene, MID_DECLINE_EPOCH } from './helpers';
import { calculateOrbitalPosition, PHYSICS } from '../../src/constants/physics';
import {
  PORTRAIT_TILT,
  portraitExplorePose,
  projectToScreenPercent,
  screenDiscRadiusPercent,
} from '../../src/lib/portraitFraming';

// 「更多」 (#111): 手机顶栏一行排下. On the phone-portrait bar the row never wraps —
// 暂停 (after graduation), 完整开场 and 语言 tuck into the 「更多」 panel below the
// bar; the panel opens on the button, closes on an outside press or Esc, and never
// covers the 双星. The landscape phone and the desktop keep their one wide row
// unchanged (their pins live in top-bar.spec and interface.spec's viewport loop).
//
// `?quality=low` keeps the scene light enough for software rendering (headless CI
// has no GPU). The epoch pins tonight off every milestone window, same as the
// other specs.
const APP = `/?quality=low&epoch=${MID_DECLINE_EPOCH}`;
const SEEN_KEY = 'mira:seen-opening';
// The compact verdict's frames: the two named portrait phones. The landscape
// phone (844×390) stays wide — its pin is at the bottom of this file.
const PORTRAIT_FRAME = { width: 390, height: 844 };
const SE_FRAME = { width: 320, height: 568 };

async function gotoExplore(page: Page, url = APP) {
  await page.addInitScript(
    ({ seenKey }) => {
      localStorage.setItem(seenKey, '1');
      localStorage.removeItem('mira:learned-controls');
    },
    { seenKey: SEEN_KEY },
  );
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await page.getByTestId('explore-ui').waitFor({ timeout: 15000 });
  await expect(page.getByTestId('loading')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });
  // A keypress restamps the shared idle clock so the idle takeover never fires
  // mid-assertion on slow software rendering (same guard as top-bar.spec).
  await page.keyboard.press('Shift');
}

// Read one dev probe ("x,y" screen percents) off the canvas (same seam as the
// 竖屏长卷 specs).
async function probe(page: Page, name: string): Promise<[number, number]> {
  const raw = await page.locator('canvas').getAttribute(name);
  expect(raw, `${name} probe is written`).toBeTruthy();
  const [x, y] = raw!.split(',').map(Number);
  return [x, y];
}

// The quiet bar before any manipulation — its height is the one row the compact
// bar must keep through graduation.
async function quietBarHeight(page: Page): Promise<number> {
  const bar = await page.getByTestId('top-bar').boundingBox();
  expect(bar, 'the bar has a box').toBeTruthy();
  return bar!.height;
}

// The one-row verdict: every control directly on the bar tops out on the same
// line, and the bar's height is still the quiet first look's. Sub-pixel reads
// round to the laid-out pixel (the precedent in interface.spec).
async function expectOneRow(page: Page, testIds: string[], quietHeight: number) {
  const tops: number[] = [];
  const bottoms: number[] = [];
  for (const testId of testIds) {
    const box = await page.getByTestId(testId).boundingBox();
    expect(box, `${testId} has a box`).toBeTruthy();
    tops.push(Math.round(box!.y));
    bottoms.push(Math.round(box!.y + box!.height));
    expect(Math.round(box!.height), `${testId} keeps a 44px target`).toBeGreaterThanOrEqual(44);
  }
  expect(new Set(tops).size, `all of [${testIds}] top out on one line`).toBe(1);
  expect(new Set(bottoms).size, `all of [${testIds}] bottom out on one line`).toBe(1);
  const bar = await page.getByTestId('top-bar').boundingBox();
  expect(Math.round(bar!.height), 'graduation does not grow the compact bar').toBe(
    Math.round(quietHeight),
  );
}

// Graduation with the camera back home: a real drag graduates the bar (any
// visible drag also carries the camera off the main view), then 「主视角」 walks
// it home — the everyday state of having explored and settled back to watch.
async function graduateHome(page: Page) {
  await manipulateScene(page);
  const back = page.getByTestId('return-to-view');
  await back.waitFor({ timeout: 15000 });
  await back.click();
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', '-8.6,22.6,25.0', {
    timeout: 15000,
  });
  await expect(back).toHaveCount(0);
  await expect(page.getByTestId('tonight-save')).toBeVisible();
}

test.describe('手机顶栏一行排下 (#111)', () => {
  for (const frame of [PORTRAIT_FRAME, SE_FRAME]) {
    test(`毕业后 the bar stays one row, zh then en (${frame.width}×${frame.height})`, async ({ page }) => {
      await page.setViewportSize(frame);
      await gotoExplore(page);
      const quietHeight = await quietBarHeight(page);

      // The tuck is in effect: the quiet row holds 环境音 and 「更多」 only — the
      // other three live inside the panel, not on the row.
      await expect(page.getByTestId('more-toggle')).toBeVisible();
      for (const testId of ['pause-toggle', 'replay-opening', 'language-toggle']) {
        await expect(page.getByTestId(testId)).toHaveCount(0);
      }

      // 中文: graduated, camera home — one row of 今晚的 Mira, 环境音, 「更多」.
      await graduateHome(page);
      await expectOneRow(page, ['tonight-save', 'ambient-toggle', 'more-toggle'], quietHeight);

      // The panel carries what the row gave up (暂停 joined with graduation).
      await page.getByTestId('more-toggle').click();
      await expect(page.getByTestId('more-panel')).toBeVisible();
      for (const testId of ['pause-toggle', 'replay-opening', 'language-toggle']) {
        await expect(page.getByTestId(testId)).toBeVisible();
      }
      await expect(page.getByTestId('language-toggle')).toHaveText('EN');
      // The self-hosted serif subset really carries 「更多」's glyphs — no silent
      // system-font fallback (the same guard the fontSubset unit spec pins).
      const serifLoaded = await page.evaluate(() =>
        document.fonts.check('12px "Mira Serif SC"', '更多'),
      );
      expect(serifLoaded).toBe(true);
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('more-panel')).toHaveCount(0);

      // English, switched through the panel itself: the row still holds one line.
      await page.getByTestId('more-toggle').click();
      await page.getByTestId('language-toggle').click();
      await page.keyboard.press('Escape');
      await expectOneRow(page, ['tonight-save', 'ambient-toggle', 'more-toggle'], quietHeight);
      await expect(page.getByTestId('tonight-save')).toContainText('Tonight');
    });
  }

  test('390×844 keeps the row with 主视角 present (en)', async ({ page }) => {
    await page.setViewportSize(PORTRAIT_FRAME);
    await gotoExplore(page);
    const quietHeight = await quietBarHeight(page);

    await page.getByTestId('more-toggle').click();
    await page.getByTestId('language-toggle').click();
    await page.keyboard.press('Escape');

    // The away state is the row at its fullest: 主视角, 今晚的 Mira, 环境音, 「更多」.
    await manipulateScene(page);
    await expect(page.getByTestId('return-to-view')).toBeVisible({ timeout: 15000 });
    await expectOneRow(
      page,
      ['return-to-view', 'tonight-save', 'ambient-toggle', 'more-toggle'],
      quietHeight,
    );
  });

  test('「更多」 opens and closes by keyboard, handing focus back', async ({ page }) => {
    await page.setViewportSize(PORTRAIT_FRAME);
    await gotoExplore(page);
    const more = page.getByTestId('more-toggle');

    // Enter opens, focus lands inside, Tab reaches the panel's own controls
    // (the quiet bar holds 完整开场 first), Esc closes and returns the focus.
    await more.focus();
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Enter');
    const panel = page.getByTestId('more-panel');
    await expect(panel).toBeVisible();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('replay-opening')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(more).toBeFocused();
  });

  test('the panel\'s 暂停, 完整开场 and 语言 all work; a language switch keeps it open', async ({ page }) => {
    await page.setViewportSize(PORTRAIT_FRAME);
    await gotoExplore(page);
    await graduateHome(page);

    // 暂停 (tucked with graduation): pressed state and label both answer.
    await page.getByTestId('more-toggle').click();
    const pause = page.getByTestId('pause-toggle');
    await expect(pause).toHaveAttribute('aria-pressed', 'false');
    await pause.click();
    await expect(pause).toHaveAttribute('aria-pressed', 'true');
    await expect(pause).toHaveText('恢复');
    await pause.click();
    await expect(pause).toHaveAttribute('aria-pressed', 'false');

    // 语言 inside the panel: the switch works, the panel stays open and Esc
    // still closes it — the panel never collapses with the language.
    await page.getByTestId('language-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByTestId('more-panel')).toBeVisible();
    // The paused-then-resumed state reads in English too (playing again → Pause).
    await expect(page.getByTestId('pause-toggle')).toContainText('Pause');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('more-panel')).toHaveCount(0);

    // 「更多」 is still usable after the switch, in the other language too.
    await page.getByTestId('more-toggle').click();
    await expect(page.getByTestId('more-panel')).toBeVisible();
    await page.getByTestId('language-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');

    // 完整开场 from the panel: the ritual plays, and the landing is the quiet
    // first look again — bar graduated away, 「更多」 back to closed.
    await page.getByTestId('replay-opening').click();
    await expect(page.getByTestId('cinematic-overlay')).toBeVisible();
    await page.getByTestId('look-myself').click();
    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 45000 });
    await expect(page.getByTestId('tonight-save')).toHaveCount(0);
    await expect(page.getByTestId('more-panel')).toHaveCount(0);
    await expect(page.getByTestId('more-toggle')).toHaveAttribute('aria-expanded', 'false');
    // The learned gesture is remembered across the replay — no hint comes back.
    await expect(page.getByTestId('interaction-hint')).toHaveCount(0);
  });

  test('the open panel never covers the 双星 (both phone frames)', async ({ page }) => {
    // Reduced motion parks the orbit (the #108/#112 pin), so the projected
    // discs stand still while software rendering stretches the reads.
    await page.emulateMedia({ reducedMotion: 'reduce' });

    for (const frame of [PORTRAIT_FRAME, SE_FRAME]) {
      await page.setViewportSize(frame);
      await gotoExplore(page);

      // The fullest panel: 暂停 joins with graduation (any drag also carries the
      // camera away — the away state is fine here, the panel is what is measured).
      await manipulateScene(page);
      await page.getByTestId('return-to-view').waitFor({ timeout: 15000 });
      await page.getByTestId('more-toggle').click();
      const panel = page.getByTestId('more-panel');
      await expect(panel).toBeVisible();
      const panelBox = (await panel.boundingBox())!;

      // Disc margins in px at the explore pose, from the seam — the same standard
      // the 顶栏 pins use (the giant's dense atmosphere ×1.4; the companion's
      // accretion reach ×4.8 at 390×844, ×1.4 at 320×568 where the long scroll
      // cannot hold the spherical standard — mobile.spec's per-frame precedent).
      const pose = portraitExplorePose(frame.width / frame.height);
      const home = calculateOrbitalPosition(0, PHYSICS.ORBIT);
      const discs = [
        { name: 'data-mira-a-screen', point: home.primary, radius: PHYSICS.MIRA_A.radius * 1.4 },
        {
          name: 'data-mira-b-screen',
          point: home.companion,
          radius: PHYSICS.MIRA_B.radius * (frame === PORTRAIT_FRAME ? 4.8 : 1.4),
        },
      ] as const;

      for (const disc of discs) {
        const [xp, yp] = await probe(page, disc.name);
        const cx = (xp / 100) * frame.width;
        const cy = (yp / 100) * frame.height;
        const center = projectToScreenPercent(disc.point, pose, frame.width / frame.height, PORTRAIT_TILT);
        const marginPx =
          (screenDiscRadiusPercent(center, disc.radius, pose, frame.width / frame.height) / 100) *
          frame.height;
        // The nearest point of the panel box to the disc's centre, compared
        // against the disc's own radius: the panel keeps clear of the whole disc.
        const nearestX = Math.max(panelBox.x, Math.min(cx, panelBox.x + panelBox.width));
        const nearestY = Math.max(panelBox.y, Math.min(cy, panelBox.y + panelBox.height));
        expect(
          Math.hypot(cx - nearestX, cy - nearestY),
          `${disc.name}'s disc clears the open panel (${frame.width}×${frame.height})`,
        ).toBeGreaterThan(marginPx);
      }

      await page.keyboard.press('Escape');
      await expect(panel).toHaveCount(0);
    }
  });

  test('the panel lets go of the screen with the bar when the epilogue comes', async ({ page }) => {
    await page.setViewportSize(PORTRAIT_FRAME);
    await gotoExplore(page, `${APP}${IDLE_FAST}`);

    await page.getByTestId('more-toggle').click();
    const panel = page.getByTestId('more-panel');
    await expect(panel).toBeVisible();

    // 结语出现时随顶栏退场: the whole bar (panel included) fades on the epilogue's
    // own budget and stops taking pointer events — the panel is not a way for the
    // hushed interface to keep holding the screen.
    await expect(page.getByTestId('epilogue-text')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('top-bar')).toHaveCSS('opacity', '0', { timeout: 5000 });
    expect(await panel.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
  });

  test('844×390 横屏 keeps the wide one row — nothing tucks', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await gotoExplore(page);

    await expect(page.getByTestId('more-toggle')).toHaveCount(0);
    await expect(page.getByTestId('more-panel')).toHaveCount(0);

    // The quiet first look holds the three constants directly on the row.
    for (const testId of ['ambient-toggle', 'replay-opening', 'language-toggle']) {
      await expect(page.getByTestId(testId)).toBeVisible();
    }
    await manipulateScene(page);
    for (const testId of ['pause-toggle', 'tonight-save', 'return-to-view']) {
      await expect(page.getByTestId(testId)).toBeVisible({ timeout: 15000 });
    }
  });
});

test.describe('「更多」 by touch (#111)', () => {
  test.use({ viewport: PORTRAIT_FRAME, hasTouch: true, isMobile: true });

  test('a tap on the button opens 「更多」; a tap on the sky outside closes it', async ({ page }) => {
    await gotoExplore(page);
    const more = page.getByTestId('more-toggle');
    const panel = page.getByTestId('more-panel');

    const box = await more.boundingBox();
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect(panel).toBeVisible();
    // The sky point sits above the bar's buttons and clear of the pair — the
    // top-right corner of the frame.
    const canvas = await page.locator('canvas').boundingBox();
    await page.touchscreen.tap(canvas!.x + canvas!.width - 10, canvas!.y + 8);
    await expect(panel).toHaveCount(0);
  });
});
