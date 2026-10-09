import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openTailCardViaKeyboard } from './helpers';
import { calculateOrbitalPosition, PHYSICS } from '../../src/constants/physics';
import { TRANSLATIONS } from '../../src/constants/translations';
import { resolveOpeningPose } from '../../src/lib/openingTimeline';
import { TAIL_ROOT } from '../../src/lib/tailPath';
import {
  PORTRAIT_REFERENCE_ASPECT,
  PORTRAIT_TILT,
  portraitExplorePose,
  projectToScreenPercent,
  screenDiscRadiusPercent,
} from '../../src/lib/portraitFraming';

// `?quality=low` keeps the scene light enough for software rendering (headless CI has no GPU).
const APP = '/?quality=low';
const SEEN_KEY = 'mira:seen-opening';

test.use({
  viewport: { width: 375, height: 812 },
  hasTouch: true,
  isMobile: true,
});

async function gotoWithFlags(page: Page, opts: { seenOpening: boolean }) {
  await page.addInitScript(
    ({ seenKey, seenOpening }) => {
      if (seenOpening) localStorage.setItem(seenKey, '1');
      else localStorage.removeItem(seenKey);
    },
    { seenKey: SEEN_KEY, seenOpening: opts.seenOpening },
  );
  await page.goto(APP);
  await page.waitForLoadState('networkidle');
}

test.describe('Mobile first-class', () => {
  test('direct entry lands in explore without waiting for the opening', async ({ page }) => {
    await gotoWithFlags(page, { seenOpening: true });

    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('explore-ui').getByText('Mira', { exact: true })).toBeVisible();
    await expect(page.getByTestId('look-myself')).toHaveCount(0);

    // Direct entry must not wait out the 15s sequence.
    await page.waitForTimeout(2500);
    await expect(page.getByText(/在浩瀚宇宙里，我们遇见彼此|In all this vastness, we found each other/)).toHaveCount(0);
    await expect(page.getByTestId('explore-ui')).toBeVisible();
  });

  test('the tail entry opens a closeable info card', async ({ page }) => {
    await gotoWithFlags(page, { seenOpening: true });

    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 10000 });
    // The tail's keyboard entry (#88): the treasure-hunt hint is gone from the
    // lower edge, so the scene itself and this trigger are the tail's doors.
    await openTailCardViaKeyboard(page);

    await page.getByTestId('info-card').getByRole('button').click();
    await expect(page.getByTestId('info-card')).toBeHidden();
  });

  test('canvas fills the viewport and swipe/wheel do not crash', async ({ page }) => {
    await gotoWithFlags(page, { seenOpening: true });

    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 10000 });
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThanOrEqual(370);
    expect(box!.height).toBeGreaterThanOrEqual(800);

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await canvas.dragTo(canvas, {
      sourcePosition: { x: box!.width * 0.4, y: box!.height * 0.5 },
      targetPosition: { x: box!.width * 0.65, y: box!.height * 0.55 },
    });

    // Pinch against R3F OrbitControls is not observable here without a camera-distance
    // seam; a wheel dolly is the same control path (enableZoom) and must not throw.
    await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
    await page.mouse.wheel(0, 300);

    await expect(page.getByTestId('explore-ui')).toBeVisible();
    await expect(canvas).toBeVisible();
    expect(errors).toEqual([]);
  });
});

// 竖屏长卷 (#92): the portrait long scroll, proven geometrically — the scene's own
// dev probes (screen percents it writes every frame) against the DOM boxes of the
// 终幕标题 and the 顶栏, cross-checked against the pure framing math in
// lib/portraitFraming. The named frame is 390×844.
const PORTRAIT_FRAME = { width: 390, height: 844 };

// Read one dev probe ("x,y" screen percents) off the canvas.
async function probe(page: Page, name: string): Promise<[number, number]> {
  const raw = await page.locator('canvas').getAttribute(name);
  expect(raw, `${name} probe is written`).toBeTruthy();
  const [x, y] = raw!.split(',').map(Number);
  return [x, y];
}

async function gotoPortraitExplore(page: Page) {
  await page.setViewportSize(PORTRAIT_FRAME);
  await gotoWithFlags(page, { seenOpening: true });
  await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('loading')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });
}

