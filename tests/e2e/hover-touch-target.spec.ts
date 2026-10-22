import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MID_DECLINE_EPOCH } from './helpers';
import { calculateOrbitalPosition, PHYSICS } from '../../src/constants/physics';
import {
  PORTRAIT_REFERENCE_ASPECT,
  PORTRAIT_TILT,
  portraitExplorePose,
  projectToScreenPercent,
  screenDiscRadiusPercent,
} from '../../src/lib/portraitFraming';

// 星体可点的轻量提示 (#112): the hand cursor over the click targets in free
// viewing (never during the 完整开场), and the 伴星's touch target held at
// 44 CSS px on the phone frame. `?quality=low` keeps the scene light enough for
// software rendering (headless CI has no GPU); the epoch pins tonight off every
// milestone window, same as the other specs.
const APP = `/?quality=low&epoch=${MID_DECLINE_EPOCH}`;
const SEEN_KEY = 'mira:seen-opening';
// The 44px touch contract, read the way a fingertip lands it: every tap within
// half the minimum of the 伴星's projection must open its card. 21px keeps a
// rounding pixel of slack inside the 22px boundary (the sub-pixel precedent in
// interface.spec).
const TOUCH_RING_PX = 21;

// Read one dev probe ("x,y" screen percents) off the canvas.
async function probe(page: Page, name: string): Promise<[number, number]> {
  const raw = await page.locator('canvas').getAttribute(name);
  expect(raw, `${name} probe is written`).toBeTruthy();
  const [x, y] = raw!.split(',').map(Number);
  return [x, y];
}

// The canvas's computed cursor — what the viewer's pointer shows over the sky.
const canvasCursor = (page: Page) =>
  page.locator('canvas').evaluate((el) => getComputedStyle(el).cursor);

// Reduced motion parks the orbit, the shared journey and the idle camera (the
// same pin as the #108 specs), so the projected targets stand still while
// software rendering stretches the steps between reads.
async function gotoPinnedExplore(page: Page) {
  await page.addInitScript((key) => localStorage.setItem(key, '1'), SEEN_KEY);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(APP);
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId('loading')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });
}

async function canvasBox(page: Page) {
  const box = await page.locator('canvas').boundingBox();
  expect(box).toBeTruthy();
  return box!;
}

// Park the mouse on a projected target's screen point.
async function hoverProbe(page: Page, box: { x: number; y: number; width: number; height: number }, name: string) {
  const [xp, yp] = await probe(page, name);
  await page.mouse.move(box.x + (box.width * xp) / 100, box.y + (box.height * yp) / 100);
}

