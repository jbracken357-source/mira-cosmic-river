import { test, expect } from '@playwright/test';

// `?quality=low` keeps the scene light enough for software rendering (headless CI has no
// GPU) so input checks pass. Behaviour is identical; only detail level differs.
const APP = '/?quality=low';

test.describe('Language Toggle Test', () => {
  test('toggle between EN and CN', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('mira:seen-opening'));
    await page.goto(APP);
    await page.waitForLoadState('networkidle');

    // Skip the opening to reach exploration straight away
    await page.getByTestId('skip-cinematic').click();
    await expect(page.getByTestId('explore-ui')).toBeVisible();

    // The toggle shows the language you would switch *to*
    const langButton = page.getByRole('button', { name: /^(中文|EN)$/ });
    await expect(langButton).toBeVisible();

    // Default language is English, so the button offers Chinese
    await expect(langButton).toHaveText('中文');

    await page.screenshot({ path: 'tests/e2e/screenshots/en-version.png' });

    await langButton.click();
    await expect(langButton).toHaveText('EN');

    await page.screenshot({ path: 'tests/e2e/screenshots/cn-version.png' });

    await langButton.click();
    await expect(langButton).toHaveText('中文');
  });
});
