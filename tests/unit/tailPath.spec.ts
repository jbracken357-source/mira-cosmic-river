import { test, expect } from '@playwright/test';
import { PHYSICS } from '../../src/constants/physics';
import {
  boxContains,
  boxFromCenterSize,
  TAIL_OCCUPANCY,
  tailCenterline,
  tailClickVolume,
  tailGenerationBounds,
  tailHeading,
  tailOccupancy,
  tailSpread,
  tailWorldBounds,
  yawY,
} from '../../src/lib/tailPath';

const LENGTH = PHYSICS.TAIL.length;

test.describe('tail path', () => {
  test('the centerline starts at the origin and streams behind Mira A', () => {
    const origin = tailCenterline(0, LENGTH);
    expect(origin[0]).toBeCloseTo(0);
    expect(origin[1]).toBeCloseTo(0);
    expect(origin[2]).toBeCloseTo(0);
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
