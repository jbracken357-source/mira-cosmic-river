import { test, expect } from '@playwright/test';
import { CINEMATIC, CAMERA, PORTRAIT_CAMERA } from '../../src/constants/animation';
import { cinematicTimeScale, openingCaptionMark, resolveOpeningPose } from '../../src/lib/openingTimeline';

// Opening timeline (#28, ticket 03): the full cinematic as a pure function of time.
// The three beats are 起 hold (CLOSE) → 中 pull-back with the river pass (MID bow)
// → 末 settle that lands exactly on the explore framing, so the hand-off to free
// exploration is a landing, not a cut.

const LAND = { reduceMotion: false, portrait: false };
const PORT = { reduceMotion: false, portrait: true };
const REDUCED = { reduceMotion: true, portrait: false };

function dist(a: readonly number[], b: readonly number[]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

test.describe('hold (起)', () => {
  test('the opening holds the tight framing until the pull-back starts', () => {
    for (const t of [0, 1, CINEMATIC.STARS_APPEAR, 3.99]) {
      const pose = resolveOpeningPose(t, LAND);
      expect(pose.position).toEqual([...CAMERA.CLOSE.position]);
      expect(pose.lookAt).toEqual([...CAMERA.CLOSE.lookAt]);
      expect(pose.fov).toBe(CAMERA.CLOSE.fov);
    }
  });
});

test.describe('pull-back (中)', () => {
  test('the camera retreats monotonically while the fov opens', () => {
    let prev = resolveOpeningPose(CINEMATIC.PULL_BACK_START, LAND);
    for (let t = CINEMATIC.PULL_BACK_START + 0.5; t < CINEMATIC.PULL_BACK_END; t += 0.5) {
      const pose = resolveOpeningPose(t, LAND);
      expect(pose.position[2]).toBeGreaterThan(prev.position[2]);
      expect(pose.fov).toBeGreaterThanOrEqual(prev.fov);
      prev = pose;
    }
  });

  test('the pull-back ends exactly on the far framing', () => {
    const pose = resolveOpeningPose(CINEMATIC.PULL_BACK_END, LAND);
    expect(pose.position).toEqual([...CAMERA.FAR.position]);
    expect(pose.lookAt).toEqual([...CAMERA.FAR.lookAt]);
    expect(pose.fov).toBe(CAMERA.FOV_END);
  });

  test('the path bows toward the river instead of retreating in a straight line', () => {
    // Mid-pull (eased midpoint): the MID waypoint pulls the camera off the
    // CLOSE→FAR segment toward the tail side, so the river's near edge passes the lens.
    const pose = resolveOpeningPose(8, LAND);
    const straight = CAMERA.CLOSE.position.map((v, i) => v + (CAMERA.FAR.position[i] - v) * 0.5);
    expect(pose.position[0]).toBeLessThan(straight[0] - 0.5);
    expect(dist(pose.position, straight)).toBeGreaterThan(1);
  });
});

test.describe('settle (末) — the hand-off to free exploration', () => {
  test('the sequence ends exactly on the explore framing', () => {
    for (const t of [CINEMATIC.EXPLORE_MODE, 16, 30]) {
      const pose = resolveOpeningPose(t, LAND);
      expect(pose.position).toEqual([...CAMERA.EXPLORE.position]);
      expect(pose.lookAt).toEqual([...CAMERA.EXPLORE.lookAt]);
      expect(pose.fov).toBe(CAMERA.EXPLORE.fov);
      expect(pose.tailOpacity).toBe(0.85);
    }
  });

  test('the settle is continuous: no per-frame jump at the hand-off', () => {
    let prev = resolveOpeningPose(14, LAND);
    for (let t = 14.05; t <= CINEMATIC.EXPLORE_MODE; t += 0.05) {
      const pose = resolveOpeningPose(t, LAND);
      expect(dist(pose.position, prev.position)).toBeLessThan(0.2);
      expect(Math.abs(pose.fov - prev.fov)).toBeLessThan(0.5);
      prev = pose;
    }
    // The frame before the hand-off already sits on the explore framing.
    const last = resolveOpeningPose(14.99, LAND);
    expect(dist(last.position, CAMERA.EXPLORE.position)).toBeLessThan(0.05);
    expect(dist(last.lookAt, CAMERA.EXPLORE.lookAt)).toBeLessThan(0.05);
  });
});

test.describe('tail reveal', () => {
  test('dark through the hold, a glimmer in the pull-back, then a continuous rise', () => {
    expect(resolveOpeningPose(0, LAND).tailOpacity).toBe(0);
    expect(resolveOpeningPose(3.99, LAND).tailOpacity).toBe(0);
    const glimmer = resolveOpeningPose(6, LAND).tailOpacity;
    expect(glimmer).toBeGreaterThan(0);
    expect(glimmer).toBeLessThanOrEqual(0.15);
  });

  test('never pops at the tail-reveal mark: the ramp is monotone from pull-back on', () => {
    let prev = resolveOpeningPose(CINEMATIC.PULL_BACK_START, LAND).tailOpacity;
    for (let t = CINEMATIC.PULL_BACK_START + 0.25; t <= 12; t += 0.25) {
      const opacity = resolveOpeningPose(t, LAND).tailOpacity;
      expect(opacity).toBeGreaterThanOrEqual(prev);
      prev = opacity;
    }
    expect(resolveOpeningPose(CINEMATIC.TAIL_FULL, LAND).tailOpacity).toBe(0.85);
    expect(resolveOpeningPose(14, LAND).tailOpacity).toBe(0.85);
  });
});

test.describe('reduced motion', () => {
  test('pins the explore framing for the whole opening but keeps the tail reveal', () => {
    for (const t of [0, 5, 10, 14.9]) {
      const pose = resolveOpeningPose(t, REDUCED);
      expect(pose.position).toEqual([...CAMERA.EXPLORE.position]);
      expect(pose.lookAt).toEqual([...CAMERA.EXPLORE.lookAt]);
      expect(pose.fov).toBe(CAMERA.EXPLORE.fov);
    }
    expect(resolveOpeningPose(6, REDUCED).tailOpacity).toBeGreaterThan(0);
    expect(resolveOpeningPose(12, REDUCED).tailOpacity).toBe(0.85);
  });
});

test.describe('portrait composition', () => {
  test('the portrait hold is its own composition, not the desktop one cropped', () => {
    const pose = resolveOpeningPose(1, PORT);
    expect(pose.position).not.toEqual([...CAMERA.CLOSE.position]);
    // The pair stays the subject: the look-at remains near the binary.
    expect(dist(pose.lookAt, [0, 0, 0])).toBeLessThan(3);
  });

  test('the portrait pull-back bows toward the river too', () => {
    const pose = resolveOpeningPose(8, PORT);
    const straight = PORTRAIT_CAMERA.CLOSE.position.map(
      (v, i) => v + (PORTRAIT_CAMERA.FAR.position[i] - v) * 0.5,
    );
    expect(pose.position[0]).toBeLessThan(straight[0] - 0.5);
  });

  test('portrait lands exactly on the portrait explore framing', () => {
    const pose = resolveOpeningPose(CINEMATIC.EXPLORE_MODE, PORT);
    expect(pose.position).toEqual([...PORTRAIT_CAMERA.EXPLORE.position]);
    expect(pose.lookAt).toEqual([...PORTRAIT_CAMERA.EXPLORE.lookAt]);
    expect(pose.fov).toBe(PORTRAIT_CAMERA.EXPLORE.fov);
  });

  test('every phase is finite in portrait (no NaN anywhere on the timeline)', () => {
    for (let t = 0; t <= CINEMATIC.EXPLORE_MODE; t += 0.5) {
      const pose = resolveOpeningPose(t, PORT);
      for (const v of [...pose.position, ...pose.lookAt, pose.fov, pose.tailOpacity]) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});

test.describe('caption marks', () => {
  test('one mark per caption segment, matching the overlay thresholds', () => {
    expect(openingCaptionMark(0)).toBe(0);
    expect(openingCaptionMark(1.99)).toBe(0);
    expect(openingCaptionMark(CINEMATIC.STARS_APPEAR)).toBe(CINEMATIC.STARS_APPEAR);
    expect(openingCaptionMark(3.99)).toBe(CINEMATIC.STARS_APPEAR);
    expect(openingCaptionMark(CINEMATIC.PULL_BACK_START)).toBe(CINEMATIC.PULL_BACK_START);
    expect(openingCaptionMark(7.99)).toBe(CINEMATIC.PULL_BACK_START);
    expect(openingCaptionMark(CINEMATIC.TAIL_REVEAL_START)).toBe(CINEMATIC.TAIL_REVEAL_START);
    expect(openingCaptionMark(12.49)).toBe(CINEMATIC.TAIL_REVEAL_START);
    expect(openingCaptionMark(CINEMATIC.FINAL_TEXT)).toBe(CINEMATIC.FINAL_TEXT);
    expect(openingCaptionMark(15)).toBe(CINEMATIC.FINAL_TEXT);
  });
});

test.describe('dev override shape', () => {
  test('cinematicTimeScale defaults to 1 outside the dev override', () => {
    // No window and no query params under the node runner: the override drops out.
    expect(cinematicTimeScale()).toBe(1);
  });
});
