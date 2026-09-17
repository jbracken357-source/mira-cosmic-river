import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Viewer control (#21): idle takeover, immediate interrupt, pause, card suppression,
// reduced motion, and return-to-main-view, all against real page input.
//
// `?idle-resume/ramp/epilogue/lead` are the dev-only overrides that compress the
// 30s/3s/60s rules into seconds (gated like ?epoch=; production ignores them).
const SCALED = 'idle-resume=1000&idle-ramp=800&idle-epilogue=4000&idle-lead=800';
const APP = `/?quality=low&${SCALED}`;

// The wrapper carries the observability attributes (same pattern as data-sky-*).
const wrapper = (page: Page) => page.locator('[data-sky-phase]');

async function gotoExplore(page: Page, url = APP) {
  await page.addInitScript(() => {
    localStorage.setItem('mira:seen-opening', '1');
    localStorage.removeItem('mira:found-tail');
  });
  await page.goto(url);
  await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });
  // The frame loop drives the camera attributes; the pose attribute is written at the
  // end of the first completed frame, so this proves the loop is actually running.
  await expect(page.getByTestId('loading')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });
}

test.describe('Viewer control', () => {
  test('idle resumes the auto camera, and the first wheel interrupts it at once', async ({ page }) => {
    await gotoExplore(page);

    await expect(wrapper(page)).toHaveAttribute('data-auto-camera', 'off');
    // 1s scaled resume + 0.8s ramp; generous bound for software rendering.
    await expect(wrapper(page)).toHaveAttribute('data-auto-camera', 'on', { timeout: 15000 });

    // Moving the mouse alone is not intentional input: the clock must not restamp.
    await page.mouse.move(640, 360);
    await page.mouse.move(700, 380);
    await expect(wrapper(page)).toHaveAttribute('data-auto-camera', 'on');

    // The first wheel interrupts immediately — well inside one 1s poll cycle.
    await page.mouse.wheel(0, 120);
    await expect(wrapper(page)).toHaveAttribute('data-auto-camera', 'off', { timeout: 800 });
  });

  test('the epilogue follows the auto camera on the same clock, and keydown dismisses it at once', async ({ page }) => {
    await gotoExplore(page);

    // The auto camera resumes first and must not restamp the shared clock: the
    // epilogue still arrives on the original 60s (scaled) count.
    await expect(wrapper(page)).toHaveAttribute('data-auto-camera', 'on', { timeout: 15000 });
    await expect(page.getByTestId('epilogue-text')).toBeVisible({ timeout: 15000 });
    await expect(wrapper(page)).toHaveAttribute('data-epilogue', 'true');

    await page.keyboard.press('ArrowLeft');
    // Event-driven dismissal: the flag clears immediately, not on the next poll tick.
    await expect(wrapper(page)).toHaveAttribute('data-epilogue', 'false', { timeout: 800 });
    await expect(page.getByTestId('epilogue-text')).toBeHidden({ timeout: 8000 });
    await expect(wrapper(page)).toHaveAttribute('data-auto-camera', 'off');
  });

  test('pause suppresses the takeover, and resume restarts the idle count', async ({ page }) => {
    await gotoExplore(page);

    await expect(wrapper(page)).toHaveAttribute('data-auto-camera', 'on', { timeout: 15000 });

    const pause = page.getByTestId('pause-toggle');
    // React commits can lag several seconds under software rendering; the assertions
    // keep their meaning with a wider window.
    await expect(pause).toHaveAttribute('aria-pressed', 'false', { timeout: 15000 });
    await pause.click();
    await expect(pause).toHaveAttribute('aria-pressed', 'true', { timeout: 15000 });

    // Past both scaled thresholds: nothing takes over while paused.
    await expect(wrapper(page)).toHaveAttribute('data-auto-camera', 'off', { timeout: 15000 });
    await page.waitForTimeout(4500);
    await expect(wrapper(page)).toHaveAttribute('data-auto-camera', 'off');
    await expect(wrapper(page)).toHaveAttribute('data-epilogue', 'false');
    await expect(page.getByTestId('epilogue-text')).toHaveCount(0);

    // Resume restarts the idle clock from zero: about one scaled resume + ramp later
    // the camera drifts again.
    await pause.click();
    await expect(pause).toHaveAttribute('aria-pressed', 'false', { timeout: 15000 });
    await expect(wrapper(page)).toHaveAttribute('data-auto-camera', 'on', { timeout: 15000 });
  });

  test('reading a card suppresses the takeover; closing it restarts the count', async ({ page }) => {
    await gotoExplore(page);

    await page.getByTestId('tail-hint').click();
    await expect(page.getByTestId('info-card')).toBeVisible();

    // Well past the scaled epilogue threshold: no ramp, no epilogue while reading.
    await page.waitForTimeout(5000);
    await expect(wrapper(page)).toHaveAttribute('data-auto-camera', 'off');
    await expect(wrapper(page)).toHaveAttribute('data-epilogue', 'false');

    await page.getByTestId('info-card').getByRole('button').click();
    await expect(page.getByTestId('info-card')).toHaveCount(0);
    await expect(wrapper(page)).toHaveAttribute('data-auto-camera', 'on', { timeout: 15000 });
  });

  test('reduced motion never moves the camera but still allows the epilogue text', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoExplore(page);

    const canvas = page.locator('canvas');
    const poseBefore = await canvas.getAttribute('data-camera-pose');
    expect(poseBefore).toBeTruthy();

    // No drift, ever…
    await expect(wrapper(page)).toHaveAttribute('data-auto-camera', 'off');
    // …but the epilogue line still arrives on the same shared clock…
    await expect(page.getByTestId('epilogue-text')).toBeVisible({ timeout: 15000 });
    await expect(wrapper(page)).toHaveAttribute('data-epilogue', 'true');
    // …without a closing flight: the camera never left the explore framing.
    expect(await canvas.getAttribute('data-camera-pose')).toBe(poseBefore);
    await expect(wrapper(page)).toHaveAttribute('data-auto-camera', 'off');

    // The first intentional input still dismisses it immediately.
    await page.keyboard.press('ArrowLeft');
    await expect(wrapper(page)).toHaveAttribute('data-epilogue', 'false', { timeout: 800 });
    await expect(page.getByTestId('epilogue-text')).toBeHidden({ timeout: 8000 });
  });

  test('return to main view eases the camera back to the explore framing', async ({ page }) => {
    await gotoExplore(page);

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const pose = async () =>
      (await canvas.getAttribute('data-camera-pose'))!.split(',').map(Number);

    const before = await pose();
    // Drag well away from the main view.
    await page.mouse.move(box!.width / 2, box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.width / 2 + 260, box!.height / 2 + 60, { steps: 12 });
    await page.mouse.up();

    await expect(async () => {
      const dragged = await pose();
      expect(Math.hypot(dragged[0] - before[0], dragged[1] - before[1], dragged[2] - before[2])).toBeGreaterThan(1);
    }).toPass({ timeout: 10000 });

    await page.getByTestId('return-to-view').click();

    // Explore framing is [8, 7, 28] on a landscape viewport; the blend lands there and
    // the resumed drift moves the camera only slowly afterwards.
    await expect(async () => {
      const [x, y, z] = await pose();
      expect(Math.hypot(x - 8, y - 7, z - 28)).toBeLessThan(1);
    }).toPass({ timeout: 10000 });
  });
});