test.describe('悬停手形 (#112): the hand cursor in free viewing', () => {
  test('hovering the pair and the tail shows the hand; empty sky restores it', async ({ page }) => {
    test.setTimeout(120000);
    await gotoPinnedExplore(page);
    const box = await canvasBox(page);

    // Nothing has claimed the pointer yet.
    expect(await canvasCursor(page)).toBe('auto');

    // The 红巨星's click target first: the hand arrives once a frame has
    // raycast the parked pointer (software rendering is slow, so poll).
    await hoverProbe(page, box, 'data-mira-a-screen');
    await expect.poll(() => canvasCursor(page), { timeout: 20000 }).toBe('pointer');

    // Empty sky gives the hand back. The point is chosen clear of every
    // projected click target, and must actually sit on the canvas — a spot
    // under a 顶栏 button would never hand the canvas a pointermove.
    const sky = await emptySkyPoint(page, box);
    await page.mouse.move(sky.x, sky.y);
    await expect.poll(() => canvasCursor(page), { timeout: 20000 }).toBe('auto');

    // The 伴星 and the 尾巴 click targets answer the same way.
    await hoverProbe(page, box, 'data-mira-b-screen');
    await expect.poll(() => canvasCursor(page), { timeout: 20000 }).toBe('pointer');
    await page.mouse.move(sky.x, sky.y);
    await expect.poll(() => canvasCursor(page), { timeout: 20000 }).toBe('auto');

    await hoverProbe(page, box, 'data-tail-screen');
    await expect.poll(() => canvasCursor(page), { timeout: 20000 }).toBe('pointer');
    await page.mouse.move(sky.x, sky.y);
    await expect.poll(() => canvasCursor(page), { timeout: 20000 }).toBe('auto');
  });

  test('during the 完整开场 the hand never shows; it arrives with free viewing', async ({ page }) => {
    test.setTimeout(120000);
    await page.addInitScript((key) => localStorage.removeItem(key), SEEN_KEY);
    // The dev-only clock override compresses the 15s opening into seconds
    // (same gate as ?epoch=; production ignores it).
    await page.goto(`/?quality=low&cinematic-scale=2&epoch=${MID_DECLINE_EPOCH}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('cinematic-overlay')).toBeVisible({ timeout: 45000 });
    await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });
    const box = await canvasBox(page);
    expect(await canvasCursor(page)).toBe('auto');

    // Follow the 红巨星 across the frame while the opening plays: the click
    // targets are mounted and the overlay passes pointer events through, so an
    // unguarded hover would show the hand here.
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (await page.getByTestId('explore-ui').isVisible()) break;
      await hoverProbe(page, box, 'data-mira-a-screen');
      const cursor = await canvasCursor(page);
      // The opening can end between the visibility check and this read; under load
      // the frame loop writes the hand a frame or two before 自由观看's UI mounts.
      // A hand counts as a leak only if free viewing does not follow at once.
      if (cursor !== 'auto') {
        await expect(page.getByTestId('explore-ui'), 'a hand during the opening').toBeVisible({ timeout: 1500 });
        break;
      }
      await page.waitForTimeout(600);
    }

    // The opening ended and handed the camera over: the same hover now shows
    // the hand — which also proves the follows above really sat on the star.
    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 45000 });
    await hoverProbe(page, box, 'data-mira-a-screen');
    await expect.poll(() => canvasCursor(page), { timeout: 20000 }).toBe('pointer');
  });
});

// Empty sky for the cursor restore: the candidate farthest from every
// projected click target, and it must sit on the canvas itself.
async function emptySkyPoint(page: Page, box: { x: number; y: number; width: number; height: number }) {
  const candidates: Array<[number, number]> = [
    [90, 16],
    [62, 14],
    [48, 16],
    [90, 42],
  ];
  const targets = await Promise.all([
    probe(page, 'data-mira-a-screen'),
    probe(page, 'data-mira-b-screen'),
    probe(page, 'data-tail-screen'),
  ]);
  const toPx = (p: [number, number]) => ({
    x: box.x + (box.width * p[0]) / 100,
    y: box.y + (box.height * p[1]) / 100,
  });
  let best = toPx(candidates[0]);
  let bestClearance = -1;
  for (const candidate of candidates) {
    const point = toPx(candidate);
    const clearance = Math.min(
      ...targets.map((t) => {
        const tp = toPx(t);
        return Math.hypot(tp.x - point.x, tp.y - point.y);
      }),
    );
    if (clearance > bestClearance) {
      bestClearance = clearance;
      best = point;
    }
  }
  // The point belongs to the canvas — no 顶栏 button or 下缘 line in the way.
  const hit = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.tagName,
    { x: best.x, y: best.y },
  );
  expect(hit).toBe('CANVAS');
  return best;
}

test.describe('伴星触控目标 (#112): a 44px target on the phone frame', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test('taps within 22px of the 伴星 projection all open its card', async ({ page }) => {
    test.setTimeout(180000);
    await gotoPinnedExplore(page);
    const box = await canvasBox(page);
    const card = page.getByTestId('info-card');
    const canvas = page.locator('canvas');

    const toPx = (p: [number, number]) => ({
      x: (box.width * p[0]) / 100,
      y: (box.height * p[1]) / 100,
    });
    const bPx = toPx(await probe(page, 'data-mira-b-screen'));
    const aPx = toPx(await probe(page, 'data-mira-a-screen'));

    // The 红巨星's own halo target (photosphere ×1.4) projected on this frame —
    // the same seam read the 竖屏长卷 specs use. Taps inside that disc are the
    // giant's clicks by design (the ticket keeps them: 单击红巨星中心仍打开
    // Mira A 信息卡), so the ring samples the companion's neighbourhood around it.
    const pose = portraitExplorePose(PORTRAIT_REFERENCE_ASPECT);
    const home = calculateOrbitalPosition(0, PHYSICS.ORBIT);
    const a0 = projectToScreenPercent(home.primary, pose, PORTRAIT_REFERENCE_ASPECT, PORTRAIT_TILT);
    const haloPx =
      (screenDiscRadiusPercent(a0, PHYSICS.MIRA_A.radius * 1.4, pose, PORTRAIT_REFERENCE_ASPECT) / 100) * 844 + 2;

    const samples = [bPx];
    for (let i = 0; i < 8; i += 1) {
      const angle = (i * Math.PI) / 4;
      const point = {
        x: bPx.x + TOUCH_RING_PX * Math.cos(angle),
        y: bPx.y + TOUCH_RING_PX * Math.sin(angle),
      };
      if (Math.hypot(point.x - aPx.x, point.y - aPx.y) >= haloPx) samples.push(point);
    }
    // The ring must still say something: most directions belong to the 伴星.
    expect(samples.length).toBeGreaterThanOrEqual(5);

    for (const point of samples) {
      // Retried because software rendering can stall past a click (same
      // pattern as the #108 specs).
      await expect(async () => {
        await canvas.click({ position: { x: point.x, y: point.y } });
        await expect(card).toBeVisible({ timeout: 4000 });
      }).toPass({ timeout: 30000 });
      await expect(card).toContainText('蒭藁增二 B');
      await page.getByTestId('info-card-close').click();
      await expect(card).toHaveCount(0);
    }
  });

  test('the enlarged target does not steal the 红巨星 centre click', async ({ page }) => {
    test.setTimeout(120000);
    await gotoPinnedExplore(page);
    const box = await canvasBox(page);
    const card = page.getByTestId('info-card');
    const canvas = page.locator('canvas');

    await expect(async () => {
      const [xp, yp] = await probe(page, 'data-mira-a-screen');
      await canvas.click({ position: { x: (box.width * xp) / 100, y: (box.height * yp) / 100 } });
      await expect(card).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 30000 });
    await expect(card).toContainText('蒭藁增二 A');
  });
});
