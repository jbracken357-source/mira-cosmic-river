import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MID_DECLINE_EPOCH } from './helpers';

// `?quality=low` keeps the scene light enough for software rendering (headless CI has no GPU).
// The epoch pins tonight off every milestone window (mid-decline, the date
// integration-journey uses), so the lower edge always holds the closing line (#88).
const APP = `/?quality=low&epoch=${MID_DECLINE_EPOCH}`;
const SEEN_KEY = 'mira:seen-opening';
const OPENING_LINE = /在浩瀚宇宙里，我们遇见彼此|In all this vastness, we found each other/;
const CLOSING_LINE = '在宇宙的尽头，我们依然相伴。';

async function gotoWithSeen(page: Page, seen: boolean) {
  await page.addInitScript(
    ({ key, seen: alreadySeen }) => {
      localStorage.removeItem('mira:found-tail');
      if (alreadySeen) localStorage.setItem(key, '1');
      else localStorage.removeItem(key);
    },
    { key: SEEN_KEY, seen },
  );
  await page.goto(APP);
  await page.waitForLoadState('networkidle');
}

test.describe('Direct entry + full-opening replay', () => {
  test('first visit plays the full opening, then explore', async ({ page }) => {
    await gotoWithSeen(page, false);

    await expect(page.getByTestId('cinematic-overlay')).toBeVisible();
    await expect(page.getByTestId('skip-cinematic')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(OPENING_LINE)).toBeVisible({ timeout: 10000 });
    // 开场前三句期间，下缘不提前出现这句 (#88).
    await expect(page.getByTestId('lower-edge-closing-line')).toHaveCount(0);

    await page.getByTestId('skip-cinematic').click();
    await expect(page.getByTestId('explore-ui')).toBeVisible();
    await expect(page.getByTestId('replay-opening')).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), SEEN_KEY)).toBe('1');
    // Entered early, the closing line settles at the lower edge.
    await expect(page.getByTestId('lower-edge-closing-line')).toBeVisible();
  });

  test('return visit goes straight to explore and does not play the opening', async ({ page }) => {
    await gotoWithSeen(page, true);

    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('skip-cinematic')).toHaveCount(0);
    await expect(page.getByTestId('cinematic-overlay')).toHaveCount(0);

    // 直达第一眼 (#88): the closing line is already at the lower edge, with no
    // treasure-hunt copy anywhere.
    const closingLine = page.getByTestId('lower-edge-closing-line');
    await expect(closingLine).toBeVisible();
    await expect(closingLine).toHaveText(CLOSING_LINE);
    await expect(page.getByTestId('tail-hint')).toHaveCount(0);
    await expect(page.getByTestId('tail-found')).toHaveCount(0);

    // Direct entry must not wait out the 15s sequence.
    await page.waitForTimeout(2500);
    await expect(page.getByText(OPENING_LINE)).toHaveCount(0);
    await expect(page.getByTestId('explore-ui')).toBeVisible();
    await expect(page.getByTestId('skip-cinematic')).toHaveCount(0);
  });

  test('replay plays the full opening then returns to explore', async ({ page }) => {
    await gotoWithSeen(page, true);

    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('replay-opening').click();

    await expect(page.getByTestId('cinematic-overlay')).toBeVisible();
    await expect(page.getByTestId('skip-cinematic')).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), SEEN_KEY)).toBe('1');
    // If the cinematic clock was not reset, explore would snap back immediately.
    await expect(page.getByText(OPENING_LINE)).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('explore-ui')).toHaveCount(0);
    // The ritual moment holds the opening alone — the lower edge stays empty (#88).
    await expect(page.getByTestId('lower-edge-closing-line')).toHaveCount(0);

    await page.getByTestId('skip-cinematic').click();
    await expect(page.getByTestId('explore-ui')).toBeVisible();
    await expect(page.getByTestId('lower-edge-closing-line')).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), SEEN_KEY)).toBe('1');
  });

  test('clearing storage restores first-visit opening', async ({ page }) => {
    await page.goto(APP);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('skip-cinematic').click();
    await expect(page.getByTestId('explore-ui')).toBeVisible();

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('skip-cinematic')).toHaveCount(0);

    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('skip-cinematic')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('cinematic-overlay')).toBeVisible();
  });
});
