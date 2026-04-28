import { test, expect } from '@playwright/test';

test.describe('Language Toggle Test', () => {
  test('toggle between EN and CN', async ({ page }) => {
    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');

    // Skip cinematic to get to explore mode faster
    const skipButton = page.locator('button:has-text("Skip")');
    await skipButton.first().click();
    await page.waitForTimeout(500);

    // Find language toggle button (text-based: shows "中文" in EN mode, "EN" in CN mode)
    const langButton = page.locator('button:has-text("中文"), button:has-text("EN")').first();
    await expect(langButton).toBeVisible();

    // Initial state should show "中文" (EN mode)
    const initialText = await langButton.textContent();
    expect(initialText).toBe('中文');

    // Take screenshot of EN version
    await page.screenshot({ path: 'tests/e2e/screenshots/en-version.png' });

    // Click to switch to Chinese
    await langButton.click();
    await page.waitForTimeout(500);

    // Should now show "EN"
    await expect(langButton).toHaveText('EN');

    // Take screenshot of CN version
    await page.screenshot({ path: 'tests/e2e/screenshots/cn-version.png' });

    // Toggle back to EN
    await langButton.click();
    await page.waitForTimeout(300);

    // Should be back to showing "中文"
    await expect(langButton).toHaveText('中文');
  });
});
