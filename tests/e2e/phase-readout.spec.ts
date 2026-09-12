import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  MIRA_MAXIMUM_EPOCH_MS,
  MIRA_PERIOD_DAYS,
  MIRA_RISE_DAYS,
} from '../../src/lib/starClock';

const DAY_MS = 86_400_000;
const MINIMUM_EPOCH_MS =
  MIRA_MAXIMUM_EPOCH_MS + (MIRA_PERIOD_DAYS - MIRA_RISE_DAYS) * DAY_MS;

async function openMiraACard(page: Page, epochMs: number) {
  await page.goto(`/?quality=low&epoch=${Math.round(epochMs / 1000)}`);
  await page.getByTestId('skip-cinematic').click();
  await expect(page.getByTestId('explore-ui')).toBeVisible();

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  await canvas.click({
    position: { x: box!.width / 2, y: box!.height / 2 },
  });

  const card = page.getByTestId('info-card');
  await expect(card).toBeVisible({ timeout: 15000 });
  return card.locator('[data-phase-days-to-max]');
}

test.describe('Phase readout', () => {
  test('Mira A card readout differs at two pinned moments', async ({ page }) => {
    const atMaximum = await openMiraACard(page, MIRA_MAXIMUM_EPOCH_MS);
    const maxDays = await atMaximum.getAttribute('data-phase-days-to-max');
    await expect(atMaximum).toContainText('正处于最亮');

    const atMinimum = await openMiraACard(page, MINIMUM_EPOCH_MS);
    const minDays = await atMinimum.getAttribute('data-phase-days-to-max');
    await expect(atMinimum).toContainText('正处于最暗');

    expect(maxDays).not.toBe(minDays);
    expect(Number(maxDays)).toBe(0);
    expect(Number(minDays)).toBe(100);
  });

  test('phase copy switches with the language toggle', async ({ page }) => {
    const readout = await openMiraACard(page, MIRA_MAXIMUM_EPOCH_MS);
    await expect(readout).toContainText('正处于最亮');

    await page.locator('button:has-text("EN")').first().click();
    await expect(readout).toContainText('At maximum light');
  });

  test('maximum milestone hint fires once per cycle', async ({ page }) => {
    await page.goto(`/?quality=low&epoch=${Math.round(MIRA_MAXIMUM_EPOCH_MS / 1000)}`);
    await page.getByTestId('skip-cinematic').click();
    await expect(page.getByTestId('explore-ui')).toBeVisible();
    await expect(page.getByTestId('milestone-hint')).toBeVisible();
    await expect(page.getByTestId('milestone-hint')).toHaveAttribute(
      'data-milestone-kind',
      'maximum',
    );

    await page.reload();
    await page.getByTestId('skip-cinematic').click();
    await expect(page.getByTestId('explore-ui')).toBeVisible();
    await expect(page.getByTestId('milestone-hint')).toHaveCount(0);
  });
});
