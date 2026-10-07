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

  test('the pair reads as two with a gap, and drag/zoom reveal foreground from background (#91)', async ({ page }) => {
    test.setTimeout(180000);
    await page.addInitScript((key) => localStorage.setItem(key, '1'), SEEN_KEY);
    // Reduced motion parks the orbit, the shared journey and the idle camera, so the
    // only thing moving the probes is the viewer's own drag and zoom.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(APP);
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });

    const canvas = page.locator('canvas');
    await expect(page.getByTestId('loading')).toHaveCount(0);
    await expect(canvas).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();

    // Screen-percentage probes, written by the scene every frame (dev-only).
    const probe = async (name: string) => {
      const raw = await canvas.getAttribute(name);
      expect(raw).toBeTruthy();
      return raw!.split(',').map(Number);
    };
    const sep = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    // Wait until the camera pose stops moving (damping) before reading probes.
    const poseSettled = async () => {
      await expect(async () => {
        const first = await canvas.getAttribute('data-camera-pose');
        await page.waitForTimeout(400);
        expect(await canvas.getAttribute('data-camera-pose')).toBe(first);
      }).toPass({ timeout: 30000 });
    };
    await poseSettled();

    // 空隙: at the free-viewing distance the two stars read as two, with clear space
    // between them — without enlarging the white dwarf.
    const a0 = await probe('data-mira-a-screen');
    const b0 = await probe('data-mira-b-screen');
    expect(sep(a0, b0)).toBeGreaterThan(4);

    // Drag: the camera orbits the pair, and the depth between the pair and the
    // road's far end shows as a differential — the far end sits much closer to the
    // explore camera than the pair, so one drag sweeps it across the frame far more
    // than the stars themselves. A flat backdrop would move them all together.
    const far0 = await probe('data-tail-far-screen');
    await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.5 + 260, box!.y + box!.height * 0.5 + 60, { steps: 12 });
    await page.mouse.up();
    await poseSettled();
    const pairShift = sep(a0, await probe('data-mira-a-screen'));
    const farShift = sep(far0, await probe('data-tail-far-screen'));
    // The drag really orbited the camera (the pair itself crossed the frame)…
    expect(pairShift).toBeGreaterThan(5);
    // …and the road's near end crossed it much further: foreground from background.
    expect(farShift - pairShift).toBeGreaterThan(15);

    // 拉远: zoomed out to the far end, the pair and the road's anchor stay in frame,
    // still separated — the far view holds the stars, the gap, and the tail's length.
    // Depth shows again as the camera retreats: the road (nearer than the pair) sinks
    // towards the pair on screen faster than the pair's own gap closes.
    const a1 = await probe('data-mira-a-screen');
    const far1 = await probe('data-tail-far-screen');
    const tail1 = await probe('data-tail-screen');
    const sepPairFar1 = sep(a1, far1);
    const sepPairTail1 = sep(a1, tail1);
    const distanceFromTarget = async () => {
      const pose = (await canvas.getAttribute('data-camera-pose'))!.split(',').map(Number);
      return Math.hypot(pose[0] - -3, pose[1] - 1, pose[2] - 5);
    };
    const distanceBefore = await distanceFromTarget();
    for (let i = 0; i < 10; i += 1) await page.mouse.wheel(0, 400);
    await poseSettled();
    expect(await distanceFromTarget()).toBeGreaterThan(distanceBefore + 5);
    for (const name of ['data-mira-a-screen', 'data-mira-b-screen', 'data-tail-screen', 'data-tail-far-screen']) {
      const [xp, yp] = await probe(name);
      expect(xp).toBeGreaterThan(5);
      expect(xp).toBeLessThan(95);
      expect(yp).toBeGreaterThan(5);
      expect(yp).toBeLessThan(95);
    }
    expect(sep(await probe('data-mira-a-screen'), await probe('data-mira-b-screen'))).toBeGreaterThan(2.5);
    // The retreat shrinks the road's on-screen reach by a real share — a flat
    // backdrop pasted at the pair's depth could not do that.
    expect(sep(await probe('data-mira-a-screen'), await probe('data-tail-far-screen'))).toBeLessThan(sepPairFar1 * 0.85);
    expect(sep(await probe('data-mira-a-screen'), await probe('data-tail-screen'))).toBeLessThan(sepPairTail1 * 0.85);
  });
});
