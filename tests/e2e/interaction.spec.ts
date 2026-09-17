import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// `?quality=low` keeps the scene light enough for software rendering (headless CI has no GPU).
const APP = '/?quality=low';
const FOUND_KEY = 'mira:found-tail';
const SEEN_KEY = 'mira:seen-opening';

async function gotoWithFlags(page: Page, opts: { seenOpening: boolean; foundTail: boolean }) {
  await page.addInitScript(
    ({ seenKey, foundKey, seenOpening, foundTail }) => {
      if (seenOpening) localStorage.setItem(seenKey, '1');
      else localStorage.removeItem(seenKey);
      if (foundTail) localStorage.setItem(foundKey, '1');
      else localStorage.removeItem(foundKey);
    },
    { seenKey: SEEN_KEY, foundKey: FOUND_KEY, ...opts },
  );
  await page.goto(APP);
  await page.waitForLoadState('networkidle');
}

test.describe('Interaction pack', () => {
  test('skip to explore: tail hint opens the card and first find is one-shot', async ({ page }) => {
    await gotoWithFlags(page, { seenOpening: false, foundTail: false });

    await page.getByTestId('skip-cinematic').click();
    await expect(page.getByTestId('explore-ui')).toBeVisible();

    const hint = page.getByTestId('tail-hint');
    await expect(hint).toBeVisible();

    await hint.click();
    await expect(page.getByTestId('info-card')).toBeVisible();
    await expect(page.getByTestId('tail-found')).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), FOUND_KEY)).toBe('1');

    // The card must lay out as a card, not a one-character-wide column. Guards the
    // desktop max-w classes resolving to the container scale (20rem+), not the
    // 0.25rem-ish custom spacing tokens that once shadowed them.
    const cardWidth = await page.getByTestId('info-card').evaluate((el) => el.getBoundingClientRect().width);
    expect(cardWidth).toBeGreaterThan(300);

    // Same session, second open must not repeat the line.
    await page.getByTestId('info-card').getByRole('button').click();
    await expect(page.getByTestId('info-card')).toBeHidden();
    await expect(page.getByTestId('tail-found')).toHaveCount(0);
    await hint.click();
    await expect(page.getByTestId('info-card')).toBeVisible();
    await expect(page.getByTestId('tail-found')).toHaveCount(0);
  });

  test('return visit with the flag set does not show the one-shot', async ({ page }) => {
    await gotoWithFlags(page, { seenOpening: true, foundTail: true });

    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('tail-hint').click();
    await expect(page.getByTestId('info-card')).toBeVisible();
    await expect(page.getByTestId('tail-found')).toHaveCount(0);
  });
});
