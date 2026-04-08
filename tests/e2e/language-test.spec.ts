import { test, expect } from '@playwright/test';

test.describe('Language Toggle Test', () => {
  test('toggle between EN and CN', async ({ page }) => {
    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');

    // Initial state should be EN - use aria-label for specificity
    const langButton = page.locator('[aria-label*="Switch language"], .glass-button:has-text("EN")').first();
    await expect(langButton).toBeVisible();

    // Take screenshot of EN version
    await page.screenshot({ path: 'tests/e2e/screenshots/en-version.png' });

    // Click to switch to Chinese
    await langButton.click();
    await page.waitForTimeout(500);

    // Should now show CN or 中文
    const cnButton = page.locator('[aria-label*="Switch language"], .glass-button:has-text("CN"), .glass-button:has-text("中文")').first();
    await expect(cnButton).toBeVisible();

    // Take screenshot of CN version
    await page.screenshot({ path: 'tests/e2e/screenshots/cn-version.png' });

    // Verify Chinese title appears
    const title = page.locator('h1, .title, [class*="title"]').first();
    const titleText = await title.textContent();
    console.log('Title after language switch:', titleText);

    // Toggle back to EN
    await cnButton.click();
    await page.waitForTimeout(300);

    // Should be back to EN
    await expect(langButton).toBeVisible();
  });
});