test.describe('竖屏长卷 (#92): the portrait long scroll', () => {
  test('the road enters the lower half with both stars in frame (390×844)', async ({ page }) => {
    await gotoPortraitExplore(page);

    const a = await probe(page, 'data-mira-a-screen');
    const b = await probe(page, 'data-mira-b-screen');
    const root = await probe(page, 'data-tail-root-screen');
    const mid = await probe(page, 'data-tail-mid-screen');
    const far = await probe(page, 'data-tail-far-screen');

    // 双星与尾巴同时在画内.
    for (const [x, y] of [a, b, root, mid, far]) {
      expect(x).toBeGreaterThan(3);
      expect(x).toBeLessThan(97);
      expect(y).toBeGreaterThan(3);
      expect(y).toBeLessThan(97);
    }
    // 沿长边展开: the root high, the road running down the long axis. The honest
    // visibility claim is the MID-ROAD anchor (#92 review): t≈0.7 sits deep inside
    // the strong-alpha body, so its screen point is where the river genuinely
    // reads — it must cross into the lower half. The far end (whose own alpha
    // fades out) stays only as the secondary bound, deeper still.
    expect(root[1]).toBeLessThan(30);
    expect(a[1]).toBeLessThan(32);
    expect(b[1]).toBeLessThan(28);
    expect(mid[1]).toBeGreaterThan(51);
    expect(far[1]).toBeGreaterThan(60);
    expect(root[1]).toBeLessThan(mid[1]);
    expect(mid[1]).toBeLessThan(far[1]);
  });

  test('the live framing matches the pure seam within reading distance (reduced motion)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoPortraitExplore(page);

    // 减少动态效果 parks the orbit and the journey: the live probes sit exactly on
    // the seam's projections of the home configuration.
    const pose = portraitExplorePose(PORTRAIT_REFERENCE_ASPECT);
    const home = calculateOrbitalPosition(0, PHYSICS.ORBIT);
    const expectedA = projectToScreenPercent(home.primary, pose, PORTRAIT_REFERENCE_ASPECT, PORTRAIT_TILT);
    const expectedB = projectToScreenPercent(home.companion, pose, PORTRAIT_REFERENCE_ASPECT, PORTRAIT_TILT);

    const a = await probe(page, 'data-mira-a-screen');
    const b = await probe(page, 'data-mira-b-screen');
    const root = await probe(page, 'data-tail-root-screen');
    const mid = await probe(page, 'data-tail-mid-screen');
    const far = await probe(page, 'data-tail-far-screen');

    for (const [live, expected] of [
      [a, expectedA],
      [b, expectedB],
    ] as const) {
      expect(Math.abs(live[0] - expected.x)).toBeLessThan(1.5);
      expect(Math.abs(live[1] - expected.y)).toBeLessThan(1.5);
    }
    // …and the pair and the road still read: both stars in frame, the mid-road
    // anchor (full alpha) in the lower half, the far end deeper as the bound, the
    // root between the pair.
    expect(mid[1]).toBeGreaterThan(51);
    expect(far[1]).toBeGreaterThan(60);
    expect(root[1]).toBeGreaterThan(Math.min(a[1], b[1]));
    expect(root[1]).toBeLessThan(Math.max(a[1], b[1]));
    for (const [x, y] of [a, b]) {
      expect(x).toBeGreaterThan(3);
      expect(x).toBeLessThan(97);
      expect(y).toBeGreaterThan(3);
      expect(y).toBeLessThan(97);
    }
  });

  test('the 终幕标题 never covers the pair (390×844, frozen mid-settle)', async ({ page }) => {
    await page.setViewportSize(PORTRAIT_FRAME);
    // Frozen at 13s of the full cinematic: the final beat's title is up and the
    // camera is mid-settle between the far pose and the explore framing. Capture
    // mode parks the orbit at CAPTURE_TIME (8), so the pair's home for this frame
    // is the orbital position at t=8 — the seam computes the same numbers.
    await page.goto('/?quality=low&capture=1&cinematic-t=13000');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('final-title')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });

    const titleBox = await page.getByTestId('final-title').boundingBox();
    expect(titleBox).toBeTruthy();

    const parked = calculateOrbitalPosition(8, PHYSICS.ORBIT);
    const pose = resolveOpeningPose(13, { reduceMotion: false, portrait: true, aspect: PORTRAIT_REFERENCE_ASPECT });
    const disc = (star: 'primary' | 'companion') => {
      const point = parked[star];
      const projected = projectToScreenPercent(point, pose, PORTRAIT_REFERENCE_ASPECT, PORTRAIT_TILT);
      const radius = (star === 'primary' ? PHYSICS.MIRA_A.radius : PHYSICS.MIRA_B.radius) * 1.4;
      return {
        projected,
        margin: (screenDiscRadiusPercent(projected, radius, pose, PORTRAIT_REFERENCE_ASPECT) / 100) * PORTRAIT_FRAME.height,
      };
    };

    // The live probes land within reading distance of the frozen pose's math…
    for (const [name, star] of [
      ['data-mira-a-screen', 'primary'],
      ['data-mira-b-screen', 'companion'],
    ] as const) {
      const live = await probe(page, name);
      const { projected, margin } = disc(star);
      expect(Math.abs(live[0] - projected.x)).toBeLessThan(2);
      expect(Math.abs(live[1] - projected.y)).toBeLessThan(2);
      // …and the star's disc (photosphere + dense atmosphere, with margin) stays
      // above the title's box: 字不压星.
      const starPy = (live[1] / 100) * PORTRAIT_FRAME.height;
      expect(starPy + margin).toBeLessThan(titleBox!.y);
    }

    // #103: PR #100 claimed the 终幕标题 gap held at both language anchors, but the
    // English title box was never measured. The block is anchored at top-1/3, so the
    // English subtitle can only wrap downward — the measured box never grows up
    // toward the pair (at 390×844 it stays one line, same height as the Chinese).
    // Measured here so the claim is true the honest way.
    await page.getByTestId('language-toggle').click();
    await expect(page.getByTestId('opening-subtitle')).toHaveText(TRANSLATIONS.en.subtitle);
    const enBox = await page.getByTestId('final-title').boundingBox();
    expect(enBox!.y).toBeCloseTo(titleBox!.y, 0);
    expect(enBox!.height).toBeGreaterThanOrEqual(titleBox!.height);
    for (const [name, star] of [
      ['data-mira-a-screen', 'primary'],
      ['data-mira-b-screen', 'companion'],
    ] as const) {
      const live = await probe(page, name);
      const { margin } = disc(star);
      expect((live[1] / 100) * PORTRAIT_FRAME.height + margin).toBeLessThan(enBox!.y);
    }
  });

  test('the 顶栏 never covers the pair (390×844)', async ({ page }) => {
    await gotoPortraitExplore(page);

    const bar = await page.getByTestId('top-bar').boundingBox();
    expect(bar).toBeTruthy();

    // Disc margins in px at the explore pose, from the seam (the giant's inflated
    // disc, the companion's accretion reach). The bar is measured in its
    // first-read state (76px): after the viewer's first drag or zoom it wraps to
    // a second row (132px, measured), and no long-scroll composition can clear a
    // two-row bar AND keep the pair above the 终幕标题's band — the pin's standard
    // is the bar the landing itself shows.
    const pose = portraitExplorePose(PORTRAIT_REFERENCE_ASPECT);
    const home = calculateOrbitalPosition(0, PHYSICS.ORBIT);
    const a0 = projectToScreenPercent(home.primary, pose, PORTRAIT_REFERENCE_ASPECT, PORTRAIT_TILT);
    const b0 = projectToScreenPercent(home.companion, pose, PORTRAIT_REFERENCE_ASPECT, PORTRAIT_TILT);
    const marginA =
      (screenDiscRadiusPercent(a0, PHYSICS.MIRA_A.radius * 1.4, pose, PORTRAIT_REFERENCE_ASPECT) / 100) * PORTRAIT_FRAME.height;
    const marginB =
      (screenDiscRadiusPercent(b0, PHYSICS.MIRA_B.radius * 4.8, pose, PORTRAIT_REFERENCE_ASPECT) / 100) * PORTRAIT_FRAME.height;

    // The orbit wanders a little in the seconds the read takes; the margins above
    // already carry the slack these bands need.
    const barBottom = bar!.y + bar!.height;
    const a = await probe(page, 'data-mira-a-screen');
    const b = await probe(page, 'data-mira-b-screen');
    expect((a[1] / 100) * PORTRAIT_FRAME.height - marginA).toBeGreaterThan(barBottom);
    expect((b[1] / 100) * PORTRAIT_FRAME.height - marginB).toBeGreaterThan(barBottom);
  });

  test('the 顶栏 never covers the pair (320×568, measured bar)', async ({ page }) => {
    // #92 review: the 320×568 pin used to be a hardcoded bar estimate against the
    // bare photosphere — this measures the real box. The disc standard matches
    // the 390×844 unit pin (photosphere + dense atmosphere, ×1.4, both stars).
    // The companion's ×4.8 accretion reach stays pinned at 390×844: at 320×568
    // that spherical standard is geometrically incompatible with the long scroll
    // (the pair must fit between the bar at 13.4% and the 终幕标题's band at
    // 33.3%, and the road needs the rest) — the honest claim here is the one the
    // composition genuinely holds: both dense discs clear the measured bar.
    await page.setViewportSize({ width: 320, height: 568 });
    await gotoWithFlags(page, { seenOpening: true });
    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('loading')).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });

    const bar = await page.getByTestId('top-bar').boundingBox();
    expect(bar).toBeTruthy();

    const SE_ASPECT = 320 / 568;
    const SE_HEIGHT = 568;
    const pose = portraitExplorePose(SE_ASPECT);
    const home = calculateOrbitalPosition(0, PHYSICS.ORBIT);
    const a0 = projectToScreenPercent(home.primary, pose, SE_ASPECT, PORTRAIT_TILT);
    const b0 = projectToScreenPercent(home.companion, pose, SE_ASPECT, PORTRAIT_TILT);
    const marginA = (screenDiscRadiusPercent(a0, PHYSICS.MIRA_A.radius * 1.4, pose, SE_ASPECT) / 100) * SE_HEIGHT;
    const marginB = (screenDiscRadiusPercent(b0, PHYSICS.MIRA_B.radius * 1.4, pose, SE_ASPECT) / 100) * SE_HEIGHT;

    const barBottom = bar!.y + bar!.height;
    const a = await probe(page, 'data-mira-a-screen');
    const b = await probe(page, 'data-mira-b-screen');
    expect((a[1] / 100) * SE_HEIGHT - marginA).toBeGreaterThan(barBottom);
    expect((b[1] / 100) * SE_HEIGHT - marginB).toBeGreaterThan(barBottom);
  });

  test('the capture baseline is the live pin-solved framing, whatever the aspect (320×568, #102)', async ({ page }) => {
    // #102: the capture pose used to bind the stored EXPLORE constant — calibrated
    // at 390×844 — at whatever aspect the frame had. Bound raw at 320×568 it parked
    // the pair about 8 screen points higher than the framing a viewer actually
    // holds, and the max-light halo then read as padding into the 顶栏 in evidence
    // frames while the live view stayed clear. Evidence frames must show the live
    // composition: the capture baseline goes through the same per-aspect pin solve.
    // The equality with the live framing is transitive — the reduced-motion test
    // above pins the live probes to this same seam — so both reads target it here.
    // The worst case is expressed with ?epoch= (the halo swells with brightness,
    // never with uTime).
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/?quality=low&capture=1&cam=default&epoch=2027-03-09T00%3A00%3A00Z');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });
    await page.waitForTimeout(1500);

    // Capture parks the orbit at CAPTURE_TIME (8), so the pair's home for this
    // frame is the orbital position at t=8 — the seam computes the same numbers.
    const parked = calculateOrbitalPosition(8, PHYSICS.ORBIT);
    const SE_ASPECT = 320 / 568;
    const pose = portraitExplorePose(SE_ASPECT);
    for (const [name, point] of [
      ['data-mira-a-screen', parked.primary],
      ['data-mira-b-screen', parked.companion],
      ['data-tail-root-screen', TAIL_ROOT],
    ] as const) {
      const live = await probe(page, name);
      const expected = projectToScreenPercent(point, pose, SE_ASPECT, PORTRAIT_TILT);
      expect(Math.abs(live[0] - expected.x)).toBeLessThan(1.5);
      expect(Math.abs(live[1] - expected.y)).toBeLessThan(1.5);
    }
  });

  test('landscape keeps its own wide vista — not the portrait frame cropped (844×390)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await gotoWithFlags(page, { seenOpening: true });
    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('loading')).toHaveCount(0);

    // The landscape explore pose is the untouched wide vista (CAMERA.EXPLORE).
    await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', '8.0,7.0,28.0', { timeout: 30000 });

    const a = await probe(page, 'data-mira-a-screen');
    const b = await probe(page, 'data-mira-b-screen');
    const root = await probe(page, 'data-tail-root-screen');
    const far = await probe(page, 'data-tail-far-screen');

    for (const [x, y] of [a, b, root, far]) {
      expect(x).toBeGreaterThan(3);
      expect(x).toBeLessThan(97);
      expect(y).toBeGreaterThan(3);
      expect(y).toBeLessThan(97);
    }
    // The road still grows from between the pair toward the left — the vista the
    // portrait work must not narrow.
    expect(root[0]).toBeGreaterThan(Math.min(a[0], b[0]));
    expect(root[0]).toBeLessThan(Math.max(a[0], b[0]));
    expect(far[0]).toBeLessThan(root[0]);
  });
});
