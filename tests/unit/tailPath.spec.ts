import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { CAMERA, PHYSICS, calculateOrbitalPosition } from '../../src/constants';
import {
  boxContains,
  boxFromCenterSize,
  TAIL_OCCUPANCY,
  TAIL_ROOT,
  TAIL_ROOT_FADE,
  TAIL_ROOT_SPREAD,
  tailCenterline,
  tailClickVolume,
  tailFarEnd,
  tailGenerationBounds,
  tailHeading,
  tailOccupancy,
  tailRootBend,
  tailSpread,
  tailWorldBounds,
  veilRibbon,
  yawY,
} from '../../src/lib/tailPath';

const LENGTH = PHYSICS.TAIL.length;

test.describe('tail path', () => {
  test('the centerline springs from the root (根) between the pair, then streams behind them (#91)', () => {
    const origin = tailCenterline(0, LENGTH);
    // The root is the pair's home midpoint — between the two home positions on the
    // A→B axis, not the giant's centre.
    const home = calculateOrbitalPosition(0, PHYSICS.ORBIT);
    const axis = [
      home.companion[0] - home.primary[0],
      home.companion[1] - home.primary[1],
      home.companion[2] - home.primary[2],
    ];
    const fromA = [origin[0] - home.primary[0], origin[1] - home.primary[1], origin[2] - home.primary[2]];
    const axisLen2 = axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2;
    const along = (fromA[0] * axis[0] + fromA[1] * axis[1] + fromA[2] * axis[2]) / axisLen2;
    expect(along).toBeGreaterThan(0.25);
    expect(along).toBeLessThan(0.75);
    // Off the giant's centre, but well inside the gap — not parked on the companion.
    const distFromA = Math.hypot(fromA[0], fromA[1], fromA[2]);
    expect(distFromA).toBeGreaterThan(PHYSICS.MIRA_A.radius * 0.5);
    expect(distFromA).toBeLessThan(PHYSICS.ORBIT.semiMajorAxis);
    // The far wake keeps its legacy bearing.
    const far = tailCenterline(1, LENGTH);
    expect(far[0]).toBeLessThan(0);
    expect(far[2]).toBeGreaterThan(0);
    expect(tailSpread(1)).toBeGreaterThan(tailSpread(0));
  });

  test('the click volume covers the existing calibrated target', () => {
    const click = boxFromCenterSize(tailClickVolume());
    const legacy = boxFromCenterSize({ position: [-8, 2, 6], size: [12, 8, 2] });
    expect(boxContains(click, legacy)).toBe(true);
  });

  test('the camera-facing wake sits inside the click volume', () => {
    const click = boxFromCenterSize(tailClickVolume());
    for (let t = 0.3; t <= 0.4; t += 0.02) {
      const [x, y, z] = yawY(tailCenterline(t, LENGTH));
      expect(x).toBeGreaterThanOrEqual(click.min[0]);
      expect(x).toBeLessThanOrEqual(click.max[0]);
      expect(y).toBeGreaterThanOrEqual(click.min[1]);
      expect(y).toBeLessThanOrEqual(click.max[1]);
      expect(z).toBeGreaterThanOrEqual(click.min[2]);
      expect(z).toBeLessThanOrEqual(click.max[2]);
    }
  });

  test('the generation envelope is the yaw of the local cone', () => {
    const local = tailGenerationBounds(LENGTH);
    const world = tailWorldBounds(LENGTH);
    const corner = yawY(local.min);
    expect(world.min[0]).toBeLessThanOrEqual(corner[0] + 1e-9);
    expect(world.max[0]).toBeGreaterThanOrEqual(corner[0] - 1e-9);
  });

  test('occupancy hands Scene the yaw, click, and haze from one place', () => {
    expect(TAIL_OCCUPANCY.yaw).toBe(Math.PI * 0.12);
    expect(TAIL_OCCUPANCY.haze).toEqual({ position: [-6, 1, 4], radius: 5 });
    expect(TAIL_OCCUPANCY.click).toBe(tailClickVolume());
    const occupancy = tailOccupancy(LENGTH);
    expect(occupancy.click).toBe(TAIL_OCCUPANCY.click);
    expect(occupancy.generation).toEqual(tailWorldBounds(LENGTH));
  });
});

