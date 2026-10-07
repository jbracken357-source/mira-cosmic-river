import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { CAMERA, PORTRAIT_CAMERA } from '../../src/constants/animation';
import { calculateOrbitalPosition, PHYSICS } from '../../src/constants/physics';
import { fittedFov } from '../../src/lib/freeViewCamera';
import {
  PORTRAIT_REFERENCE_ASPECT,
  PORTRAIT_TILT,
  portraitExplorePose,
  projectToScreenPercent,
  screenDiscRadiusPercent,
} from '../../src/lib/portraitFraming';
import { TAIL_ROOT, tailCenterline, tailFarEnd, tailMidProbe, yawY } from '../../src/lib/tailPath';

// 竖屏长卷 (#92): the portrait free-viewing framing as geometry, not pixels. The
// pair's home configuration and the road's anchors are projected through the poses
// the frame loop actually consumes — portraitExplorePose (the aspect-pinned explore
// framing) and the PORTRAIT_CAMERA constants — and the composition's promises are
// asserted off those projections: the pair high and clear of the 顶栏 and the
// 终幕标题, the road running down the long axis into the lower half, and the
// landscape vista untouched beside it.

const REF = PORTRAIT_REFERENCE_ASPECT; // 390×844, the ticket's named frame
const SE = 320 / 568; // the shortest portrait in the interface viewport matrix

const HOME = calculateOrbitalPosition(0, PHYSICS.ORBIT);
const HOME_A = HOME.primary;
const HOME_B = HOME.companion;
const TAIL_LENGTH = PHYSICS.TAIL.length;

// The pair's on-screen disc, with margin: the photosphere plus its dense
// atmosphere — the same reach the click target spells (radius × 1.4).
const DISC_MARGIN = 1.4;

// 终幕标题: the final beat's title block opens at top-1/3 of the frame.
const TITLE_TOP_PERCENT = 100 / 3;
// 顶栏: 76px measured in e2e at both named widths (the first-read row: padding +
// the 44px controls). Once the viewer's first drag or zoom grows the bar （暂停 and
// 今晚的 Mira join), it wraps to a second row (132px) — no composition can clear
// a two-row bar AND keep the pair above the title band, so the pin's standard is
// the first-read row, the bar's state when the long scroll lands.
const TOP_BAR_BOTTOM_PERCENT = (76 / 844) * 100;
const TOP_BAR_BOTTOM_PERCENT_SE = (76 / 568) * 100;

test.describe('projectToScreenPercent matches the three.js pipeline the scene runs', () => {
  test('parity with PerspectiveCamera + fittedFov under the portrait tilt', () => {
    const pose = portraitExplorePose(REF);
    const camera = new THREE.PerspectiveCamera(fittedFov(pose.fov, REF), REF, 0.1, 200);
    camera.position.set(...pose.position);
    camera.lookAt(...pose.lookAt);
    camera.updateMatrixWorld();
    const tilt = new THREE.Matrix4().makeRotationZ(PORTRAIT_TILT);
    for (const point of [HOME_A, HOME_B, TAIL_ROOT, tailFarEnd(TAIL_LENGTH), yawY(tailCenterline(0.5, TAIL_LENGTH))]) {
      const v = new THREE.Vector3(...point).applyMatrix4(tilt).project(camera);
      const expected = { x: ((v.x + 1) / 2) * 100, y: ((1 - v.y) / 2) * 100 };
      const actual = projectToScreenPercent(point, pose, REF, PORTRAIT_TILT);
      expect(actual.x).toBeCloseTo(expected.x, 6);
      expect(actual.y).toBeCloseTo(expected.y, 6);
      expect(actual.depth).toBeGreaterThan(0);
    }
  });
});

test.describe('竖屏长卷: the root pins the pair to its calibrated screen point', () => {
  test('portraitExplorePose is exactly the calibrated constants at the reference aspect', () => {
    const pose = portraitExplorePose(REF);
    expect(pose.position).toEqual([...PORTRAIT_CAMERA.EXPLORE.position]);
    expect(pose.lookAt).toEqual([...PORTRAIT_CAMERA.EXPLORE.lookAt]);
    expect(pose.fov).toBe(PORTRAIT_CAMERA.EXPLORE.fov);
  });

  test('the 根 holds the same screen point across portrait aspects', () => {
    const reference = projectToScreenPercent(TAIL_ROOT, portraitExplorePose(REF), REF, PORTRAIT_TILT);
    for (const aspect of [375 / 812, 430 / 932, SE, 0.4, 0.55]) {
      const pinned = projectToScreenPercent(TAIL_ROOT, portraitExplorePose(aspect), aspect, PORTRAIT_TILT);
      expect(Math.abs(pinned.x - reference.x)).toBeLessThan(0.05);
      expect(Math.abs(pinned.y - reference.y)).toBeLessThan(0.05);
    }
  });

  test('the camera position itself never moves with aspect — only the aim does', () => {
    for (const aspect of [SE, 0.4, 0.55]) {
      expect(portraitExplorePose(aspect).position).toEqual([...PORTRAIT_CAMERA.EXPLORE.position]);
    }
  });
});

