import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MID_DECLINE_EPOCH, openTailCardViaKeyboard } from './helpers';

// Interface (#20): keyboard reachability of the star info cards, Esc + focus
// restore, 44px targets and accessible names, document language
// sync, interaction-hint exit and rediscovery, and the narrow/landscape viewports.
// #89: the cards open on the relationship line with the science paragraph second,
// and the tail card no longer carries a time-speed control.
//
// `?quality=low` keeps the scene light enough for software rendering (headless CI
// has no GPU). Behaviour is identical; only detail level differs. The epoch pins
// tonight off every milestone window, so the lower edge (#88) always holds the
// closing line in these tests.
const APP = `/?quality=low&epoch=${MID_DECLINE_EPOCH}`;
const EVIDENCE = 'docs/design-audit-2026-09-17/evidence';

async function gotoExplore(page: Page, url = APP) {
  await page.addInitScript(() => {
    localStorage.setItem('mira:seen-opening', '1');
    localStorage.removeItem('mira:found-tail');
    localStorage.removeItem('mira:learned-controls');
  });
  await page.goto(url);
  await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('loading')).toHaveCount(0);
  // The pose attribute lands at the end of the first completed frame: the scene is
  // really running. A keypress restamps the shared idle clock so the idle takeover
  // never fires mid-assertion on slow software rendering.
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });
  await page.keyboard.press('Shift');
}