test.describe('the heading (去向)', () => {
  test('is the wake read backwards: unit length, colinear, opposed', () => {
    const heading = tailHeading(LENGTH);
    expect(Math.hypot(...heading)).toBeCloseTo(1, 9);

    // The tail is what the pair leaves behind, so the heading opposes the far end
    // of the same centerline — the tail itself is not redone (#86).
    const far = yawY(tailCenterline(1, LENGTH));
    const dot = heading[0] * far[0] + heading[1] * far[1] + heading[2] * far[2];
    expect(dot).toBeLessThan(0);
    const cross = Math.hypot(
      heading[1] * far[2] - heading[2] * far[1],
      heading[2] * far[0] - heading[0] * far[2],
      heading[0] * far[1] - heading[1] * far[0],
    );
    expect(cross).toBeCloseTo(0, 9);
  });

  test('is derived from the path, not hardcoded: a different tail bends it', () => {
    // The centerline's rise does not scale with its length, so a shorter tail
    // points its far end elsewhere — the heading must follow.
    const short = tailHeading(LENGTH / 2);
    const along = tailHeading(LENGTH);
    expect(Math.hypot(...short)).toBeCloseTo(1, 9);
    const apart = Math.hypot(short[0] - along[0], short[1] - along[1], short[2] - along[2]);
    expect(apart).toBeGreaterThan(0.01);
  });
});

test.describe('the root bend (#91)', () => {
  test('the root is the pair\'s home midpoint, derived from the orbit', () => {
    const home = calculateOrbitalPosition(0, PHYSICS.ORBIT);
    for (let i = 0; i < 3; i += 1) {
      expect(TAIL_ROOT[i]).toBeCloseTo((home.primary[i] + home.companion[i]) / 2, 9);
    }
  });

  test('the bend starts at the root and is gone by the fade, leaving the far wake untouched', () => {
    expect(tailRootBend(0)).toEqual(TAIL_ROOT);
    expect(tailRootBend(TAIL_ROOT_FADE)).toEqual([0, 0, 0]);
    expect(tailRootBend(1)).toEqual([0, 0, 0]);
    // Monotone falloff: the bend never grows back down-tail.
    let previous = Math.hypot(...tailRootBend(0));
    for (let t = 0.01; t <= TAIL_ROOT_FADE; t += 0.01) {
      const mag = Math.hypot(...tailRootBend(t));
      expect(mag).toBeLessThanOrEqual(previous + 1e-12);
      previous = mag;
    }
    // The far end of the centerline is exactly the legacy wake.
    const far = tailCenterline(1, LENGTH);
    expect(far[0]).toBeCloseTo(-LENGTH * 0.6, 9);
    expect(far[1]).toBeCloseTo(Math.sin(Math.PI * 0.8) * 2.0, 9);
    expect(far[2]).toBeCloseTo(LENGTH * 0.5, 9);
  });

  test('near gas: the root cone wraps the pair\'s region, then the legacy cone resumes', () => {
    // Wider at the root than the old pin-thin start, so mist surrounds the pair;
    // past the fade the spread is the legacy cone, so the far composition is untouched.
    expect(tailSpread(0)).toBeCloseTo(0.3 + TAIL_ROOT_SPREAD, 9);
    expect(TAIL_ROOT_SPREAD).toBeGreaterThanOrEqual(0.6);
    expect(tailSpread(TAIL_ROOT_FADE)).toBeCloseTo(0.3 + TAIL_ROOT_FADE * 3.0, 9);
    expect(tailSpread(1)).toBeCloseTo(3.3, 9);
  });

  test('the veil ribbons spring from the same root', () => {
    for (let i = 0; i < 5; i += 1) {
      const { position } = veilRibbon(0, LENGTH, i, 5);
      expect(position[0]).toBeCloseTo(TAIL_ROOT[0], 9);
      expect(position[1]).toBeCloseTo(TAIL_ROOT[1], 9);
      expect(position[2]).toBeCloseTo(TAIL_ROOT[2], 9);
    }
  });
});

