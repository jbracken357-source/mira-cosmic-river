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

// `?quality=low` keeps the scene light enough for software rendering (headless CI has no
// GPU) so Playwright's actionability checks pass. `?epoch` pins the clock to a moment of our
// choosing — the pinning entry point is dev/test only.
async function skyAt(page: Page, epochMs: number) {
  await page.addInitScript(() => {
    localStorage.removeItem('mira:seen-opening');
    localStorage.removeItem('mira:found-tail');
  });
  await page.goto(`/?quality=low&epoch=${Math.round(epochMs / 1000)}`);

  const root = page.locator('[data-sky-brightness]');
  await expect(root).toBeVisible({ timeout: 20000 });
  await expect(page.locator('canvas')).toBeVisible();

  return {
    phase: Number(await root.getAttribute('data-sky-phase')),
    brightness: Number(await root.getAttribute('data-sky-brightness')),
    orbitalPhase: Number(await root.getAttribute('data-sky-orbital-phase')),
  };
}

test.describe('Star Clock', () => {
  test('a different clock moment renders a different Mira A', async ({ page }) => {
    const atMaximum = await skyAt(page, MIRA_MAXIMUM_EPOCH_MS);
    const atMinimum = await skyAt(page, MINIMUM_EPOCH_MS);

    // The quantities the scene is driven by, not the pixels they produce.
    expect(atMaximum.phase).not.toBeCloseTo(atMinimum.phase, 2);
    expect(atMaximum.brightness).toBeGreaterThan(atMinimum.brightness);
    expect(atMaximum.brightness - atMinimum.brightness).toBeGreaterThan(0.5);

    expect(atMaximum.phase).toBeCloseTo(0, 3);
    expect(atMaximum.brightness).toBeCloseTo(1, 3);
    expect(atMinimum.brightness).toBeCloseTo(0, 3);

    // The slow orbital phase is in range at both moments; it is far too slow to differ
    // visibly within a year.
    for (const sky of [atMaximum, atMinimum]) {
      expect(sky.orbitalPhase).toBeGreaterThanOrEqual(0);
      expect(sky.orbitalPhase).toBeLessThan(1);
    }
  });
});
