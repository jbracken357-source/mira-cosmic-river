import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openStarCardViaKeyboard } from './helpers';

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

// 拖拽不算点击 (#108): a drag is camera movement, never card intent — releasing one
// on the red giant opens nothing, and a drag across empty sky closes nothing. A
// real click after every drag proves the click path is alive, so a no-card
// assertion can never pass because the event was lost to a stalled frame.
test.describe('拖拽不算点击 (#108)', () => {
  // Reduced motion parks the orbit, the shared journey and the idle camera (same
  // pin as the specs above), so the projected click points stand still while
  // software rendering stretches the steps between reads.
  async function gotoPinnedExplore(page: Page) {
    await page.addInitScript((key) => localStorage.setItem(key, '1'), SEEN_KEY);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(APP);
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('loading')).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });
  }

  const probe = async (page: Page, name: string) => {
    const raw = await page.locator('canvas').getAttribute(name);
    expect(raw, name).toBeTruthy();
    return raw!.split(',').map(Number);
  };

  // Candidates kept clear of what owns pointer events: the 顶栏 (top edge), the
  // open card's left column (the A card runs tall enough to reach the lower
  // left), and the 下缘 (bottom edge). Whichever candidate sits farthest from
  // every projected click target is the empty sky the specs use — the pair sits
  // right of centre and the tail's click volume cuts across mid-frame, so the
  // pick lands in a genuinely empty stretch wherever the camera has carried them.
  const EMPTY_SKY_CANDIDATES: Array<[number, number]> = [
    [90, 16],
    [62, 14],
    [48, 16],
    [90, 42],
  ];

  async function emptySkyPoint(page: Page) {
    const box = await page.locator('canvas').boundingBox();
    expect(box).toBeTruthy();
    const targets = await Promise.all([
      probe(page, 'data-mira-a-screen'),
      probe(page, 'data-mira-b-screen'),
      probe(page, 'data-tail-screen'),
    ]);
    let best = EMPTY_SKY_CANDIDATES[0];
    let bestClearance = -1;
    for (const candidate of EMPTY_SKY_CANDIDATES) {
      const clearance = Math.min(
        ...targets.map((p) => Math.hypot(p[0] - candidate[0], p[1] - candidate[1])),
      );
      if (clearance > bestClearance) {
        bestClearance = clearance;
        best = candidate;
      }
    }
    return { x: (box!.width * best[0]) / 100, y: (box!.height * best[1]) / 100 };
  }

  test('a drag off the red giant opens nothing; the click after it still opens the card', async ({ page }) => {
    test.setTimeout(120000);
    await gotoPinnedExplore(page);

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const card = page.getByTestId('info-card');

    // 从红巨星中心拖动约 40px 后松手 — the release still sits on the giant's
    // click sphere, so without the drag verdict this lands as a click (the
    // review's exact 40px repro).
    const [ax, ay] = await probe(page, 'data-mira-a-screen');
    const sx = box!.x + (box!.width * ax) / 100;
    const sy = box!.y + (box!.height * ay) / 100;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx + 38, sy + 12, { steps: 4 });
    await page.mouse.up();
    await expect(card).toHaveCount(0);

    // The same place answers a real click: the no-card above was the drag
    // verdict, not a lost event. Retried because software rendering can stall
    // past a click.
    await expect(async () => {
      const [xp, yp] = await probe(page, 'data-mira-a-screen');
      await canvas.click({
        position: { x: (box!.width * xp) / 100, y: (box!.height * yp) / 100 },
      });
      await expect(card).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 60000 });
    await expect(card).toContainText('蒭藁增二 A');
  });

  test('reading a card, a drag across empty sky closes nothing; a click after it still closes', async ({ page }) => {
    test.setTimeout(120000);
    await gotoPinnedExplore(page);

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const card = page.getByTestId('info-card');

    await openStarCardViaKeyboard(page, 'miraA');
    await expect(card).toBeVisible();

    // 在空白天空拖动视角: starts and ends on empty sky, so under the old verdict
    // its release closed the card through the background's click.
    const start = await emptySkyPoint(page);
    await page.mouse.move(box!.x + start.x, box!.y + start.y);
    await page.mouse.down();
    await page.mouse.move(box!.x + start.x - 140, box!.y + start.y + 40, { steps: 8 });
    await page.mouse.up();
    await expect(card).toBeVisible();

    // 单击空白天空仍关闭信息卡 — the same verdict, other direction.
    await canvas.click({ position: await emptySkyPoint(page) });
    await expect(card).toHaveCount(0);
  });

  test('the companion and the tail still open their cards on a click; empty sky closes them', async ({ page }) => {
    test.setTimeout(150000);
    await gotoPinnedExplore(page);

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const card = page.getByTestId('info-card');

    // 伴星 opens on its click (the red giant's own click-open is the drag spec
    // above), retried because software rendering can stall past a click.
    await expect(async () => {
      const [xp, yp] = await probe(page, 'data-mira-b-screen');
      await canvas.click({
        position: { x: (box!.width * xp) / 100, y: (box!.height * yp) / 100 },
      });
      await expect(card).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 60000 });
    await expect(card).toContainText('蒭藁增二 B');
    await canvas.click({ position: await emptySkyPoint(page) });
    await expect(card).toHaveCount(0);

    // The tail opens the same way, and empty sky closes it too.
    await expect(async () => {
      const [xp, yp] = await probe(page, 'data-tail-screen');
      await canvas.click({
        position: { x: (box!.width * xp) / 100, y: (box!.height * yp) / 100 },
      });
      await expect(card).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 60000 });
    await expect(card).toContainText(/尾巴|The Tail/);
    await canvas.click({ position: await emptySkyPoint(page) });
    await expect(card).toHaveCount(0);
  });
});