test.describe('the explore framing reads the pair, the gap (空隙), and the road (#91)', () => {
  // The explore camera at 1440x900, the frame the pair is calibrated against.
  const WIDTH = 1440;
  const HEIGHT = 900;
  const camera = new THREE.PerspectiveCamera(CAMERA.EXPLORE.fov, WIDTH / HEIGHT, 0.1, 200);
  camera.position.set(...CAMERA.EXPLORE.position);
  camera.lookAt(...CAMERA.EXPLORE.lookAt);
  camera.updateMatrixWorld();

  const projectPx = (p: readonly number[]): [number, number] => {
    const v = new THREE.Vector3(p[0], p[1], p[2]).project(camera);
    return [((v.x + 1) / 2) * WIDTH, ((1 - v.y) / 2) * HEIGHT];
  };
  const apparentRadiusPx = (center: readonly number[], radius: number): number => {
    const d = camera.position.distanceTo(new THREE.Vector3(center[0], center[1], center[2]));
    return (Math.atan(radius / d) / ((camera.fov * Math.PI) / 180)) * HEIGHT;
  };
  const surfaceGapPx = (time: number): number => {
    const { primary, companion } = calculateOrbitalPosition(time, PHYSICS.ORBIT);
    const a = projectPx(primary);
    const b = projectPx(companion);
    const sep = Math.hypot(a[0] - b[0], a[1] - b[1]);
    return sep - apparentRadiusPx(primary, PHYSICS.MIRA_A.radius) - apparentRadiusPx(companion, PHYSICS.MIRA_B.radius);
  };
  const ORBIT_ROUND = (2 * Math.PI) / PHYSICS.ORBIT.period;

  test('at the home phase the gap between the two stars reads clearly', () => {
    // Comfortably more than a hairline: the white dwarf never had to grow for this.
    expect(surfaceGapPx(0)).toBeGreaterThan(12);
  });

  test('the gap stays positive through most of the orbit', () => {
    // The companion briefly transits the giant\'s disc near conjunction — that is an
    // occultation, not a merger — but the common case keeps clear space between them.
    let clear = 0;
    const samples = 128;
    for (let i = 0; i < samples; i += 1) {
      if (surfaceGapPx((i / samples) * ORBIT_ROUND) > 0) clear += 1;
    }
    expect(clear / samples).toBeGreaterThan(0.5);
  });

  test('the far view holds the pair and the road\'s full length in one frame', () => {
    const home = calculateOrbitalPosition(0, PHYSICS.ORBIT);
    const margin = 40; // px of breathing room inside the frame edges
    for (const point of [home.primary, home.companion, tailFarEnd(LENGTH)]) {
      const [x, y] = projectPx(point);
      expect(x).toBeGreaterThan(margin);
      expect(x).toBeLessThan(WIDTH - margin);
      expect(y).toBeGreaterThan(margin);
      expect(y).toBeLessThan(HEIGHT - margin);
    }
    // The road's on-screen length: root to far end spans a real share of the frame.
    const [rx, ry] = projectPx(yawY(tailCenterline(0, LENGTH)));
    const [fx, fy] = projectPx(tailFarEnd(LENGTH));
    expect(Math.hypot(fx - rx, fy - ry)).toBeGreaterThan(WIDTH / 4);
  });

  // 前后景差 (#91): the road's far end sits much closer to the explore camera than
  // the pair, so a retreat shrinks the road's on-screen reach faster than the pair's
  // own gap closes — the foreground/background difference a flat backdrop cannot show.
  test('a retreat separates foreground from background: the road sinks faster than the gap', () => {
    const home = calculateOrbitalPosition(0, PHYSICS.ORBIT);
    const target = new THREE.Vector3(...CAMERA.EXPLORE.lookAt);
    // The farthest retreat the explore controls allow (orbit radius → maxDistance 40).
    const dir = new THREE.Vector3(...CAMERA.EXPLORE.position).sub(target).normalize();
    const farCamera = new THREE.PerspectiveCamera(CAMERA.EXPLORE.fov, WIDTH / HEIGHT, 0.1, 200);
    farCamera.position.copy(target).addScaledVector(dir, 40);
    farCamera.lookAt(target);
    farCamera.updateMatrixWorld();
    const projectFar = (p: readonly number[]): [number, number] => {
      const v = new THREE.Vector3(p[0], p[1], p[2]).project(farCamera);
      return [((v.x + 1) / 2) * WIDTH, ((1 - v.y) / 2) * HEIGHT];
    };
    const sepPx = (
      project: (p: readonly number[]) => [number, number],
      p: readonly number[],
      q: readonly number[],
    ) => {
      const a = project(p);
      const b = project(q);
      return Math.hypot(a[0] - b[0], a[1] - b[1]);
    };
    const far = tailFarEnd(LENGTH);
    const roadShrink = sepPx(projectFar, home.primary, far) / sepPx(projectPx, home.primary, far);
    const gapShrink = sepPx(projectFar, home.primary, home.companion) / sepPx(projectPx, home.primary, home.companion);
    expect(roadShrink).toBeLessThan(gapShrink - 0.03);
    // And the anchor the e2e probe reads really is the nearer object.
    const camPos = new THREE.Vector3(...CAMERA.EXPLORE.position);
    const dFar = camPos.distanceTo(new THREE.Vector3(far[0], far[1], far[2]));
    const dPair = camPos.distanceTo(new THREE.Vector3(home.primary[0], home.primary[1], home.primary[2]));
    expect(dFar).toBeLessThan(dPair * 0.9);
  });
});
