import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CAMERA, PORTRAIT_CAMERA } from '../../src/constants/animation';
import { PHYSICS, calculateOrbitalPosition } from '../../src/constants/physics';
import { PORTRAIT_TILT, projectToScreenPercent, screenDiscRadiusPercent } from '../../src/lib/portraitFraming';
import { sharedJourney } from '../../src/lib/sharedJourney';
import { tailHeading } from '../../src/lib/tailPath';
import { MID_DECLINE_EPOCH } from './helpers';

// 结语不压红巨星 (#115): the epilogue re-verified at the REAL idle timing — no
// ?idle-* overrides anywhere in these URLs. The compressed review round watched
// 「…选择了你的。」 arrive with a 0.8s lead, but the closing flight's 8s budget
// (TRANSITIONS.CLOSING_CAMERA) never compresses: the line showed while the camera
// had barely left the explore framing. At the real 60s the flight has landed and
// 共同前行 has carried the pair ~2.4 units down the 去向 — a different composition
// than the one the review screenshot saw, so it is measured, not assumed.
//
// The standard is the one the 顶栏 / 终幕标题 clearance proofs already use: the
// live screen probe (data-mira-a-screen) for the giant's centre, and the pure
// seam's disc radius at ×1.4 of the photosphere (photosphere + dense atmosphere).
// 字不压星, both languages, desktop and the 390×844 竖屏长卷.

// The real rules from lib/viewerControl: 30s resume, 3s ramp, 60s epilogue, 8s
// lead. The settle read below adds the line's 0.8s enter on top of the 60s.
const EPILOGUE_WAIT_MS = 75_000;
const SETTLE_MS = 2000;

const HEADING = tailHeading(PHYSICS.TAIL.length);

// The giant's journey-frame home once the ride has effectively arrived: 60s of
// idle is four times the journey's 15s timescale, and travel(75) vs travel(150)
// differ by well under a pixel on screen, so the converged phase is honest for
// the disc's depth. The orbit's ±0.1 wobble rides on top as slack, sampled live.
const RIDE = sharedJourney(75, HEADING);
const HOME_ORBIT = calculateOrbitalPosition(0, PHYSICS.ORBIT).primary;
const GIANT_JOURNEY_FRAME = [
  RIDE.base[0] + RIDE.primary[0] + HOME_ORBIT[0],
  RIDE.base[1] + RIDE.primary[1] + HOME_ORBIT[1],
  RIDE.base[2] + RIDE.primary[2] + HOME_ORBIT[2],
] as const;

interface ClearanceRead {
  // Worst sampled gap on each axis, px; negative = overlap depth.
  gapX: number;
  gapY: number;
}

async function readClearance(page: Page, language: 'ch' | 'en', screenshot: string): Promise<ClearanceRead> {
  const canvas = page.locator('canvas');
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox, 'canvas has a box').toBeTruthy();

  // The settled framing, derived from the stored pose so a retune moves both
  // together: the closing flight parks the camera exactly on CLOSING (fov fitting
  // never moves the position).
  const portrait = canvasBox.height > canvasBox.width;
  const pose = (portrait ? PORTRAIT_CAMERA : CAMERA).CLOSING;
  await expect(canvas).toHaveAttribute(
    'data-camera-pose',
    pose.position.map((v) => v.toFixed(1)).join(','),
  );

  // The pure seam's projection of the giant in that framing — cross-checked
  // against the live probe below, the same parity the 竖屏长卷 specs pin.
  const aspect = canvasBox.width / canvasBox.height;
  const projected = projectToScreenPercent(GIANT_JOURNEY_FRAME, pose, aspect, portrait ? PORTRAIT_TILT : 0);
  const discPx =
    (screenDiscRadiusPercent(projected, PHYSICS.MIRA_A.radius * 1.4, pose, aspect) / 100) * canvasBox.height;

  const text = await page.getByTestId('epilogue-text').boundingBox();
  expect(text, 'epilogue text has a box').toBeTruthy();
  // The language anchor is part of the read: the line's box is what may differ.
  await expect(page.getByTestId('epilogue-line-1')).toHaveText(
    language === 'ch' ? '我们都是星尘。' : 'We are made of starstuff.',
  );

  let worst: ClearanceRead = { gapX: Infinity, gapY: Infinity };
  for (let i = 0; i < 6; i += 1) {
    const raw = await canvas.getAttribute('data-mira-a-screen');
    expect(raw, 'the giant\'s screen probe is written').toBeTruthy();
    const [px, py] = raw!.split(',').map(Number);
    // The live framing matches the seam within the wobble's reach (~±1% of screen).
    expect(Math.abs(px - projected.x)).toBeLessThan(3);
    expect(Math.abs(py - projected.y)).toBeLessThan(3);

    const cx = canvasBox.x + (px / 100) * canvasBox.width;
    const cy = canvasBox.y + (py / 100) * canvasBox.height;
    const gapX = Math.max(text!.x - (cx + discPx), cx - discPx - (text!.x + text!.width));
    const gapY = Math.max(text!.y - (cy + discPx), cy - discPx - (text!.y + text!.height));
    console.log(
      `[115] sample ${i}: live ${px.toFixed(2)},${py.toFixed(2)} seam ${projected.x.toFixed(2)},${projected.y.toFixed(2)} ` +
        `cx ${cx.toFixed(0)} r ${discPx.toFixed(0)} gapX ${gapX.toFixed(0)} gapY ${gapY.toFixed(0)}`,
    );
    worst = { gapX: Math.min(worst.gapX, gapX), gapY: Math.min(worst.gapY, gapY) };
    await page.waitForTimeout(400);
  }

  console.log(
    `[115] ${portrait ? 'portrait' : 'desktop'} ${language}: text box ` +
      `${text!.width.toFixed(0)}×${text!.height.toFixed(0)}, disc r ${discPx.toFixed(0)}px, ` +
      `worst gaps x=${worst.gapX.toFixed(0)}px y=${worst.gapY.toFixed(0)}px`,
  );
  await page.screenshot({ path: screenshot });
  return worst;
}

