import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MIRA_MAXIMUM_EPOCH_MS } from '../../src/lib/starClock';
import { TRANSLATIONS } from '../../src/constants/translations';
import { IDLE_FAST, manipulateScene, MID_DECLINE_EPOCH } from './helpers';

// 下缘 (#88): the closing line of the full cinematic holds the lower edge through
// free viewing — direct entry opens with it already there from the first frame,
// the milestone hint borrows the row for about eight seconds instead of stacking
// beside it, and the epilogue takes the screen while the line waits to come back.
const CLOSING_LINE_ZH = '在宇宙的尽头，我们依然相伴。';

async function directEntry(page: Page, query = `&epoch=${MID_DECLINE_EPOCH}`) {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('mira:seen-opening', '1');
  });
  await page.goto(`/?quality=low${query}`);
  await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });
  // Frames are really running once the pose attribute lands (see phase-readout).
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });
}

// Sample the closing line's computed opacity over `durationMs` (plus whether any
// animation is running) — the arrival rule is a motion contract, so the proofs
// read the motion, not a class name.
async function sampleOpacity(page: Page, durationMs: number) {
  const samples: { opacity: number; animations: number }[] = [];
  const deadline = Date.now() + durationMs;
  while (Date.now() < deadline) {
    samples.push(
      await page.getByTestId('lower-edge-closing-line').evaluate((el) => ({
        opacity: Number(getComputedStyle(el).opacity),
        animations: el.getAnimations().length,
      })),
    );
    await page.waitForTimeout(50);
  }
  return samples;
}

