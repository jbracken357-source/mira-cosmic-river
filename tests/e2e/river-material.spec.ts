import { test, expect } from '@playwright/test';

test('image-backed river loads without blocking exploration or replay', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => localStorage.setItem('mira:seen-opening', '1'));
  const texture = page.waitForResponse(response => response.url().endsWith('/materials/river-density-v1.webp'));
  const surface = page.waitForResponse(response => response.url().endsWith('/materials/surface-density-v1.webp'));
  await page.goto('/?quality=low');
  expect((await texture).ok()).toBe(true);
  expect((await surface).ok()).toBe(true);
  await expect(page.getByTestId('explore-ui')).toBeVisible();
  await page.getByTestId('tail-hint').click();
  await expect(page.getByTestId('info-card')).toBeVisible();
  await page.getByTestId('info-card').getByRole('button').click();
  await expect(page.getByTestId('info-card')).toBeHidden();
  await page.getByTestId('replay-opening').click();
  await expect(page.getByTestId('skip-cinematic')).toBeVisible();
  await page.getByTestId('skip-cinematic').click();
  await expect(page.getByTestId('explore-ui')).toBeVisible();
  expect(errors).toEqual([]);
});

test('missing material images preserve a usable mobile scene', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('mira:seen-opening', '1'));
  await page.route('**/materials/*.webp', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/?quality=low');
  await expect(page.getByTestId('explore-ui')).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByTestId('tail-hint').click();
  await expect(page.getByTestId('info-card')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});