test.describe('竖屏长卷: the road runs down the long axis at 390×844', () => {
  const pose = portraitExplorePose(REF);
  const a = projectToScreenPercent(HOME_A, pose, REF, PORTRAIT_TILT);
  const b = projectToScreenPercent(HOME_B, pose, REF, PORTRAIT_TILT);
  const root = projectToScreenPercent(TAIL_ROOT, pose, REF, PORTRAIT_TILT);
  const mid = projectToScreenPercent(yawY(tailCenterline(0.5, TAIL_LENGTH)), pose, REF, PORTRAIT_TILT);
  const far = projectToScreenPercent(tailFarEnd(TAIL_LENGTH), pose, REF, PORTRAIT_TILT);
  // The visible-reach stations (#92 review): t=0.7 is the e2e's probe anchor —
  // deep inside the strong-alpha body; t=0.92 is where the portrait-softened far
  // fade (PORTRAIT_FAR_FADE_SCALE, 0.93) is still nearly full. No alpha-zero
  // point stands in for visibility here.
  const reach = projectToScreenPercent(tailMidProbe(TAIL_LENGTH), pose, REF, PORTRAIT_TILT);
  const softEnd = projectToScreenPercent(yawY(tailCenterline(0.92, TAIL_LENGTH)), pose, REF, PORTRAIT_TILT);

  test('both stars are in frame, high on the right', () => {
    for (const star of [a, b]) {
      expect(star.x).toBeGreaterThan(50);
      expect(star.x).toBeLessThan(90);
      expect(star.y).toBeGreaterThan(10);
      expect(star.y).toBeLessThan(28);
    }
  });

  test('the road enters the lower half while the pair stays in frame', () => {
    // Root above, far end deep in the lower half: the scroll reads top to bottom.
    expect(root.y).toBeLessThan(mid.y);
    expect(mid.y).toBeLessThan(far.y);
    expect(mid.y).toBeGreaterThan(35);
    expect(far.y).toBeGreaterThan(64);
    expect(far.y).toBeLessThan(85);
    expect(far.x).toBeGreaterThan(20);
    expect(far.x).toBeLessThan(65);
  });

  test('the river\'s VISIBLE reach sweeps deep into the lower half', () => {
    // The review round's promise: the strong-alpha body crosses the midline and
    // the softened fade's strong end lands clearly past 60% — below the ticket's
    // first calibration, where the river dissolved by 58–65% and the lower screen
    // went back to starfield. The geometric far end runs deeper still.
    expect(reach.y).toBeGreaterThan(50);
    expect(softEnd.y).toBeGreaterThan(62);
    expect(far.y).toBeGreaterThan(softEnd.y);
    // 近处有气: the near reach (root cone, t≤0.3) wraps the pair's region instead
    // of starting downstream — it begins right at the root and spreads.
    const near = projectToScreenPercent(yawY(tailCenterline(0.2, TAIL_LENGTH)), pose, REF, PORTRAIT_TILT);
    expect(near.y).toBeLessThan(mid.y);
    expect(near.y).toBeGreaterThan(root.y);
    const mist = screenDiscRadiusPercent(root, 1.2, pose, REF, PORTRAIT_TILT);
    expect(mist).toBeGreaterThan(2);
  });

  test('the pair clears the 顶栏 with the disc margin', () => {
    for (const [star, radius] of [
      [a, PHYSICS.MIRA_A.radius],
      [b, PHYSICS.MIRA_B.radius],
    ] as const) {
      const disc = screenDiscRadiusPercent(star, radius * DISC_MARGIN, pose, REF, PORTRAIT_TILT);
      expect(star.y - disc).toBeGreaterThan(TOP_BAR_BOTTOM_PERCENT + 2);
    }
  });

  test('the pair clears the 顶栏 on the shortest portrait too (320×568)', () => {
    const poseSe = portraitExplorePose(SE);
    for (const [home, radius] of [
      [HOME_A, PHYSICS.MIRA_A.radius],
      [HOME_B, PHYSICS.MIRA_B.radius],
    ] as const) {
      const star = projectToScreenPercent(home, poseSe, SE, PORTRAIT_TILT);
      const core = screenDiscRadiusPercent(star, radius, poseSe, SE, PORTRAIT_TILT);
      // The star's body stays below the bar; only the faint outer haze may brush it.
      expect(star.y - core).toBeGreaterThan(TOP_BAR_BOTTOM_PERCENT_SE);
    }
  });

  test('the pair\'s dense discs clear the real 320×568 顶栏 (#92 review)', () => {
    // The e2e at this size measures the bar's box (76px) and asserts the same
    // disc standard as 390×844's unit pin (photosphere + dense atmosphere, ×1.4,
    // both stars). The companion's ×4.8 accretion reach — the disk's outer radius
    // in its own plane — is pinned by the 390×844 e2e; at 320×568 that spherical
    // standard is geometrically incompatible with the long scroll itself (the
    // pair would have to fit between the bar and the title band with no room for
    // the road), so the claim here is the one both stars genuinely satisfy.
    const poseSe = portraitExplorePose(SE);
    for (const [home, radius] of [
      [HOME_A, PHYSICS.MIRA_A.radius],
      [HOME_B, PHYSICS.MIRA_B.radius],
    ] as const) {
      const star = projectToScreenPercent(home, poseSe, SE, PORTRAIT_TILT);
      const disc = screenDiscRadiusPercent(star, radius * DISC_MARGIN, poseSe, SE, PORTRAIT_TILT);
      expect(star.y - disc).toBeGreaterThan(TOP_BAR_BOTTOM_PERCENT_SE + 0.5);
    }
  });

  test('the pair\'s discs clear the 终幕标题\'s band on the shortest portrait too (320×568)', () => {
    // Not pinned before the review round: the title and the near-explore pose
    // coexist for the settle's last frames (FINAL_TEXT → EXPLORE_MODE), and the
    // recalibrated composition must keep the giant's atmosphere out of the title
    // box there as well.
    const poseSe = portraitExplorePose(SE);
    const aSe = projectToScreenPercent(HOME_A, poseSe, SE, PORTRAIT_TILT);
    const bSe = projectToScreenPercent(HOME_B, poseSe, SE, PORTRAIT_TILT);
    const discA = screenDiscRadiusPercent(aSe, PHYSICS.MIRA_A.radius * DISC_MARGIN, poseSe, SE, PORTRAIT_TILT);
    const discB = screenDiscRadiusPercent(bSe, PHYSICS.MIRA_B.radius * DISC_MARGIN, poseSe, SE, PORTRAIT_TILT);
    expect(aSe.y + discA).toBeLessThan(TITLE_TOP_PERCENT - 0.3);
    expect(bSe.y + discB).toBeLessThan(TITLE_TOP_PERCENT - 1);
  });

  test('the explore framing clears the 终幕标题 band (reduced motion pins this framing)', () => {
    const disc = screenDiscRadiusPercent(a, PHYSICS.MIRA_A.radius * DISC_MARGIN, pose, REF, PORTRAIT_TILT);
    expect(a.y + disc).toBeLessThan(TITLE_TOP_PERCENT - 1);
    const discB = screenDiscRadiusPercent(b, PHYSICS.MIRA_B.radius * DISC_MARGIN, pose, REF, PORTRAIT_TILT);
    expect(b.y + discB).toBeLessThan(TITLE_TOP_PERCENT - 1);
  });

  test('the red giant still dwarfs the companion on screen', () => {
    const discA = screenDiscRadiusPercent(a, PHYSICS.MIRA_A.radius, pose, REF, PORTRAIT_TILT);
    const discB = screenDiscRadiusPercent(b, PHYSICS.MIRA_B.radius, pose, REF, PORTRAIT_TILT);
    expect(discA).toBeGreaterThan(discB * 4);
  });
});