async function expectMinTarget(page: Page, testId: string) {
  const locator = page.getByTestId(testId);
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${testId} has no box`).toBeTruthy();
  expect(box!.width, `${testId} narrower than 44px`).toBeGreaterThanOrEqual(44);
  expect(box!.height, `${testId} shorter than 44px`).toBeGreaterThanOrEqual(44);
}

test.describe('keyboard access to the star info', () => {
  test('a star trigger opens its card; Esc closes it and focus returns to the trigger', async ({ page }) => {
    await gotoExplore(page);

    const trigger = page.getByTestId('star-trigger-miraA');
    // sr-only until tabbed to: focusing it through the keyboard reveals it.
    await trigger.focus();
    await expect(trigger).toBeVisible();
    await page.keyboard.press('Enter');

    const card = page.getByTestId('info-card');
    await expect(card).toBeVisible();
    // Opening moves focus onto the (non-modal) card, so Esc starts somewhere sensible.
    await expect(card).toBeFocused();
    await expect(card).toHaveAttribute('role', 'region');

    await page.keyboard.press('Escape');
    await expect(card).toHaveCount(0);
    // Focus is back on the trigger that opened the card.
    await expect(trigger).toBeFocused();
  });

  test('switching directly between cards keeps focus on the new card; Esc returns to the original trigger', async ({ page }) => {
    await gotoExplore(page);

    const triggerA = page.getByTestId('star-trigger-miraA');
    await triggerA.focus();
    await page.keyboard.press('Enter');
    const card = page.getByTestId('info-card');
    await expect(card).toBeVisible();
    await expect(card).toBeFocused();

    // Straight from card A to card B: the old node exits before the new one mounts,
    // and focus must land on the new card instead of falling back to body.
    const triggerB = page.getByTestId('star-trigger-miraB');
    await triggerB.focus();
    await page.keyboard.press('Enter');
    await expect(card).toContainText('蒭藁增二 B');
    await expect(card).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(card).toHaveCount(0);
    // The return target is where the reading session started.
    await expect(triggerA).toBeFocused();
  });

  test('the close control has an accessible name and closes with the keyboard', async ({ page }) => {
    await gotoExplore(page);

    await openTailCardViaKeyboard(page);
    const card = page.getByTestId('info-card');

    const close = page.getByTestId('info-card-close');
    await expect(close).toHaveAttribute('aria-label', /^(关闭|Close)$/);
    await close.focus();
    await page.keyboard.press('Enter');
    await expect(card).toHaveCount(0);
  });

  test('the tail card carries no time-speed control (#89)', async ({ page }) => {
    await gotoExplore(page);

    await openTailCardViaKeyboard(page);
    const card = page.getByTestId('info-card');
    await expect(card).toBeVisible();
    // The slider is gone from the scene's only remaining card surface.
    await expect(card.locator('input[type="range"]')).toHaveCount(0);
    await expect(card.locator('#tail-time-speed')).toHaveCount(0);
    // The tail's own body is untouched this ticket.
    await expect(card.getByTestId('info-card-science')).toContainText('13');
    await expect(card.getByTestId('info-card-first-line')).toHaveCount(0);
  });
});

test.describe('the card opens on the relationship line (#89)', () => {
  test('Mira B: first the companionship line, then the whole science paragraph', async ({ page }) => {
    await gotoExplore(page);

    const trigger = page.getByTestId('star-trigger-miraB');
    await trigger.focus();
    await page.keyboard.press('Enter');

    const card = page.getByTestId('info-card');
    await expect(card.getByTestId('info-card-first-line')).toHaveText('它还在旁边。你哪天来，都在。');
    const science = card.getByTestId('info-card-science');
    await expect(science).toContainText('新星爆发');
    // The relationship line is what meets the eye first: it precedes the science.
    const body = await card.innerText();
    expect(body.indexOf('它还在旁边。你哪天来，都在。')).toBeLessThan(body.indexOf('新星爆发'));
  });

  test('Mira A: the first line never counts the 332 days; the phase line stays', async ({ page }) => {
    await gotoExplore(page);

    const trigger = page.getByTestId('star-trigger-miraA');
    await trigger.focus();
    await page.keyboard.press('Enter');

    const card = page.getByTestId('info-card');
    const firstLine = card.getByTestId('info-card-first-line');
    await expect(firstLine).toHaveText('亮度一直在变。你看到的是这一晚。');
    expect(await firstLine.innerText()).not.toContain('332');
    // The science paragraph keeps the full original copy, period included…
    await expect(card.getByTestId('info-card-science')).toContainText('332');
    // …and the phase line still answers days-to-next-extremum and direction.
    const phaseLine = card.locator('[data-phase-days-to-max]');
    await expect(phaseLine).toBeVisible();
    expect(Number(await phaseLine.getAttribute('data-phase-days-to-max'))).toBeGreaterThanOrEqual(0);
    await expect(card.getByTestId('info-card-first-line')).toBeVisible();
  });

  test('both first lines switch with the language toggle', async ({ page }) => {
    await gotoExplore(page);

    const triggerA = page.getByTestId('star-trigger-miraA');
    await triggerA.focus();
    await page.keyboard.press('Enter');
    const card = page.getByTestId('info-card');
    await expect(card.getByTestId('info-card-first-line')).toHaveText('亮度一直在变。你看到的是这一晚。');

    await page.getByTestId('language-toggle').click();
    await expect(card.getByTestId('info-card-first-line')).toHaveText(
      'The light keeps changing. This is the night you caught.',
    );

    const triggerB = page.getByTestId('star-trigger-miraB');
    await triggerB.focus();
    await page.keyboard.press('Enter');
    await expect(card.getByTestId('info-card-first-line')).toHaveText(
      'It is still right beside the other. Any day you come, it is here.',
    );
    await expect(card.getByTestId('info-card-science')).toContainText('nova');
  });
});

test.describe('touch targets and focus', () => {
  test('the main explore controls keep a 44px target on a phone-sized viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoExplore(page);

    for (const testId of [
      'return-to-view',
      'tonight-save',
      'ambient-toggle',
      'pause-toggle',
      'replay-opening',
      'language-toggle',
    ]) {
      await expectMinTarget(page, testId);
    }

    await openTailCardViaKeyboard(page);
    await expectMinTarget(page, 'info-card-close');
  });

  test('tabbing to a control shows the shared focus ring', async ({ page }) => {
    await gotoExplore(page);

    const pause = page.getByTestId('pause-toggle');
    await pause.focus();
    const outline = await pause.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).toBe('solid');
  });
});

test.describe('language sync', () => {
  test('the document language follows the copy, in explore and during the opening', async ({ page }) => {
    await gotoExplore(page);

    // Default language is Chinese.
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');

    await page.getByTestId('language-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByTestId('language-toggle')).toHaveText('中文');

    // Replay the opening: the direct-entry button follows the same language.
    await page.getByTestId('replay-opening').click();
    await expect(page.getByTestId('cinematic-overlay')).toBeVisible();
    await expect(page.getByTestId('skip-cinematic')).toHaveText('Enter early');

    await page.getByTestId('language-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await expect(page.getByTestId('skip-cinematic')).toHaveText('提前进入');
  });

  test('the direct-entry button keeps a 44px target during the opening', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('mira:seen-opening');
    });
    await page.goto(APP);
    await expect(page.getByTestId('cinematic-overlay')).toBeVisible({ timeout: 15000 });
    await expectMinTarget(page, 'skip-cinematic');
  });
});

test.describe('interaction hint exit and rediscovery', () => {
  test('the first scene manipulation retires the hint; a quiet entry brings it back', async ({ page }) => {
    await gotoExplore(page);

    const hint = page.getByTestId('interaction-hint');
    await expect(hint).toBeVisible();

    // Zoom on the canvas is scene manipulation; presses on UI buttons are not.
    await page.mouse.move(640, 400);
    await page.mouse.wheel(0, 120);
    await expect(hint).toHaveCount(0);
    // The learned state is written at dismissal…
    expect(await page.evaluate(() => localStorage.getItem('mira:learned-controls'))).toBe('1');

    const recall = page.getByTestId('interaction-hint-recall');
    await expect(recall).toBeVisible();
    await expectMinTarget(page, 'interaction-hint-recall');
    await recall.click();
    await expect(hint).toBeVisible();
  });

  test('a returning visit does not show the hint again, but the recall entry stays', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('mira:seen-opening', '1');
      localStorage.setItem('mira:learned-controls', '1');
    });
    await page.goto(APP);
    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });

    await expect(page.getByTestId('interaction-hint')).toHaveCount(0);
    await expect(page.getByTestId('interaction-hint-recall')).toBeVisible();
  });
});

test.describe('card motion', () => {
  test('reduced motion opens the card without any displacement', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoExplore(page);

    await openTailCardViaKeyboard(page);
    const card = page.getByTestId('info-card');
    // No translate on the way in: the card only fades, instantly.
    const transform = await card.evaluate((el) => getComputedStyle(el).transform);
    expect(transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true);
  });
});

// Narrow and landscape viewports: the main controls stay visible and reachable,
// and the card never covers its own close control. Screenshots are the ticket's
// visual evidence.
const VIEWPORTS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '844x390-landscape', width: 844, height: 390 },
] as const;

for (const viewport of VIEWPORTS) {
  test(`controls stay reachable at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await gotoExplore(page);

    for (const testId of ['pause-toggle', 'replay-opening', 'language-toggle']) {
      await expect(page.getByTestId(testId)).toBeVisible();
    }
    // The closing line of the full cinematic holds the lower edge at every size (#88).
    await expect(page.getByTestId('lower-edge-closing-line')).toBeVisible();

    await openTailCardViaKeyboard(page);
    const card = page.getByTestId('info-card');
    // The card never covers its own close control.
    const close = page.getByTestId('info-card-close');
    await expect(close).toBeVisible();
    await close.click();
    await expect(card).toHaveCount(0);

    await page.screenshot({ path: `${EVIDENCE}/interface-20-${viewport.name}.png` });
  });
}

