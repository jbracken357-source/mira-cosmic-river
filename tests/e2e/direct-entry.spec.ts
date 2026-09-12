import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// `?quality=low` keeps the scene light enough for software rendering (headless CI has no GPU).
const APP = '/?quality=low';
const SEEN_KEY = 'mira:seen-opening';
const OPENING_LINE = /300 light-years from Earth/;

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

    await page.getByTestId('skip-cinematic').click();
    await expect(page.getByTestId('explore-ui')).toBeVisible();
    await expect(page.getByTestId('replay-opening')).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), SEEN_KEY)).toBe('1');
  });

  test('return visit goes straight to explore and does not play the opening', async ({ page }) => {
    await gotoWithSeen(page, true);

    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('skip-cinematic')).toHaveCount(0);
    await expect(page.getByTestId('cinematic-overlay')).toHaveCount(0);

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

    await page.getByTestId('skip-cinematic').click();
    await expect(page.getByTestId('explore-ui')).toBeVisible();
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