test.describe('竖屏长卷: the road reaches deeper still on the shortest portrait (320×568)', () => {
  // The narrow frame widens the fitted vertical angle, so the river runs further
  // down the screen here than at 390×844: the strong-alpha body ends past ~68%,
  // the softened fade's strong end past ~72%, the far end past ~76%.
  const poseSe = portraitExplorePose(SE);
  const reach = projectToScreenPercent(tailMidProbe(TAIL_LENGTH), poseSe, SE, PORTRAIT_TILT);
  const softEnd = projectToScreenPercent(yawY(tailCenterline(0.92, TAIL_LENGTH)), poseSe, SE, PORTRAIT_TILT);
  const far = projectToScreenPercent(tailFarEnd(TAIL_LENGTH), poseSe, SE, PORTRAIT_TILT);

  test('the visible reach and the far end at 320×568', () => {
    expect(reach.y).toBeGreaterThan(55);
    expect(softEnd.y).toBeGreaterThan(70);
    expect(far.y).toBeGreaterThan(74);
    expect(far.y).toBeLessThan(92);
    expect(far.x).toBeGreaterThan(20);
    expect(far.x).toBeLessThan(80);
  });
});

test.describe('竖屏长卷: the 终幕 title beat (the far pose) keeps the pair clear', () => {
  test('at the far pose the pair discs stay above the title band, at both extremes', () => {
    const far = PORTRAIT_CAMERA.FAR;
    for (const aspect of [REF, SE]) {
      const a = projectToScreenPercent(HOME_A, far, aspect, PORTRAIT_TILT);
      const b = projectToScreenPercent(HOME_B, far, aspect, PORTRAIT_TILT);
      const discA = screenDiscRadiusPercent(a, PHYSICS.MIRA_A.radius * DISC_MARGIN, far, aspect, PORTRAIT_TILT);
      const discB = screenDiscRadiusPercent(b, PHYSICS.MIRA_B.radius * DISC_MARGIN, far, aspect, PORTRAIT_TILT);
      expect(a.y + discA).toBeLessThan(TITLE_TOP_PERCENT - 1);
      expect(b.y + discB).toBeLessThan(TITLE_TOP_PERCENT - 1);
      // ...and nothing has left the frame to get there.
      for (const star of [a, b]) {
        expect(star.x).toBeGreaterThan(3);
        expect(star.x).toBeLessThan(97);
        expect(star.y).toBeGreaterThan(3);
      }
    }
  });

  test('the closing pose still reads: pair in frame, road in view', () => {
    const closing = PORTRAIT_CAMERA.CLOSING;
    const a = projectToScreenPercent(HOME_A, closing, REF, PORTRAIT_TILT);
    const far = projectToScreenPercent(tailFarEnd(TAIL_LENGTH), closing, REF, PORTRAIT_TILT);
    expect(a.x).toBeGreaterThan(3);
    expect(a.x).toBeLessThan(97);
    expect(a.y).toBeGreaterThan(3);
    expect(a.y).toBeLessThan(97);
    expect(far.y).toBeGreaterThan(50);
  });
});

