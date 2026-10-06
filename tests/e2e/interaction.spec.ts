import { test, expect } from '@playwright/test';

// Interaction pack (#88): the treasure-hunt copy is gone from the lower edge —
// clicking the tail itself still opens its info card, and no 「你找到了」 line ever
// appears. `?quality=low` keeps the scene light enough for software rendering
// (headless CI has no GPU).
const APP = '/?quality=low';
const SEEN_KEY = 'mira:seen-opening';

test.describe('Interaction pack', () => {
  test('clicking the tail opens its info card, and the found-it line is gone', async ({ page }) => {
    test.setTimeout(120000);
    await page.addInitScript((key) => localStorage.setItem(key, '1'), SEEN_KEY);
    // Pin the camera and the pair: the idle advance and the shared journey (#86)
    // would carry the tail off the fixed click point while software rendering stalls
    // between steps — reduced motion parks both (same pattern as phase-readout).
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(APP);
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });

    const canvas = page.locator('canvas');
    // The pose attribute is written at the end of the first completed frame: it
    // proves the click targets are mounted before any click lands.
    await expect(page.getByTestId('loading')).toHaveCount(0);
    await expect(canvas).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();

    // Click the tail where it actually is: the app projects the tail's click target
    // to screen percentages every frame (dev-only data attribute, same seam as
    // data-mira-a-screen). Retried because software rendering can stall past a click.
    const card = page.getByTestId('info-card');
    await expect(async () => {
      const raw = await canvas.getAttribute('data-tail-screen');
      expect(raw).toBeTruthy();
      const [xp, yp] = raw!.split(',').map(Number);
      await canvas.click({
        position: { x: (box!.width * xp) / 100, y: (box!.height * yp) / 100 },
      });
      await expect(card).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 60000 });

    // The tail's own card, in the viewer's language.
    await expect(card).toContainText(/尾巴|The Tail/);
    // 点尾巴仍打开尾巴的信息卡，不出现「你找到了」.
    await expect(page.getByTestId('tail-found')).toHaveCount(0);
    await expect(page.getByText(/你找到了她的尾巴|You found her tail/)).toHaveCount(0);

    // The card must lay out as a card, not a one-character-wide column. Guards the
    // desktop max-w classes resolving to the container scale (20rem+), not the
    // 0.25rem-ish custom spacing tokens that once shadowed them.
    const cardWidth = await card.evaluate((el) => el.getBoundingClientRect().width);
    expect(cardWidth).toBeGreaterThan(300);

    // Closes cleanly, and the closing line at the lower edge was never disturbed.
    await card.getByRole('button').click();
    await expect(card).toHaveCount(0);
    await expect(page.getByTestId('tail-found')).toHaveCount(0);
  });
});
