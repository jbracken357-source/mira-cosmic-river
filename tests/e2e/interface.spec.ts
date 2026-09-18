import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Interface (#20): keyboard reachability of the star info cards, Esc + focus
// restore, 44px targets and accessible names, slider labelling, document language
// sync, interaction-hint exit and rediscovery, and the narrow/landscape viewports.
//
// `?quality=low` keeps the scene light enough for software rendering (headless CI
// has no GPU). Behaviour is identical; only detail level differs.
const APP = '/?quality=low';
const EVIDENCE = 'docs/design-audit-2026-09-17/evidence';

async function gotoExplore(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('mira:seen-opening', '1');
    localStorage.removeItem('mira:found-tail');
  });
  await page.goto(APP);
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

  test('the close control has an accessible name and closes with the keyboard', async ({ page }) => {
    await gotoExplore(page);

    await page.getByTestId('tail-hint').click();
    const card = page.getByTestId('info-card');
    await expect(card).toBeVisible();

    const close = page.getByTestId('info-card-close');
    await expect(close).toHaveAttribute('aria-label', /^(关闭|Close)$/);
    await close.focus();
    await page.keyboard.press('Enter');
    await expect(card).toHaveCount(0);
  });

  test('the time-speed slider has an associated label', async ({ page }) => {
    await gotoExplore(page);

    await page.getByTestId('tail-hint').click();
    await expect(page.getByTestId('info-card')).toBeVisible();
    // Default language is Chinese.
    const slider = page.getByLabel('时间速度');
    await expect(slider).toHaveAttribute('type', 'range');
    await expect(slider).toHaveAttribute('id', 'tail-time-speed');
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
      'tail-hint',
    ]) {
      await expectMinTarget(page, testId);
    }

    await page.getByTestId('tail-hint').click();
    await expect(page.getByTestId('info-card')).toBeVisible();
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

    const recall = page.getByTestId('interaction-hint-recall');
    await expect(recall).toBeVisible();
    await expectMinTarget(page, 'interaction-hint-recall');
    await recall.click();
    await expect(hint).toBeVisible();
  });
});

test.describe('card motion', () => {
  test('reduced motion opens the card without any displacement', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoExplore(page);

    await page.getByTestId('tail-hint').click();
    const card = page.getByTestId('info-card');
    await expect(card).toBeVisible();
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

    for (const testId of ['pause-toggle', 'replay-opening', 'language-toggle', 'tail-hint']) {
      await expect(page.getByTestId(testId)).toBeVisible();
    }

    await page.getByTestId('tail-hint').click();
    const card = page.getByTestId('info-card');
    await expect(card).toBeVisible();
    // The card never covers its own close control.
    const close = page.getByTestId('info-card-close');
    await expect(close).toBeVisible();
    await close.click();
    await expect(card).toHaveCount(0);

    await page.screenshot({ path: `${EVIDENCE}/interface-20-${viewport.name}.png` });
  });
}
