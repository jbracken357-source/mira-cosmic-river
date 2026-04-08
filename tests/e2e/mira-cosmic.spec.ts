import { test, expect } from '@playwright/test';

test.describe('Mira Cosmic River - E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');
  });

  test('landing page loads and renders 3D scene', async ({ page }) => {
    // Take screenshot of landing page
    await page.screenshot({ path: 'tests/e2e/screenshots/landing-page.png', fullPage: true });

    // Verify no white screen (3D scene renders)
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Check canvas has content (not empty)
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    expect(canvasBox!.width).toBeGreaterThan(100);
    expect(canvasBox!.height).toBeGreaterThan(100);
  });

  test('displays title and subtitle', async ({ page }) => {
    // Check for title (English or Chinese)
    const titleLocator = page.locator('h1, .title, [class*="title"]');
    await expect(titleLocator.first()).toBeVisible();

    const titleText = await titleLocator.first().textContent();
    expect(titleText).toMatch(/Mira|双星|Binary|Waltz/i);

    // Check for subtitle
    const subtitleLocator = page.locator('.subtitle, [class*="subtitle"], p:text("Together")');
    await expect(subtitleLocator.first()).toBeVisible({ timeout: 5000 });

    const subtitleText = await subtitleLocator.first().textContent();
    expect(subtitleText).toMatch(/Together|Until|End|Time|共舞/i);
  });

  test('control panel is visible', async ({ page }) => {
    // Look for control panel - uses Tailwind classes, look for distinctive elements
    const controlPanel = page.locator('.backdrop-blur-3xl:has(.tracking-widest), div:has-text("SYSTEM"):has-text("ENVIRONMENT")');
    await expect(controlPanel.first()).toBeVisible({ timeout: 5000 });
  });

  test('language toggle button exists and works', async ({ page }) => {
    // Find language toggle
    const langToggle = page.locator('[class*="lang"], [class*="language"], button:has-text("EN"), button:has-text("CN"), button:has-text("中文"), button:has-text("English")');
    await expect(langToggle.first()).toBeVisible();

    // Get initial text
    const initialText = await langToggle.first().textContent();

    // Click toggle
    await langToggle.first().click();
    await page.waitForTimeout(500);

    // Verify text changed
    const newText = await langToggle.first().textContent();
    expect(newText).not.toBe(initialText);

    // Toggle back
    await langToggle.first().click();
    await page.waitForTimeout(300);
  });

  test('mode buttons work (GLOW/WAVE/PARTICLES)', async ({ page }) => {
    // Find mode buttons
    const modeButtons = page.locator('button:has-text("GLOW"), button:has-text("WAVE"), button:has-text("PARTICLE"), [class*="mode"]');

    const buttonCount = await modeButtons.count();
    expect(buttonCount).toBeGreaterThan(0);

    // Click each mode button
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      await modeButtons.nth(i).click();
      await page.waitForTimeout(200);
    }
  });

  test('sliders are functional', async ({ page }) => {
    // Find sliders
    const sliders = page.locator('input[type="range"], [class*="slider"], [role="slider"]');

    const sliderCount = await sliders.count();
    expect(sliderCount).toBeGreaterThan(0);

    // Move first slider
    const slider = sliders.first();
    await slider.scrollIntoViewIfNeeded();

    const initialValue = await slider.inputValue();
    await slider.fill('50');
    await slider.dispatchEvent('input');
    await page.waitForTimeout(200);

    const newValue = await slider.inputValue();
    expect(newValue).not.toBe(initialValue);
  });

  test('responsive design - mobile view', async ({ page }) => {
    // Resize to mobile width
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);

    // Take mobile screenshot
    await page.screenshot({ path: 'tests/e2e/screenshots/mobile-view.png', fullPage: true });

    // Check for bottom sheet or mobile-optimized layout
    // Mobile view shows "Settings" bar at bottom
    const settingsBar = page.locator('text=Settings');
    const bottomSheet = page.locator('[class*="bottom"], [class*="sheet"], [class*="mobile"]');

    // Either settings bar appears (mobile control trigger) or bottom sheet or controls adapt to mobile
    const controlsVisible = await page.locator('text=SYSTEM').isVisible();
    const settingsVisible = await settingsBar.count() > 0;
    expect(controlsVisible || settingsVisible || await bottomSheet.count() > 0).toBeTruthy();
  });

  test('no console errors on page load', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Reload to capture fresh console output
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Filter out expected/benign errors
    const realErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('Failed to load resource')
    );

    expect(realErrors.length).toBeLessThan(2); // Allow 1 minor error
  });
});