test.describe('横屏 keeps its own vista — not the wide frame cropped narrow', () => {
  test('the landscape table is untouched by the portrait work', () => {
    expect([...CAMERA.EXPLORE.position]).toEqual([8, 7, 28]);
    expect([...CAMERA.EXPLORE.lookAt]).toEqual([-3, 1, 5]);
    expect(CAMERA.EXPLORE.fov).toBe(45);
    expect([...CAMERA.FAR.position]).toEqual([8, 8, 30]);
    expect([...CAMERA.CLOSING.position]).toEqual([8, 10, 34]);
  });

  test('the portrait explore is its own composition, not the landscape pose refit', () => {
    const portrait = PORTRAIT_CAMERA.EXPLORE;
    const moved = Math.hypot(
      portrait.position[0] - CAMERA.EXPLORE.position[0],
      portrait.position[1] - CAMERA.EXPLORE.position[1],
      portrait.position[2] - CAMERA.EXPLORE.position[2],
    );
    // A crop would keep the same camera and only change the frame; the long scroll
    // stands somewhere else entirely.
    expect(moved).toBeGreaterThan(10);
  });

  test('the fov fit preserves the horizontal framing (the opposite of cropping)', () => {
    // For any aspect, the fitted camera's horizontal half-angle tangent equals the
    // stored fov's at the reference square — the sides are never cut away.
    for (const aspect of [16 / 9, 1, REF, SE]) {
      const fitted = fittedFov(45, aspect);
      const tanH = Math.tan((fitted * Math.PI) / 360) * aspect;
      expect(tanH).toBeCloseTo(Math.tan((45 * Math.PI) / 360) * Math.max(1, aspect), 9);
    }
  });

  test('in landscape the road still grows from between the pair toward the left', () => {
    const aspect = 844 / 390;
    const a = projectToScreenPercent(HOME_A, CAMERA.EXPLORE, aspect, 0);
    const b = projectToScreenPercent(HOME_B, CAMERA.EXPLORE, aspect, 0);
    const root = projectToScreenPercent(TAIL_ROOT, CAMERA.EXPLORE, aspect, 0);
    const far = projectToScreenPercent(tailFarEnd(TAIL_LENGTH), CAMERA.EXPLORE, aspect, 0);
    // The root sits between the two stars' projections, the far end off to the left.
    expect(root.x).toBeGreaterThan(Math.min(a.x, b.x));
    expect(root.x).toBeLessThan(Math.max(a.x, b.x));
    expect(far.x).toBeLessThan(root.x);
    for (const p of [a, b, root, far]) {
      expect(p.x).toBeGreaterThan(3);
      expect(p.x).toBeLessThan(97);
      expect(p.y).toBeGreaterThan(3);
      expect(p.y).toBeLessThan(97);
    }
  });
});
