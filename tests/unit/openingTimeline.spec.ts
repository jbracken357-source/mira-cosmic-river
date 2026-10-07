import { test, expect } from '@playwright/test';
import { CINEMATIC, CAMERA, PORTRAIT_CAMERA } from '../../src/constants/animation';
import { cinematicTimeScale, openingSegment, resolveOpeningPose, TAIL_EMERGING, TAIL_GLIMMER } from '../../src/lib/openingTimeline';

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
    expect(pose.fov).toBe(CAMERA.FAR.fov);
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
  test('dark until the gathering begins, then a continuous rise past the floor', () => {
    expect(resolveOpeningPose(0, LAND).tailOpacity).toBe(0);
    expect(resolveOpeningPose(CINEMATIC.TAIL_FORMING_START - 0.01, LAND).tailOpacity).toBe(0);
    // #91: by the pull-back the road has crossed the old glimmer floor (底光) for good.
    expect(resolveOpeningPose(6, LAND).tailOpacity).toBeGreaterThan(TAIL_GLIMMER);
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

  // #91, strict reading: 「第二句『彼此牵引，一起走向更远。』出现时，尾巴已经在显形，
  // 不再只是底光。」 — the caption's APPEARANCE (PULL_BACK_START) is the moment that
  // must already be past the base glow, so the rise has to begin inside the first
  // caption's window. By the third caption the tail is clearly more than the glow.
  test.describe('the road is already forming when the second caption appears (#91)', () => {
    test('the forming begins inside the first caption’s window, not at the tail-reveal mark', () => {
      expect(CINEMATIC.TAIL_FORMING_START).toBeGreaterThan(CINEMATIC.STARS_APPEAR);
      expect(CINEMATIC.TAIL_FORMING_START).toBeLessThan(CINEMATIC.PULL_BACK_START);
      expect(openingSegment(CINEMATIC.TAIL_FORMING_START).caption).toBe('cinematic1');
    });

    test('the first caption’s own beat stays quiet: never more than the old floor', () => {
      // The onset is the glow gathering; it reaches the glimmer floor exactly as the
      // caption changes, so caption 1's window is not visually disturbed.
      expect(resolveOpeningPose(2.5, LAND).tailOpacity).toBe(0);
      expect(resolveOpeningPose(CINEMATIC.PULL_BACK_START - 0.5, LAND).tailOpacity).toBeLessThanOrEqual(TAIL_GLIMMER + 1e-9);
    });

    test('at the second caption’s appearance the road is past the base glow, with margin', () => {
      expect(openingSegment(CINEMATIC.PULL_BACK_START).caption).toBe('cinematic2');
      expect(resolveOpeningPose(CINEMATIC.PULL_BACK_START, LAND).tailOpacity).toBe(TAIL_EMERGING);
      expect(TAIL_EMERGING).toBeGreaterThan(TAIL_GLIMMER * 1.5);
    });

    test('the ramp is continuous across both joins', () => {
      // Slope-zero eases at the forming mark and the pull-back mark: no pop, no kink.
      expect(resolveOpeningPose(CINEMATIC.TAIL_FORMING_START, LAND).tailOpacity).toBe(0);
      expect(resolveOpeningPose(CINEMATIC.TAIL_FORMING_START + 1e-3, LAND).tailOpacity).toBeLessThan(1e-3);
      expect(resolveOpeningPose(CINEMATIC.PULL_BACK_START - 1e-3, LAND).tailOpacity).toBeCloseTo(TAIL_EMERGING, 3);
      expect(resolveOpeningPose(CINEMATIC.PULL_BACK_START, LAND).tailOpacity).toBe(TAIL_EMERGING);
    });

    test('every moment the second caption is up shows more than the base glow', () => {
      for (let t = CINEMATIC.PULL_BACK_START; t < CINEMATIC.TAIL_REVEAL_START; t += 0.25) {
        expect(resolveOpeningPose(t, LAND).tailOpacity).toBeGreaterThan(TAIL_GLIMMER);
      }
    });

    test('by the third caption the road is clearly forming', () => {
      expect(resolveOpeningPose(CINEMATIC.TAIL_REVEAL_START, LAND).tailOpacity).toBeGreaterThanOrEqual(TAIL_GLIMMER * 2);
    });
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

  test('the portrait pull-back still bends through its waypoint on the way to the river', () => {
    const pose = resolveOpeningPose(8, PORT);
    const straight = PORTRAIT_CAMERA.CLOSE.position.map(
      (v, i) => v + (PORTRAIT_CAMERA.FAR.position[i] - v) * 0.5,
    );
    // The far pose itself stands on the river's side, so the old "left of the
    // chord" check no longer describes the bow. The waypoint still pulls the
    // path off a straight retreat.
    expect(dist(pose.position, straight)).toBeGreaterThan(1);
    expect(PORTRAIT_CAMERA.FAR.position[0]).toBeLessThan(PORTRAIT_CAMERA.CLOSE.position[0]);
  });

  test('portrait far, explore and closing stand back so the tail can read as long', () => {
    const lengthOf = (p: readonly number[]) => Math.hypot(p[0], p[1], p[2]);
    expect(lengthOf(PORTRAIT_CAMERA.EXPLORE.position)).toBeGreaterThan(lengthOf(PORTRAIT_CAMERA.CLOSE.position) * 2);
    expect(lengthOf(PORTRAIT_CAMERA.FAR.position)).toBeGreaterThan(lengthOf(CAMERA.FAR.position));
    expect(lengthOf(PORTRAIT_CAMERA.CLOSING.position)).toBeGreaterThan(lengthOf(PORTRAIT_CAMERA.EXPLORE.position));
    expect(PORTRAIT_CAMERA.EXPLORE.lookAt[1]).toBeLessThan(PORTRAIT_CAMERA.CLOSE.lookAt[1]);
    expect(lengthOf(PORTRAIT_CAMERA.EXPLORE.lookAt)).toBeGreaterThan(8);
    expect(lengthOf(PORTRAIT_CAMERA.CLOSE.position)).toBeLessThan(18);
  });

  test('the portrait fov path reads the portrait table, not the landscape globals', () => {
    // If the timeline fell back to the landscape constants these would stay green
    // only while both tables coincidentally agree — diverge them and this goes red.
    expect(resolveOpeningPose(1, PORT).fov).toBe(PORTRAIT_CAMERA.CLOSE.fov);
    expect(resolveOpeningPose(CINEMATIC.PULL_BACK_END, PORT).fov).toBe(PORTRAIT_CAMERA.FAR.fov);
    expect(resolveOpeningPose(12.25, PORT).fov).toBe(PORTRAIT_CAMERA.FAR.fov);
    expect(resolveOpeningPose(CINEMATIC.EXPLORE_MODE, PORT).fov).toBe(PORTRAIT_CAMERA.EXPLORE.fov);
    const mid = resolveOpeningPose(8, PORT).fov;
    expect(mid).toBeGreaterThanOrEqual(Math.min(PORTRAIT_CAMERA.CLOSE.fov, PORTRAIT_CAMERA.FAR.fov));
    expect(mid).toBeLessThanOrEqual(Math.max(PORTRAIT_CAMERA.CLOSE.fov, PORTRAIT_CAMERA.FAR.fov));
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

test.describe('opening segments (caption ↔ phase)', () => {
  test('one mark per caption segment, matching the overlay thresholds', () => {
    expect(openingSegment(0).mark).toBe(0);
    expect(openingSegment(1.99).mark).toBe(0);
    expect(openingSegment(CINEMATIC.STARS_APPEAR).mark).toBe(CINEMATIC.STARS_APPEAR);
    expect(openingSegment(3.99).mark).toBe(CINEMATIC.STARS_APPEAR);
    expect(openingSegment(CINEMATIC.PULL_BACK_START).mark).toBe(CINEMATIC.PULL_BACK_START);
    expect(openingSegment(7.99).mark).toBe(CINEMATIC.PULL_BACK_START);
    expect(openingSegment(CINEMATIC.TAIL_REVEAL_START).mark).toBe(CINEMATIC.TAIL_REVEAL_START);
    expect(openingSegment(12.49).mark).toBe(CINEMATIC.TAIL_REVEAL_START);
    expect(openingSegment(CINEMATIC.FINAL_TEXT).mark).toBe(CINEMATIC.FINAL_TEXT);
    expect(openingSegment(15).mark).toBe(CINEMATIC.FINAL_TEXT);
  });

  test('each beat names its phase, caption and title together', () => {
    expect(openingSegment(0)).toEqual({ phase: 'dark', caption: null, title: false, mark: 0 });
    expect(openingSegment(CINEMATIC.STARS_APPEAR)).toEqual({
      phase: 'stars-appear', caption: 'cinematic1', title: false, mark: CINEMATIC.STARS_APPEAR,
    });
    expect(openingSegment(CINEMATIC.PULL_BACK_START)).toEqual({
      phase: 'pull-back', caption: 'cinematic2', title: false, mark: CINEMATIC.PULL_BACK_START,
    });
    expect(openingSegment(CINEMATIC.TAIL_REVEAL_START)).toEqual({
      phase: 'tail-reveal', caption: 'cinematic3', title: false, mark: CINEMATIC.TAIL_REVEAL_START,
    });
    // Title is explicit: the mark has quantized to FINAL_TEXT while the phase is
    // still tail-reveal. Explore only begins at EXPLORE_MODE.
    expect(openingSegment(CINEMATIC.FINAL_TEXT)).toEqual({
      phase: 'tail-reveal', caption: null, title: true, mark: CINEMATIC.FINAL_TEXT,
    });
    expect(openingSegment(CINEMATIC.EXPLORE_MODE)).toEqual({
      phase: 'explore', caption: null, title: true, mark: CINEMATIC.FINAL_TEXT,
    });
  });

  test('the published mark is a faithful stand-in for any time in the beat', () => {
    // The overlay consumes the quantized mark, not the raw clock. Segment of the
    // mark must match segment of every t that produces that mark — otherwise
    // title visibility would be a coincidence of the overlay's second comparison.
    for (let t = 0; t <= CINEMATIC.EXPLORE_MODE + 1; t += 0.25) {
      const live = openingSegment(t);
      const fromMark = openingSegment(live.mark);
      expect(fromMark.caption).toBe(live.caption);
      expect(fromMark.title).toBe(live.title);
      expect(fromMark.mark).toBe(live.mark);
      // Phase is the one field that can still move after the last mark: 12.5–15s
      // share FINAL_TEXT, then explore begins. Caption and title stay put.
      if (live.phase !== 'explore') {
        expect(fromMark.phase).toBe(live.phase);
      }
    }
  });
});

test.describe('dev override shape', () => {
  test('cinematicTimeScale defaults to 1 outside the dev override', () => {
    // No window and no query params under the node runner: the override drops out.
    expect(cinematicTimeScale()).toBe(1);
  });
});
