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

async function clearMiraStorage(page: Page) {
  await page.addInitScript(() => {
    localStorage.removeItem('mira:seen-opening');
    localStorage.removeItem('mira:found-tail');
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('mira:milestone:')) localStorage.removeItem(key);
    }
  });
}

async function reachExplore(page: Page) {
  const skip = page.getByTestId('look-myself');
  const explore = page.getByTestId('explore-ui');
  await expect(skip.or(explore).first()).toBeVisible({ timeout: 15000 });
  if (await skip.isVisible()) await skip.click();
  await expect(explore).toBeVisible();
}

async function openMiraACard(page: Page, epochMs: number) {
  await clearMiraStorage(page);
  // Pin the camera and the pair: the idle advance and the shared journey (#86)
  // would carry Mira A off the fixed click point while software rendering stalls
  // between steps — reduced motion parks both (same pattern as river-material.spec.ts).
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/?quality=low&epoch=${Math.round(epochMs / 1000)}`);
  await reachExplore(page);

  const canvas = page.locator('canvas');
  // The loading veil lifts when the Canvas is created; under software rendering the
  // scene graph commits later than the explore UI, so a click before this lands on
  // nothing instead of the star. The pose attribute is written at the end of the
  // first completed frame, which proves the click targets are mounted.
  await expect(page.getByTestId('loading')).toHaveCount(0);
  await expect(canvas).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });
  // Measured only after frames are running: a canvas located earlier can still carry
  // the default 300×150 backing size under load, which silently misplaces the click.
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();

  const card = page.getByTestId('info-card');
  // Click the star where it actually is: the app projects Mira A to screen
  // percentages every frame (dev-only data attribute), so the raycast target does
  // not depend on a hardcoded canvas fraction. Retried because software rendering
  // can stall past a click; the assertion itself is unchanged.
  await expect(async () => {
    const raw = await canvas.getAttribute('data-mira-a-screen');
    expect(raw).toBeTruthy();
    const [xp, yp] = raw!.split(',').map(Number);
    await canvas.click({
      position: { x: (box!.width * xp) / 100, y: (box!.height * yp) / 100 },
    });
    await expect(card).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 60000 });
  return card.locator('[data-phase-days-to-max]');
}

test.describe('Phase readout', () => {
  // Two card openings on one page, each with its own retry budget under software rendering.
  test('Mira A card readout differs at two pinned moments', async ({ page }) => {
    test.setTimeout(180000);
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

  test('maximum milestone hint fires once per cycle, borrowing the lower edge', async ({ page }) => {
    await page.goto(`/?quality=low&epoch=${Math.round(MIRA_MAXIMUM_EPOCH_MS / 1000)}`);
    await reachExplore(page);
    const hint = page.getByTestId('milestone-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toHaveAttribute('data-milestone-kind', 'maximum');
    // #88: the hint borrows the lower edge — it never stacks beside the closing
    // line, and the line returns when the ~8s window closes.
    await expect(page.getByTestId('lower-edge-closing-line')).toHaveCount(0);
    await expect(hint).toHaveCount(0, { timeout: 20000 });
    await expect(page.getByTestId('lower-edge-closing-line')).toBeVisible();

    await page.reload();
    await reachExplore(page);
    await expect(page.getByTestId('milestone-hint')).toHaveCount(0);
    await expect(page.getByTestId('lower-edge-closing-line')).toBeVisible();
  });
});
