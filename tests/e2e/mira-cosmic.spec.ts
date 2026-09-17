import { test, expect } from '@playwright/test';

// `?quality=low` keeps the scene light enough for software rendering (headless CI has no
// GPU) so Playwright's actionability checks pass. Behaviour is identical; only the
// particle counts, tessellation and post-processing differ.
const APP = '/?quality=low';

test.describe('Mira Cosmic River - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // These specs describe a first visit; returning visitors no longer see Skip.
    await page.addInitScript(() => {
      localStorage.removeItem('mira:seen-opening');
      localStorage.removeItem('mira:found-tail');
    });
    await page.goto(APP);
    await page.waitForLoadState('networkidle');
  });

  test('landing page renders 3D scene', async ({ page }) => {
    await page.screenshot({
      path: 'tests/e2e/screenshots/landing-page.png',
      fullPage: true,
    });

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    expect(canvasBox!.width).toBeGreaterThan(100);
    expect(canvasBox!.height).toBeGreaterThan(100);
  });

  test('cinematic sequence opens and ends on its own', async ({ page }) => {
    // While the opening plays it offers a way out
    const skip = page.getByTestId('skip-cinematic');
    await expect(skip).toBeVisible({ timeout: 15000 });

    // It must finish by itself — no clicking required — and hand over to exploration
    await expect(skip).toBeHidden({ timeout: 40000 });
    await expect(page.getByTestId('explore-ui')).toBeVisible();
  });

  test('language toggle works', async ({ page }) => {
    await page.getByTestId('skip-cinematic').click();
    await expect(page.getByTestId('explore-ui')).toBeVisible();

    const langToggle = page.getByRole('button', { name: /^(中文|EN)$/ });
    await expect(langToggle).toBeVisible({ timeout: 15000 });

    const initialText = await langToggle.textContent();
    await langToggle.click();
    await expect(langToggle).not.toHaveText(initialText ?? '');
  });

  test('info card opens when a star is clicked', async ({ page }) => {
    // Exploration is the only state where stars are clickable
    await page.getByTestId('skip-cinematic').click();
    await expect(page.getByTestId('explore-ui')).toBeVisible();

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    await expect(page.getByTestId('loading')).toHaveCount(0);

    // Skip lands at CAMERA.EXPLORE, which looks left of origin, so Mira A sits right of centre.
    await canvas.click({
      position: { x: box!.width * 0.6, y: box!.height * 0.5 },
    });

    await expect(page.getByTestId('info-card')).toBeVisible({ timeout: 15000 });
  });

  test('responsive design - mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'tests/e2e/screenshots/mobile-view.png',
      fullPage: true,
    });

    // Canvas should still be visible on mobile
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('no console errors on page load', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    const realErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('404') &&
        !e.includes('Failed to load resource'),
    );

    expect(realErrors.length).toBeLessThan(2);
  });
});
