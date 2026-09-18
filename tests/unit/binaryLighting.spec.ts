// Binary lighting: the calibration math behind issue #25 — Mira A's surface detail,
// the soft highlight shoulder, Mira B's broken accretion arcs, and the clumpy inflow
// that stays connected to both stars. The shaders mirror these in GLSL; the parity
// guard in shaderParity.spec.ts keeps the two sides in step.
import { test, expect } from '@playwright/test';
import {
  SURFACE_DETAIL_FLOOR,
  surfaceDetailStrength,
  HIGHLIGHT_KNEE,
  HIGHLIGHT_CEILING,
  highlightShoulder,
  wrapAngle,
  gaussFalloff,
  DISK_ARC_TRACE,
  WAKE_ARC_GAIN,
  arcEnvelope,
  ARC_CLUMP_FLOOR,
  arcClump,
  HOT_SPOT_RADIUS,
  hotSpotProfile,
  STREAM_CLUMP_FLOOR,
  streamClump,
} from '../../src/lib/binaryLighting';

test.describe('surface detail strength', () => {
  test('never vanishes and never exceeds full strength', () => {
    for (const region of [0, 0.25, 0.5, 0.75, 1]) {
      for (const limb of [0, 0.3, 0.7, 1]) {
        const strength = surfaceDetailStrength(region, limb);
        expect(strength).toBeGreaterThanOrEqual(SURFACE_DETAIL_FLOOR);
        expect(strength).toBeLessThanOrEqual(1);
      }
    }
    // The floor is low enough that smooth regions read smooth, not uniformly gritty.
    expect(SURFACE_DETAIL_FLOOR).toBeLessThanOrEqual(0.4);
  });

  test('texture concentrates in patches instead of covering the whole surface evenly', () => {
    const smoothRegion = surfaceDetailStrength(0.1, 1);
    const patchyRegion = surfaceDetailStrength(0.9, 1);
    expect(patchyRegion).toBeGreaterThan(smoothRegion * 1.5);
    expect(patchyRegion).toBeGreaterThan(0.8);
  });

  test('detail calms toward the limb', () => {
    const region = 0.9;
    expect(surfaceDetailStrength(region, 0)).toBeLessThan(surfaceDetailStrength(region, 1));
    let previous = surfaceDetailStrength(region, 0);
    for (let limb = 0.1; limb <= 1; limb += 0.1) {
      const strength = surfaceDetailStrength(region, limb);
      expect(strength).toBeGreaterThanOrEqual(previous);
      previous = strength;
    }
  });
});

test.describe('highlight shoulder', () => {
  test('is identity below the knee', () => {
    expect(highlightShoulder(0)).toBe(0);
    expect(highlightShoulder(HIGHLIGHT_KNEE * 0.5)).toBeCloseTo(HIGHLIGHT_KNEE * 0.5, 10);
    expect(highlightShoulder(HIGHLIGHT_KNEE)).toBeCloseTo(HIGHLIGHT_KNEE, 10);
  });

  test('compresses highlights toward the ceiling instead of blowing out to dead white', () => {
    expect(highlightShoulder(2)).toBeLessThan(2);
    expect(highlightShoulder(2)).toBeGreaterThan(HIGHLIGHT_KNEE);
    expect(highlightShoulder(10)).toBeLessThan(HIGHLIGHT_CEILING);
    // The ceiling stays near the display range: hue survives tonemapping instead of clipping.
    expect(HIGHLIGHT_CEILING).toBeLessThanOrEqual(1.5);
  });

  test('is monotonic and continuous across the knee', () => {
    let previous = highlightShoulder(0);
    for (let x = 0.05; x <= 4; x += 0.05) {
      const value = highlightShoulder(x);
      expect(value).toBeGreaterThan(previous);
      expect(Math.abs(value - previous)).toBeLessThan(0.06);
      previous = value;
    }
  });
});

test.describe('angle wrapping and gaussian falloff', () => {
  test('wrapAngle lands in [-pi, pi] and preserves the circle', () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(Math.PI, 10);
    expect(wrapAngle(-Math.PI * 2.5)).toBeCloseTo(-Math.PI / 2, 10);
  });

  test('gaussFalloff peaks at centre and dies smoothly', () => {
    expect(gaussFalloff(0, 1)).toBe(1);
    expect(gaussFalloff(1, 1)).toBeCloseTo(Math.exp(-1), 10);
    expect(gaussFalloff(4, 1)).toBeLessThan(0.001);
    expect(gaussFalloff(1, 0)).toBe(0);
  });
});

