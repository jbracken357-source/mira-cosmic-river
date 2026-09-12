import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// `?quality=low` keeps the scene light enough for software rendering (headless CI has no GPU).
const APP = '/?quality=low';
const SEEN_KEY = 'mira:seen-opening';
const FOUND_KEY = 'mira:found-tail';

test.use({
  viewport: { width: 375, height: 812 },
  hasTouch: true,
  isMobile: true,
});

async function gotoWithFlags(page: Page, opts: { seenOpening: boolean; foundTail?: boolean }) {
  await page.addInitScript(
    ({ seenKey, foundKey, seenOpening, foundTail }) => {
      if (seenOpening) localStorage.setItem(seenKey, '1');
      else localStorage.removeItem(seenKey);
      if (foundTail) localStorage.setItem(foundKey, '1');
      else localStorage.removeItem(foundKey);
    },
    { seenKey: SEEN_KEY, foundKey: FOUND_KEY, foundTail: opts.foundTail ?? false, seenOpening: opts.seenOpening },
  );
  await page.goto(APP);
  await page.waitForLoadState('networkidle');
}

test.describe('Mobile first-class', () => {
  test('direct entry lands in explore without waiting for the opening', async ({ page }) => {
    await gotoWithFlags(page, { seenOpening: true });

    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('explore-ui').getByText('Mira', { exact: true })).toBeVisible();
    await expect(page.getByTestId('skip-cinematic')).toHaveCount(0);

    // Direct entry must not wait out the 15s sequence.
    await page.waitForTimeout(2500);
    await expect(page.getByText(/300 light-years from Earth/)).toHaveCount(0);
    await expect(page.getByTestId('explore-ui')).toBeVisible();
  });

  test('tail hint opens a closeable info card', async ({ page }) => {
    await gotoWithFlags(page, { seenOpening: true, foundTail: true });

    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('tail-hint').click();
    await expect(page.getByTestId('info-card')).toBeVisible();

    await page.getByTestId('info-card').getByRole('button').click();
    await expect(page.getByTestId('info-card')).toBeHidden();
  });

  test('canvas fills the viewport and swipe/wheel do not crash', async ({ page }) => {
    await gotoWithFlags(page, { seenOpening: true });

    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 10000 });
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThanOrEqual(370);
    expect(box!.height).toBeGreaterThanOrEqual(800);

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await canvas.dragTo(canvas, {
      sourcePosition: { x: box!.width * 0.4, y: box!.height * 0.5 },
      targetPosition: { x: box!.width * 0.65, y: box!.height * 0.55 },
    });

    // Pinch against R3F OrbitControls is not observable here without a camera-distance
    // seam; a wheel dolly is the same control path (enableZoom) and must not throw.
    await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
    await page.mouse.wheel(0, 300);

    await expect(page.getByTestId('explore-ui')).toBeVisible();
    await expect(canvas).toBeVisible();
    expect(errors).toEqual([]);
  });
});