async function gotoIdleEpilogue(
  page: Page,
  viewport: { width: number; height: number },
  language: 'ch' | 'en',
  screenshot: string,
): Promise<ClearanceRead> {
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    localStorage.setItem('mira:seen-opening', '1');
    localStorage.setItem('mira:learned-controls', '1');
  });
  await page.goto(`/?quality=low&epoch=${MID_DECLINE_EPOCH}`);
  await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('loading')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });

  // The language settles before the idle count starts: the toggle is a control
  // press and restamps the shared clock, which is free now and a full 60s later.
  if (language === 'en') {
    await page.getByTestId('language-toggle').click();
  }
  // The idle count starts from a ready scene (same reason as viewer-control.spec:
  // under software rendering, load time is not scaled and could eat the window).
  await page.keyboard.press('Shift');

  await expect(page.getByTestId('epilogue-text')).toBeVisible({ timeout: EPILOGUE_WAIT_MS });
  // The line's 0.8s enter (结语浮现并落定), then the read is of the settled picture.
  await page.waitForTimeout(SETTLE_MS);
  return readClearance(page, language, screenshot);
}

test.describe('结语不压红巨星 (#115): real idle timing', () => {
  // The real 60s idle plus load and settle: minutes, by design — this is the one
  // spec that must not compress the wait it verifies.
  test.setTimeout(180_000);

  test('desktop 1440×900: the settled 结语 clears the red giant (zh)', async ({ page }) => {
    const worst = await gotoIdleEpilogue(page, { width: 1440, height: 900 }, 'ch', 'docs/evidence-115/desktop-1440x900-zh.png');
    expect(Math.max(worst.gapX, worst.gapY), 'text box and disc overlap').toBeGreaterThan(0);
  });

  test('desktop 1440×900: the settled 结语 clears the red giant (en)', async ({ page }) => {
    const worst = await gotoIdleEpilogue(page, { width: 1440, height: 900 }, 'en', 'docs/evidence-115/desktop-1440x900-en.png');
    expect(Math.max(worst.gapX, worst.gapY), 'text box and disc overlap').toBeGreaterThan(0);
  });

  test('390×844 竖屏: the settled 结语 clears the red giant (zh)', async ({ page }) => {
    const worst = await gotoIdleEpilogue(page, { width: 390, height: 844 }, 'ch', 'docs/evidence-115/portrait-390x844-zh.png');
    expect(Math.max(worst.gapX, worst.gapY), 'text box and disc overlap').toBeGreaterThan(0);
  });

  test('390×844 竖屏: the settled 结语 clears the red giant (en)', async ({ page }) => {
    const worst = await gotoIdleEpilogue(page, { width: 390, height: 844 }, 'en', 'docs/evidence-115/portrait-390x844-en.png');
    expect(Math.max(worst.gapX, worst.gapY), 'text box and disc overlap').toBeGreaterThan(0);
  });
});