// Evidence captures: the open card and the epilogue in its WenKai face, kept as
// living tests so the proof re-renders whenever the interface changes.
test.describe('evidence captures', () => {
  test('the open info card at 390x844', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoExplore(page);

    await page.getByTestId('star-trigger-miraA').focus();
    await page.keyboard.press('Enter');
    const card = page.getByTestId('info-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('蒭藁增二 A');
    // Let the enter animation settle before the shot.
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${EVIDENCE}/interface-20-card-open.png` });
  });

  test('the epilogue renders in its own face', async ({ page }) => {
    // The dev-only idle overrides compress the 60s epilogue threshold into seconds
    // (same pattern as viewer-control.spec); production ignores them.
    await gotoExplore(page, '/?quality=low&idle-resume=1000&idle-ramp=800&idle-epilogue=4000&idle-lead=800');

    const epilogue = page.getByTestId('epilogue-text');
    await expect(epilogue).toBeVisible({ timeout: 15000 });
    await expect(epilogue).toContainText('星尘');
    // font-epilogue must resolve to the self-hosted WenKai subset — and the face
    // must actually be loaded, not just named in the stack.
    const family = await epilogue.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family).toContain('Mira WenKai');
    const faceLoaded = await epilogue.evaluate(() => document.fonts.check('24px "Mira WenKai"', '星'));
    expect(faceLoaded).toBe(true);
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${EVIDENCE}/interface-20-epilogue.png` });
  });
});
