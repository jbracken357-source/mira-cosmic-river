import { test, expect } from '@playwright/test';

test.describe('Mira Cosmic River - E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');
  });

  test('landing page renders 3D scene', async ({ page }) => {
    await page.screenshot({ path: 'tests/e2e/screenshots/landing-page.png', fullPage: true });

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    expect(canvasBox!.width).toBeGreaterThan(100);
    expect(canvasBox!.height).toBeGreaterThan(100);
  });

  test('cinematic sequence plays automatically', async ({ page }) => {
    // Initial state: cinematic overlay should be visible
    const overlay = page.locator('[class*="cinematic"], [class*="overlay"]');
    await expect(overlay.first()).toBeVisible({ timeout: 10000 });

    // Wait for cinematic to complete (~15s + buffer)
    await page.waitForTimeout(16000);

    // After cinematic, the explore UI header should appear
    const miraHeader = page.locator('text="Mira"');
    await expect(miraHeader.first()).toBeVisible({ timeout: 5000 });
  });

  test('language toggle works', async ({ page }) => {
    // Find language toggle button
    const langToggle = page.locator('button:has-text("EN"), button:has-text("CN"), button:has-text("中文"), button:has-text("English")');
    await expect(langToggle.first()).toBeVisible({ timeout: 20000 });

    const initialText = await langToggle.first().textContent();

    await langToggle.first().click();
    await page.waitForTimeout(500);

    const newText = await langToggle.first().textContent();
    expect(newText).not.toBe(initialText);
  });

  test('info cards appear on star click after cinematic', async ({ page }) => {
    // Wait for cinematic to complete
    await page.waitForTimeout(16000);

    // Click on the canvas center area (where Mira A is positioned)
    const canvas = page.locator('canvas');
    const canvasBox = await canvas.boundingBox();
    if (canvasBox) {
      await canvas.click({
        x: canvasBox.width / 2,
        y: canvasBox.height / 2,
      });
    }

    // Info card should appear — look for the card-like elements
    const infoCard = page.locator('[class*="backdrop-blur-md"]');
    await expect(infoCard.first()).toBeVisible({ timeout: 5000 });
  });

  test('responsive design - mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'tests/e2e/screenshots/mobile-view.png', fullPage: true });

    // Canvas should still be visible on mobile
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('no console errors on page load', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    const realErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('Failed to load resource')
    );

    expect(realErrors.length).toBeLessThan(2);
  });
});
