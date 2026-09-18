import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Full cinematic (#28, ticket 03): the 15-second opening compressed by the dev-only
// `?cinematic-scale=` override (gated like ?epoch=), so the natural ending runs in
// seconds under software rendering. The `?capture=1&cinematic-t=` pin covers the
// portrait composition frozen mid-opening.
//
// `?quality=low` keeps the scene light enough for software rendering (headless CI has
// no GPU). Behaviour is identical; only particle counts and post-processing differ.
const SCALED = '/?quality=low&cinematic-scale=2';
const SEEN_KEY = 'mira:seen-opening';
// Explore framing on a landscape viewport, as written by the dev-only pose attribute.
const EXPLORE_POSE = '8.0,7.0,28.0';
const ANY_CAPTION = /浩瀚宇宙|彼此牵引|光河|vastness|Drawn together|river of light/;

async function gotoOpening(page: Page, url = SCALED) {
  await page.addInitScript((key) => {
    localStorage.removeItem(key);
    localStorage.removeItem('mira:found-tail');
  }, SEEN_KEY);
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  // The overlay mounts when the entry gate opens — the opening clock starts there.
  await expect(page.getByTestId('cinematic-overlay')).toBeVisible({ timeout: 30000 });
  // The pose attribute is written at the end of the first completed frame: it proves
  // the frame loop is actually running, not just mounted.
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });
}

async function screenshotStats(page: Page): Promise<{ mean: number; stddev: number }> {
  const shot = await page.screenshot();
  return page.evaluate(async (b64) => {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('screenshot decode failed'));
      img.src = `data:image/png;base64,${b64}`;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let sum = 0;
    let sumSq = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      sum += l;
      sumSq += l * l;
    }
    const mean = sum / n;
    return { mean, stddev: Math.sqrt(sumSq / n - mean * mean) };
  }, shot.toString('base64'));
}

test.describe('Full opening', () => {
  test('ends on its own and lands exactly on the explore framing', async ({ page }) => {
    await gotoOpening(page);

    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 45000 });
    expect(await page.evaluate((key) => localStorage.getItem(key), SEEN_KEY)).toBe('1');
    // The settle beat lands the camera on the explore framing — the hand-off adds no
    // cut of its own.
    await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', EXPLORE_POSE);
  });

  test('entering the scene early lands on the same explore framing', async ({ page }) => {
    await gotoOpening(page);

    await page.getByTestId('skip-cinematic').click();
    await expect(page.getByTestId('explore-ui')).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), SEEN_KEY)).toBe('1');
    await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', EXPLORE_POSE);
  });

  test('the language toggle works mid-opening and the opening still completes', async ({ page }) => {
    await gotoOpening(page);

    await page.getByRole('button', { name: 'EN' }).click();
    // A caption in the new language appears inside its own segment of the sequence.
    await expect(page.getByText(ANY_CAPTION)).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/浩瀚宇宙|彼此牵引|光河/)).toHaveCount(0);

    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 45000 });
    await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', EXPLORE_POSE);
  });

  test('reduced motion pins the camera but keeps the captions and the ending', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoOpening(page);

    const canvas = page.locator('canvas');
    await expect(canvas).toHaveAttribute('data-camera-pose', EXPLORE_POSE);
    await page.waitForTimeout(2000);
    // Still pinned: the dramatic camera move is the only thing the preference removes.
    await expect(canvas).toHaveAttribute('data-camera-pose', EXPLORE_POSE);

    await expect(page.getByText(ANY_CAPTION)).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 45000 });
  });

  test('captions never overlap through the whole sequence', async ({ page }) => {
    await gotoOpening(page);

    // AnimatePresence mode="wait" holds at most one caption in the DOM; sample across
    // every segment transition (1s/2s/4s wall at this scale) so a regression cannot
    // slip between two reads.
    const captions = page.locator('[data-testid="cinematic-overlay"] p[class*="text-white/70"]');
    let maxVisible = 0;
    const deadline = Date.now() + 9000;
    while (Date.now() < deadline) {
      maxVisible = Math.max(maxVisible, await captions.count());
      await page.waitForTimeout(80);
    }
    expect(maxVisible).toBeLessThanOrEqual(1);
  });

  test('the portrait hold keeps the giant in frame instead of hanging on black', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // Frozen one second into the hold beat: the portrait CLOSE composition must show
    // the red giant, not an empty dark frame.
    await gotoOpening(page, '/?quality=low&capture=1&cinematic-t=1000&epoch=2026-09-12T00%3A00%3A00Z');

    // The portrait hold is its own composition (PORTRAIT_CAMERA.CLOSE).
    await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', '8.0,4.0,13.0');
    const stats = await screenshotStats(page);
    expect(stats.mean).toBeGreaterThan(1);
    expect(stats.stddev).toBeGreaterThan(1);
  });
});
