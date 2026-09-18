import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Adaptive quality (#26): the runtime governor's hysteresis, cooldown, stepping,
// pinning and the background draw control, observed through the canvas data
// attributes (data-quality-tier / data-quality-last-change, always on) and the
// dev-only frame heartbeat (data-frame-count).
//
// Seams: `?quality-probe=slow|fast|steady` feeds the governor a synthetic frame
// time (40/8/16ms) instead of the real delta — software rendering in CI cannot
// produce honest frame times, so the rules are exercised deterministically.
// `?quality-window` / `?quality-cooldown` compress the 2s/8s rules into sub-second
// time; `?quality-start` picks the governor's opening tier without pinning it.
// All gated like ?epoch= and absent from production bundles.

// Compressed enough that two windows and the cooldown land in a few seconds even
// at software-rendering frame rates.
const SCALED = 'quality-window=400&quality-cooldown=1200';

const canvas = (page: Page) => page.locator('canvas');

async function gotoExplore(page: Page, query: string) {
  await page.addInitScript(() => {
    localStorage.setItem('mira:seen-opening', '1');
    localStorage.removeItem('mira:found-tail');
  });
  await page.goto(`/?${query}`);
  await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('loading')).toHaveCount(0);
  // The pose attribute lands at the end of the first completed frame: the loop is
  // really running before any governor assertion is made.
  await expect(canvas(page)).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });
  // A viewer's first keypress restamps the shared idle clock; do the same so the
  // 30s auto camera cannot move the pose mid-test (see viewer-control.spec.ts).
  await page.keyboard.press('Shift');
}

const frameCount = (page: Page) =>
  canvas(page).evaluate((el) => Number((el as HTMLElement).dataset.frameCount ?? 0));

test.describe('Adaptive quality', () => {
  test('sustained slow frames step down one rung at a time, cooldown apart', async ({ page }) => {
    // quality-start pins the OPENING tier (the governor still runs): the detected
    // tier differs between machines (CI runners report 4 cores → mid), and these
    // assertions must not depend on it.
    await gotoExplore(page, `quality-start=high&quality-probe=slow&${SCALED}`);

    await expect(canvas(page)).toHaveAttribute('data-quality-tier', 'high');
    // Never a jump: the descent must pass through mid…
    await expect(canvas(page)).toHaveAttribute('data-quality-tier', 'mid', { timeout: 30000 });
    await expect(canvas(page)).toHaveAttribute('data-quality-last-change', 'high>mid:sustained-slow');
    // …and only later reach low, one cooldown and two windows further on.
    await expect(canvas(page)).toHaveAttribute('data-quality-tier', 'low', { timeout: 30000 });
    await expect(canvas(page)).toHaveAttribute('data-quality-last-change', 'mid>low:sustained-slow');
    // The floor holds: no further change, however long the slow frames continue.
    await page.waitForTimeout(3000);
    await expect(canvas(page)).toHaveAttribute('data-quality-tier', 'low');
  });

  test('a long cooldown permits exactly one change', async ({ page }) => {
    // 10s: the first change must wait out the startup grace (initialisation counts
    // as a change), and a second change cannot land inside the observation window.
    // quality-start keeps the opening tier off the CI runner's detected mid.
    await gotoExplore(page, 'quality-start=high&quality-probe=slow&quality-window=400&quality-cooldown=10000');

    await expect(canvas(page)).toHaveAttribute('data-quality-tier', 'mid', { timeout: 30000 });
    // Well past two more slow windows: the cooldown must hold the tier at mid.
    await page.waitForTimeout(4000);
    await expect(canvas(page)).toHaveAttribute('data-quality-tier', 'mid');
  });

  test('sustained fast frames step back up one rung', async ({ page }) => {
    await gotoExplore(page, `quality-start=mid&quality-probe=fast&${SCALED}`);

    await expect(canvas(page)).toHaveAttribute('data-quality-tier', 'mid');
    await expect(canvas(page)).toHaveAttribute('data-quality-tier', 'high', { timeout: 30000 });
    await expect(canvas(page)).toHaveAttribute('data-quality-last-change', 'mid>high:sustained-fast');
  });

  test('frame times inside the hysteresis band never move the tier', async ({ page }) => {
    await gotoExplore(page, `quality-start=high&quality-probe=steady&${SCALED}`);

    await expect(canvas(page)).toHaveAttribute('data-quality-tier', 'high');
    await page.waitForTimeout(4000);
    await expect(canvas(page)).toHaveAttribute('data-quality-tier', 'high');
    expect(await canvas(page).getAttribute('data-quality-last-change')).toBeNull();
  });

  test('an explicit ?quality= pin is the viewer’s decision: the governor stays off', async ({ page }) => {
    await gotoExplore(page, `quality=low&quality-probe=fast&${SCALED}`);

    await expect(canvas(page)).toHaveAttribute('data-quality-tier', 'low');
    await page.waitForTimeout(4000);
    await expect(canvas(page)).toHaveAttribute('data-quality-tier', 'low');
    expect(await canvas(page).getAttribute('data-quality-last-change')).toBeNull();
  });

  test('a downgrade keeps the portrait composition: tier moves, camera does not', async ({ page }) => {
    // Portrait but desktop-sized: the short side stays at or over the 640px mobile
    // rule, so the governor runs while the portrait camera path is active.
    await page.setViewportSize({ width: 700, height: 900 });
    await gotoExplore(page, `quality-start=high&quality-probe=slow&${SCALED}`);

    const poseBefore = await canvas(page).getAttribute('data-camera-pose');
    expect(poseBefore).toBeTruthy();
    await expect(canvas(page)).toHaveAttribute('data-quality-tier', 'mid', { timeout: 30000 });
    await expect(canvas(page)).toHaveAttribute('data-quality-tier', 'low', { timeout: 30000 });
    expect(await canvas(page).getAttribute('data-camera-pose')).toBe(poseBefore);
  });

  test('a hidden tab stops drawing; the visible return resumes without a lurch', async ({ page }) => {
    await gotoExplore(page, 'quality=low');

    // The heartbeat is moving while visible.
    const running = await frameCount(page);
    await expect.poll(() => frameCount(page), { timeout: 10000 }).toBeGreaterThan(running);

    const poseBefore = await canvas(page).getAttribute('data-camera-pose');

    // Headless pages cannot really hide; override the getters and fire the event
    // the scene listens to (same pattern as ambient-sound.spec.ts).
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
      Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Give any in-flight loop time to be stopped, then the count must hold still.
    await page.waitForTimeout(2500);
    const parked = await frameCount(page);
    await page.waitForTimeout(1500);
    expect(await frameCount(page)).toBe(parked);

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
      Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Drawing resumes…
    await expect.poll(() => frameCount(page), { timeout: 10000 }).toBeGreaterThan(parked);
    // …and the camera is exactly where the viewer left it: no catch-up motion.
    expect(await canvas(page).getAttribute('data-camera-pose')).toBe(poseBefore);
  });
});