test.describe('accretion arc envelope', () => {
  test('is brightest where the inflow lands and never completes a hard ring', () => {
    const impact = 1.1;
    expect(arcEnvelope(impact, impact)).toBeCloseTo(1, 5);
    // Away from the two arcs the ring drops to a faint trace, and even the far side of
    // the wake stays well under the impact's brightness.
    expect(DISK_ARC_TRACE).toBeLessThan(0.1);
    expect(DISK_ARC_TRACE).toBeGreaterThan(0);
    expect(arcEnvelope(impact + Math.PI, impact)).toBeLessThan(0.3);
    expect(arcEnvelope(impact + Math.PI / 2, impact)).toBeLessThan(0.3);
  });

  test('the wake is a second, weaker arc trailing the impact', () => {
    const impact = 0.4;
    const wakeAngle = impact + 2.35;
    const wake = arcEnvelope(wakeAngle, impact);
    expect(wake).toBeGreaterThan(DISK_ARC_TRACE * 3);
    expect(wake).toBeLessThan(0.9);
    expect(WAKE_ARC_GAIN).toBeLessThan(1);
  });

  test('wraps around the circle without a seam', () => {
    const impact = 2.9;
    for (let a = -Math.PI; a < Math.PI; a += 0.05) {
      expect(arcEnvelope(a, impact)).toBeCloseTo(arcEnvelope(a + 2 * Math.PI, impact), 10);
    }
  });
});

test.describe('arc clumping', () => {
  test('stays inside its floor-to-full range', () => {
    for (let a = -Math.PI; a < Math.PI; a += 0.1) {
      const clump = arcClump(a, 8);
      expect(clump).toBeGreaterThanOrEqual(ARC_CLUMP_FLOOR - 1e-9);
      expect(clump).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  test('breaks the arcs into intermittent clumps rather than one smooth band', () => {
    const samples = Array.from({ length: 64 }, (_, i) => arcClump((i / 64) * 2 * Math.PI, 8));
    expect(Math.min(...samples)).toBeLessThan(ARC_CLUMP_FLOOR + 0.15);
    expect(Math.max(...samples)).toBeGreaterThan(0.85);
  });
});

test.describe('hot spot', () => {
  test('peaks at the landing point on its own radius and falls off both ways', () => {
    expect(hotSpotProfile(0, HOT_SPOT_RADIUS)).toBeCloseTo(1, 10);
    expect(hotSpotProfile(0.9, HOT_SPOT_RADIUS)).toBeLessThan(0.05);
    expect(hotSpotProfile(0, HOT_SPOT_RADIUS + 0.8)).toBeLessThan(0.001);
    expect(hotSpotProfile(0, 0)).toBeLessThan(0.05);
  });
});

test.describe('material stream clumping', () => {
  test('both ends stay fully connected to the stars', () => {
    for (const seed of [0, 0.37, 0.91, 3.14]) {
      expect(streamClump(0, seed)).toBeCloseTo(1, 5);
      expect(streamClump(1, seed)).toBeCloseTo(1, 5);
    }
  });

  test('the middle of the stream breaks into clumps with real gaps', () => {
    const samples = Array.from({ length: 200 }, (_, i) => streamClump(0.15 + (i / 200) * 0.6, 0.5));
    expect(Math.min(...samples)).toBeLessThan(STREAM_CLUMP_FLOOR + 0.1);
    expect(Math.max(...samples)).toBeGreaterThan(0.8);
    expect(STREAM_CLUMP_FLOOR).toBeGreaterThan(0);
  });

  test('is deterministic for the same particle and position', () => {
    expect(streamClump(0.42, 7.25)).toBe(streamClump(0.42, 7.25));
    for (let t = 0; t <= 1; t += 0.05) {
      const v = streamClump(t, 2.5);
      expect(v).toBeGreaterThanOrEqual(STREAM_CLUMP_FLOOR - 1e-9);
      expect(v).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});
