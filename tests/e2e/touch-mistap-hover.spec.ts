import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { MID_DECLINE_EPOCH } from './helpers';

// #109: 触屏误触保护与「只给能悬停的设备」的悬停样式. On a touch device 「我自己看」
// and 完整开场 trade places at the same corner spot the moment the viewer leaves
// the full opening, so the second press of a double-tap (or a laggy first press)
// restarts the ritual the viewer just declined — for ~500ms after the leave
// (spec #107) the replay button holds that echo. And a touch tap leaves :hover
// sticking to the pressed control, so the whisper controls' lift and underline
// must exist only where the device can actually hover: `(hover: hover)`.
//
// The review round measured the trade at 320×568 portrait; since #111 tucks
// 完整开场 into 「更多」 on the portrait bar, the corner spot there is held by the
// 「更多」 button itself and the mistap lands on a harmless panel — the premise now
// lives where the replay button still sits on the row: the landscape touch phone.
//
// `?quality=low` keeps the scene light enough for software rendering (headless CI
// has no GPU). The epoch pins tonight off every milestone window, same as the
// interface specs.
const APP = `/?quality=low&epoch=${MID_DECLINE_EPOCH}`;
const SEEN_KEY = 'mira:seen-opening';
// The landscape touch phone: the bar keeps its wide row (#111), so 完整开场
// still lands on the spot 「我自己看」 just left.
const TOUCH_VIEWPORT = { width: 844, height: 390 };

async function gotoOpening(page: Page) {
  await page.addInitScript((key) => localStorage.removeItem(key), SEEN_KEY);
  await page.goto(APP);
  await page.waitForLoadState('networkidle');
  // The overlay mounts when the entry gate opens — the opening clock starts there.
  await expect(page.getByTestId('cinematic-overlay')).toBeVisible({ timeout: 30000 });
}

async function gotoExplore(page: Page) {
  await page.addInitScript((key) => localStorage.setItem(key, '1'), SEEN_KEY);
  await page.goto(APP);
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });
}

// The whisper voice a viewer can measure: text colour and underline colour as
// alphas. At rest the underline is transparent (alpha 0); hover lifts both.
async function readVoice(locator: Locator): Promise<{ colorAlpha: number; underlineAlpha: number }> {
  return locator.evaluate((el) => {
    const style = getComputedStyle(el);
    const alpha = (value: string) =>
      Number(/rgba?\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/.exec(value)?.[1] ?? '1');
    return {
      colorAlpha: alpha(style.color),
      underlineAlpha: alpha(style.textDecorationColor),
    };
  });
}

test.describe('touch mistap (#109)', () => {
  test.use({ viewport: TOUCH_VIEWPORT, hasTouch: true, isMobile: true });

  test('a press right after 「我自己看」 does not restart the full opening', async ({ page }) => {
    await gotoOpening(page);

    const lookMyself = page.getByTestId('look-myself');
    const lookBox = await lookMyself.boundingBox();
    expect(lookBox, 'look-myself has a box').toBeTruthy();
    await page.touchscreen.tap(lookBox!.x + lookBox!.width / 2, lookBox!.y + lookBox!.height / 2);
    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });

    // The premise (#109's review, re-expressed where the row still holds 完整开场
    // after #111): 完整开场 arrives on the corner spot 「我自己看」 just left, so a
    // finger falling again lands on it.
    const replay = page.getByTestId('replay-opening');
    const replayBox = await replay.boundingBox();
    expect(replayBox, 'replay has a box').toBeTruthy();
    const overlapsX =
      replayBox!.x < lookBox!.x + lookBox!.width && lookBox!.x < replayBox!.x + replayBox!.width;
    const overlapsY =
      replayBox!.y < lookBox!.y + lookBox!.height && lookBox!.y < replayBox!.y + replayBox!.height;
    expect(overlapsX && overlapsY, 'replay lands on the spot look-myself left').toBe(true);

    // The mistap itself: a press on 完整开场 in the same instant, not a wish to
    // watch the opening again.
    await page.touchscreen.tap(replayBox!.x + replayBox!.width / 2, replayBox!.y + replayBox!.height / 2);
    await page.waitForTimeout(200);
    await expect(page.getByTestId('cinematic-overlay')).toHaveCount(0);
    await expect(page.getByTestId('explore-ui')).toBeVisible();

    // The press did land on a whisper control, and on a device that cannot hover
    // the underline never appeared — computed style, not class names.
    const voice = await readVoice(replay);
    expect(voice.underlineAlpha).toBe(0);
  });

  test('past the guard window 完整开场 answers again', async ({ page }) => {
    await gotoOpening(page);

    await page.getByTestId('look-myself').tap();
    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });

    // The echo window is ~500ms (spec #107); past it the button is a normal control.
    await page.waitForTimeout(700);
    await page.getByTestId('replay-opening').tap();
    await expect(page.getByTestId('cinematic-overlay')).toBeVisible({ timeout: 15000 });
  });

  test('a tapped whisper control never wears the hover underline', async ({ page }) => {
    await gotoExplore(page);

    // The language toggle is a whisper control that stays on screen after a tap
    // (the tap only swaps the label), so whatever hover the browser believes the
    // press earned is readable afterwards.
    const toggle = page.getByTestId('language-toggle');
    const rest = await readVoice(toggle);
    expect(rest.underlineAlpha).toBe(0);

    await toggle.tap();
    await page.waitForTimeout(100);
    const tapped = await readVoice(toggle);
    expect(tapped.underlineAlpha).toBe(0);
    expect(tapped.colorAlpha).toBe(rest.colorAlpha);
  });
});

test.describe('desktop hover (#109)', () => {
  // The default chromium project context: no touch, so `(hover: hover)` matches.

  test('the whisper controls still lift and underline under the mouse', async ({ page }) => {
    await gotoExplore(page);

    const replay = page.getByTestId('replay-opening');
    const rest = await readVoice(replay);
    expect(rest.underlineAlpha).toBe(0);

    await replay.hover();
    // The lift and the underline reveal are 260ms transitions — read past them.
    await page.waitForTimeout(450);
    const hovered = await readVoice(replay);
    expect(hovered.colorAlpha).toBeGreaterThan(rest.colorAlpha);
    expect(hovered.underlineAlpha).toBeGreaterThan(0);
  });
});
