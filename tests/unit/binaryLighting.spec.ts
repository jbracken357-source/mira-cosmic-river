// Binary lighting: the calibration math behind issue #25 — Mira A's surface detail,
// the soft highlight shoulder, Mira B's broken accretion arcs, and the clumpy inflow
// that stays connected to both stars. The shaders mirror these in GLSL; the parity
// guard in shaderParity.spec.ts keeps the two sides in step.
import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { COLORS } from '../../src/constants/colors';
import { PHYSICS } from '../../src/constants/physics';
import {
  SURFACE_DETAIL_FLOOR,
  surfaceDetailStrength,
  PULSE_LIGHT_SWING,
  pulsationSurfaceLight,
  PULSE_CELL_LIFT_DIM,
  PULSE_CELL_LIFT_BRIGHT,
  pulsationCellLift,
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

// The linear working-space channels of a palette colour, the same value a uniform
// carries into the shader.
function rgb(hex: string): [number, number, number] {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

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

test.describe("Mira A's breathing photosphere (#87)", () => {
  test('the surface light swings with the pulsation phase, within bounds', () => {
    expect(pulsationSurfaceLight(0)).toBeCloseTo(1 - PULSE_LIGHT_SWING, 10);
    expect(pulsationSurfaceLight(Math.PI)).toBeCloseTo(1 + PULSE_LIGHT_SWING, 10);
    // Readable in the opening close-up, but the star never goes out at the dim end
    // nor lifts the whole disc into a flat bright shell at the bright end.
    expect(PULSE_LIGHT_SWING).toBeGreaterThanOrEqual(0.15);
    expect(PULSE_LIGHT_SWING).toBeLessThanOrEqual(0.3);
  });

  test('the two half-turns of a cycle produce distinguishable light', () => {
    const dim = pulsationSurfaceLight(0);
    const bright = pulsationSurfaceLight(Math.PI);
    expect(bright).toBeGreaterThan(dim * 1.35);
  });

  test('a parked clock sits at the mid light, so a frozen frame is the settled star', () => {
    // The shader runs this curve at theta = uTime * rate + pi/2; reduced motion holds
    // uTime at 0 and capture parks it at 8s — both land within a hair of mid-phase.
    expect(pulsationSurfaceLight(Math.PI / 2)).toBeCloseTo(1, 10);
    expect(pulsationCellLift(Math.PI / 2)).toBeCloseTo((PULSE_CELL_LIFT_DIM + PULSE_CELL_LIFT_BRIGHT) / 2, 10);
  });

  test('the hot network sinks toward the ember floor at minimum and lifts at maximum', () => {
    expect(pulsationCellLift(0)).toBeCloseTo(PULSE_CELL_LIFT_DIM, 10);
    expect(pulsationCellLift(Math.PI)).toBeCloseTo(PULSE_CELL_LIFT_BRIGHT, 10);
    // The cells never vanish at the dim end, and never flood the disc at the bright end.
    expect(PULSE_CELL_LIFT_DIM).toBeGreaterThan(0.2);
    expect(PULSE_CELL_LIFT_BRIGHT).toBeLessThan(0.75);
    let previous = pulsationCellLift(0);
    for (let theta = 0.1; theta <= Math.PI; theta += 0.1) {
      const lift = pulsationCellLift(theta);
      expect(lift).toBeGreaterThan(previous);
      previous = lift;
    }
  });

  // The brightest texel the photosphere can show, evaluated the way the fragment
  // shader computes it: densest cell (heat 1), disc centre (mu 1), full detail
  // strength, the real clock at maximum (uBrightness = uColorShift = 1).
  function giantHottestTexel(phaseAngle: number): [number, number, number] {
    const surface = rgb(COLORS.MIRA_A_SURFACE);
    // heat 1 picks the amber end of the ember→amber mix, so the ember floor and
    // uColorCore do not enter this texel.
    const amber = surface.map((s, i) => s + ([1, 0.38, 0.065][i] - s) * 0.65);
    const lift = pulsationCellLift(phaseAngle);
    let color = amber.map((a, i) => a + [1.2, 0.58, 0.16][i] * lift);
    const light = pulsationSurfaceLight(phaseAngle) * (0.68 + 0.55 * 1);
    color = color.map((c) => c * light);
    color = color.map((c, i) => c * [1, 1, 0.94][i]);
    return color.map(highlightShoulder) as [number, number, number];
  }

  test('the hottest texel keeps its hue at both ends of the cycle — no dead white', () => {
    for (const theta of [0, Math.PI / 2, Math.PI]) {
      const [r, g, b] = giantHottestTexel(theta);
      expect(r).toBeLessThanOrEqual(HIGHLIGHT_CEILING);
      // Dead white is every channel driven to clip together. The giant's hottest
      // possible texel stays red-dominant with the blue channel held far down.
      expect(b).toBeLessThan(r * 0.5);
      expect(r - g).toBeGreaterThan(0.1);
    }
    // And the bright end really is brighter than the dim end on the same texel.
    const dim = giantHottestTexel(0);
    const bright = giantHottestTexel(Math.PI);
    expect(bright[0]).toBeGreaterThan(dim[0]);
  });
});

test.describe('the two star bodies keep their scale and their own light (#87)', () => {
  test('the companion stays far smaller than the giant', () => {
    expect(PHYSICS.MIRA_B.radius).toBeLessThanOrEqual(PHYSICS.MIRA_A.radius * 0.15);
  });

  // The companion's centre texel, the way MiraB.tsx's inline fragment shader computes
  // it at a parked clock (pulse sine 0): body colour, the core lamp as it lands on the
  // surface (length(vPosition) is the body radius), no fresnel at the disc centre,
  // blue tint, grain at its darkest and brightest.
  function companionCentreTexel(grain: number): [number, number, number] {
    const body = rgb(COLORS.MIRA_B_CORE);
    const coreBright = Math.pow(Math.max(1 - PHYSICS.MIRA_B.radius * 2, 0), 3);
    let color = body.map((c) => c * 0.8 * 0.98 + coreBright * 0.16);
    color = color.map((c, i) => c * 0.85 + [0.7, 0.85, 1.0][i] * 0.15);
    color = color.map((c) => c * grain);
    return color.map(highlightShoulder) as [number, number, number];
  }

  // The giant's parked mid-light surface (no hot-cell lift, no real-clock gain):
  // even this most ordinary texel stays red-dominant.
  function giantParkedTexel(): [number, number, number] {
    const surface = rgb(COLORS.MIRA_A_SURFACE);
    const amber = surface.map((s, i) => s + ([1, 0.38, 0.065][i] - s) * 0.65);
    return amber.map(highlightShoulder) as [number, number, number];
  }

  test('a frozen frame still tells the two stars apart by hue', () => {
    // The giant's photosphere is red-dominant even at its hottest; the companion is
    // blue-dominant across its whole grain range. Opposite hue order is what keeps
    // the two bodies readable in a stopped frame under reduced motion.
    for (const grain of [1 - 0.46, 1, 1 + 0.46]) {
      const [r, , b] = companionCentreTexel(grain);
      expect(b).toBeGreaterThan(r);
    }
    const [ar, , ab] = giantParkedTexel();
    expect(ab).toBeLessThan(ar);
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