test.describe('the closing line at the lower edge', () => {
  test('direct entry opens with the line present from the first frame, no fade', async ({ page }) => {
    await directEntry(page);

    // 直达第一眼: no final beat was shown this session, so the arrival verdict is
    // 'present' — there is nothing to settle from.
    await expect(page.locator('[data-closing-line-arrival]')).toHaveAttribute(
      'data-closing-line-arrival',
      'present',
    );

    // The line is already there, in the opening's own words.
    const closingLine = page.getByTestId('lower-edge-closing-line');
    await expect(closingLine).toBeVisible();
    await expect(closingLine).toHaveText(CLOSING_LINE_ZH);
    // It never wears the controls' all-caps styling.
    const textTransform = await closingLine.evaluate((el) => getComputedStyle(el).textTransform);
    expect(textTransform).toBe('none');

    // Present from the first frame: opacity is 1 on every sample and no animation
    // ever runs on the line.
    const firstRead = await closingLine.evaluate((el) => ({
      opacity: Number(getComputedStyle(el).opacity),
      animations: el.getAnimations().length,
    }));
    expect(firstRead).toEqual({ opacity: 1, animations: 0 });
    const samples = await sampleOpacity(page, 600);
    for (const sample of samples) expect(sample.opacity).toBe(1);

    // 没有寻宝文案: neither the hint nor the found-it line exists anymore.
    await expect(page.getByTestId('tail-hint')).toHaveCount(0);
    await expect(page.getByTestId('tail-found')).toHaveCount(0);
    await expect(page.getByText(/去找她的尾巴|你找到了她的尾巴|Find her tail|You found her tail/)).toHaveCount(0);

    // And the full cinematic did not play.
    await expect(page.getByTestId('cinematic-overlay')).toHaveCount(0);
  });

  test('the cinematic landing settles the line into the lower edge within its budget', async ({ page }) => {
    test.setTimeout(120000);
    // The scaled opening runs to its natural ending — the final beat IS shown, so
    // the 终幕→下缘 transition applies: the arrival verdict is the ≤0.5s settle
    // (the budget itself is unit-pinned on TRANSITIONS.CLOSING_LINE_SETTLE).
    await page.addInitScript(() => localStorage.clear());
    await page.goto(`/?quality=low&cinematic-scale=2&epoch=${MID_DECLINE_EPOCH}`);
    await expect(page.getByTestId('cinematic-overlay')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 45000 });
    await expect(page.locator('[data-closing-line-arrival]')).toHaveAttribute(
      'data-closing-line-arrival',
      'settle',
    );

    // The line arrives at full opacity in the opening's own words.
    const closingLine = page.getByTestId('lower-edge-closing-line');
    await expect(closingLine).toBeVisible();
    await expect(closingLine).toHaveText(CLOSING_LINE_ZH);
    const samples = await sampleOpacity(page, 1000);
    expect(samples[samples.length - 1].opacity).toBe(1);
  });

  test('the milestone hint borrows the row for about eight seconds, then the line returns', async ({ page }) => {
    test.setTimeout(120000);
    await directEntry(page, `&epoch=${Math.round(MIRA_MAXIMUM_EPOCH_MS / 1000)}`);

    const hint = page.getByTestId('milestone-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toHaveAttribute('data-milestone-kind', 'maximum');
    await expect(hint).toContainText('本周期最亮');
    // 下缘同时只有这一句: the hint never stacks beside the closing line.
    await expect(page.getByTestId('lower-edge-closing-line')).toHaveCount(0);

    // 然后这句回来.
    await expect(hint).toHaveCount(0, { timeout: 20000 });
    await expect(page.getByTestId('lower-edge-closing-line')).toBeVisible();
  });

  test('reduced motion: the milestone hint changes opacity only, never displaces', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await directEntry(page, `&epoch=${Math.round(MIRA_MAXIMUM_EPOCH_MS / 1000)}`);

    const hint = page.getByTestId('milestone-hint');
    await expect(hint).toBeVisible();
    const transform = await hint.evaluate((el) => getComputedStyle(el).transform);
    expect(transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true);
    // The row still comes back to the closing line afterwards.
    await expect(hint).toHaveCount(0, { timeout: 20000 });
    await expect(page.getByTestId('lower-edge-closing-line')).toBeVisible();
  });

  test('the epilogue takes the screen; interrupting it brings the line back, never clears it', async ({ page }) => {
    // The dev-only idle overrides compress the 60s epilogue threshold into seconds
    // (same pattern as viewer-control.spec); production ignores them.
    await directEntry(page, `&epoch=${MID_DECLINE_EPOCH}${IDLE_FAST}`);
    // A viewer's keypress restamps the shared idle clock now that frames are proven
    // running, so the idle count starts from a ready scene.
    await page.keyboard.press('Shift');

    const closingLine = page.getByTestId('lower-edge-closing-line');
    await expect(closingLine).toBeVisible();

    // 结语出现时下缘这句让位.
    const epilogue = page.getByTestId('epilogue-text');
    await expect(epilogue).toBeVisible({ timeout: 15000 });
    await expect(closingLine).toHaveCount(0);

    // 打断结语后这句回到原位 — the input clears the epilogue, never the closing line.
    await page.keyboard.press('ArrowLeft');
    await expect(epilogue).toBeHidden({ timeout: 8000 });
    await expect(closingLine).toBeVisible();
    await expect(closingLine).toHaveText(CLOSING_LINE_ZH);
  });

  test('the epilogue breaks after the 句号 and never splits 「星尘」', async ({ page }) => {
    await directEntry(page, `&epoch=${MID_DECLINE_EPOCH}${IDLE_FAST}`);
    await page.keyboard.press('Shift');

    await expect(page.getByTestId('epilogue-text')).toBeVisible({ timeout: 15000 });
    const line1 = page.getByTestId('epilogue-line-1');
    const line2 = page.getByTestId('epilogue-line-2');
    await expect(line1).toHaveText('我们都是星尘。');
    // 第二行以「而我的星尘」开头.
    expect((await line2.textContent())?.startsWith('而我的星尘')).toBe(true);

    // 「星尘」不被拆开: every occurrence rides in a no-wrap island.
    for (const line of [line1, line2]) {
      const islands = line.locator('span.whitespace-nowrap');
      const count = await islands.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i += 1) {
        await expect(islands.nth(i)).toHaveText('星尘');
        const whiteSpace = await islands.nth(i).evaluate((el) => getComputedStyle(el).whiteSpace);
        expect(whiteSpace).toBe('nowrap');
      }
    }
  });

  test('the epilogue breaks after "starstuff." in English', async ({ page }) => {
    await directEntry(page, `&epoch=${MID_DECLINE_EPOCH}${IDLE_FAST}`);
    await page.keyboard.press('Shift');
    await page.getByTestId('language-toggle').click();

    await expect(page.getByTestId('epilogue-text')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('epilogue-line-1')).toHaveText('We are made of starstuff.');
    await expect(page.getByTestId('epilogue-line-2')).toHaveText('And my starstuff chose yours.');
  });

  test('the lower edge line and tonight’s phrase stay two different sentences', async ({ page }) => {
    await directEntry(page);
    // The sky line is the closing line of the full cinematic…
    await expect(page.getByTestId('lower-edge-closing-line')).toHaveText(TRANSLATIONS.ch.subtitle);
    // …and tonight's Mira keeps its own saved phrase — a memory, not the sky line.
    // The save entry joins the quiet bar after the visit's first manipulation (#90).
    await manipulateScene(page);
    await page.getByTestId('tonight-save').click();
    await expect(page.getByTestId('tonight-panel')).toBeVisible();
    await expect(page.getByTestId('tonight-toggle-phrase')).toHaveAttribute('aria-pressed', 'true');
    expect(TRANSLATIONS.ch.tonightPhrase).toBe('彼此牵引，共同前行');
    expect(TRANSLATIONS.ch.tonightPhrase).not.toBe(TRANSLATIONS.ch.subtitle);
  });
});
