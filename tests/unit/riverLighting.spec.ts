import { test, expect } from '@playwright/test';
import {
  RIVER_SHADOW_FLOOR,
  MIRA_A_REACH,
  MIRA_B_REACH,
  MIRA_B_GAIN,
  starLightFalloff,
  riverLight,
  riverBrightness,
  skyRiverGain,
  goldAccentStrength,
  veilLayerWeight,
  tailBaseOpacity,
} from '../../src/lib/riverLighting';

test.describe('star light falloff', () => {
  test('is brightest at the star and decays monotonically to zero', () => {
    expect(starLightFalloff(0, MIRA_A_REACH)).toBe(1);
    expect(starLightFalloff(MIRA_A_REACH, MIRA_A_REACH)).toBeCloseTo(0.5, 10);

    let previous = 1;
    for (let d = 0.5; d <= 60; d += 0.5) {
      const light = starLightFalloff(d, MIRA_A_REACH);
      expect(light).toBeLessThan(previous);
      expect(light).toBeGreaterThan(0);
      previous = light;
    }
  });

  test('never cuts off sharply, so lit river cannot end in a visible seam', () => {
    // A hard cutoff would show as a ring where the light stops; a smooth falloff keeps the
    // per-step change small even far out where the values are tiny.
    for (let d = 1; d <= 40; d += 1) {
      const step = Math.abs(starLightFalloff(d, MIRA_A_REACH) - starLightFalloff(d - 0.05, MIRA_A_REACH));
      expect(step).toBeLessThan(0.02);
    }
  });

  test('is stable for degenerate input', () => {
    expect(starLightFalloff(0, 0)).toBe(0);
    expect(starLightFalloff(-3, MIRA_A_REACH)).toBe(starLightFalloff(3, MIRA_A_REACH));
  });
});

test.describe('river light from the pair', () => {
  test('Mira A dominates the inner river, Mira B adds a local pool of light', () => {
    // At the primary the river is fully lit; far down the tail it is not.
    expect(riverLight(0, 10)).toBeGreaterThan(0.9);
    expect(riverLight(30, 40)).toBeLessThan(0.15);

    // Right at the companion its contribution lifts the local light above what the
    // primary alone would give at that distance.
    const dA = 6;
    const withoutB = starLightFalloff(dA, MIRA_A_REACH);
    expect(riverLight(dA, 0)).toBeGreaterThan(withoutB);
    expect(riverLight(dA, 0)).toBeLessThanOrEqual(1);
  });

  test('stays inside 0..1 even when both stars shine on the same point', () => {
    expect(riverLight(0, 0)).toBeLessThanOrEqual(1);
    expect(riverLight(0, 0)).toBe(1);
    expect(MIRA_B_GAIN).toBeGreaterThan(0);
    expect(MIRA_B_REACH).toBeLessThan(MIRA_A_REACH);
  });
});

test.describe('river brightness keeps structure in shadow', () => {
  test('never drops to black and never exceeds full light', () => {
    expect(riverBrightness(0)).toBeCloseTo(RIVER_SHADOW_FLOOR, 10);
    expect(riverBrightness(1)).toBe(1);
    expect(RIVER_SHADOW_FLOOR).toBeGreaterThanOrEqual(0.15);
    expect(RIVER_SHADOW_FLOOR).toBeLessThanOrEqual(0.4);
  });

  test('climbs monotonically with the light', () => {
    let previous = riverBrightness(0);
    for (let light = 0.05; light <= 1; light += 0.05) {
      const value = riverBrightness(light);
      expect(value).toBeGreaterThan(previous);
      expect(value).toBeLessThanOrEqual(1);
      previous = value;
    }
  });
});

test.describe('sky coupling', () => {
  test('dimmest sky dims the river and shifts it warm, brightest sky lifts and cools it', () => {
    const dim = skyRiverGain(0, 0);
    const bright = skyRiverGain(1, 1);

    expect(dim.gain).toBeLessThan(bright.gain);
    expect(dim.warmth).toBeGreaterThan(bright.warmth);
    // Subtle by design: the sky bends the river, it does not switch it off.
    expect(dim.gain).toBeGreaterThan(0.6);
    expect(bright.gain).toBeLessThanOrEqual(1.05);
    expect(bright.warmth).toBeLessThan(0.2);
  });

  test('is monotonic in both channels across the cycle', () => {
    let previous = skyRiverGain(0, 0);
    for (let b = 0.05; b <= 1; b += 0.05) {
      const current = skyRiverGain(b, b);
      expect(current.gain).toBeGreaterThanOrEqual(previous.gain);
      expect(current.warmth).toBeLessThanOrEqual(previous.warmth);
      previous = current;
    }
  });
});

test.describe('gold accent stays local', () => {
  test('is zero in shadow and peaks only in the primary’s full light', () => {
    expect(goldAccentStrength(0)).toBe(0);
    expect(goldAccentStrength(0.3)).toBeLessThan(0.05);
    expect(goldAccentStrength(1)).toBeLessThanOrEqual(0.6);
    expect(goldAccentStrength(1)).toBeGreaterThan(0.3);
  });
});

test.describe('veil layer weights', () => {
  test('centre layers carry the body, edge layers soften the silhouette', () => {
    for (const count of [3, 4, 7]) {
      const weights = Array.from({ length: count }, (_, i) => veilLayerWeight(i, count, false));
      expect(Math.max(...weights)).toBeGreaterThan(weights[0]);
      expect(Math.max(...weights)).toBeGreaterThan(weights[count - 1]);
      for (const w of weights) expect(w).toBeGreaterThan(0);
    }
    // Two layers split the body evenly — there is no centre to favour.
    expect(veilLayerWeight(0, 2, false)).toBe(veilLayerWeight(1, 2, false));
  });

  test('accent layers sit below the volume body so the gold stays a trace', () => {
    for (const count of [3, 5, 9]) {
      const accent = veilLayerWeight(count - 1, count, true);
      const strongestVolume = Math.max(
        ...Array.from({ length: count }, (_, i) => veilLayerWeight(i, count, false)),
      );
      expect(accent).toBeLessThan(strongestVolume);
      expect(accent).toBeGreaterThan(0);
    }
  });

  test('a single layer neither blows up nor vanishes', () => {
    expect(veilLayerWeight(0, 1, false)).toBeGreaterThan(0);
    expect(Number.isFinite(veilLayerWeight(0, 1, false))).toBe(true);
  });
});

test.describe('tail base opacity', () => {
  test('the procedural fallback stays visibly brighter than the textured path', () => {
    // The fallback (no density image) must keep the river visibly non-empty on its own.
    expect(tailBaseOpacity(false, 10000)).toBeGreaterThan(tailBaseOpacity(true, 10000) * 3);
    expect(tailBaseOpacity(false, 300)).toBeGreaterThan(0.4);
  });

  test('each point does more work as lighter tiers shrink the count, up to a cap', () => {
    for (const ready of [true, false]) {
      let previous = 0;
      for (const count of [10000, 3000, 300]) {
        const opacity = tailBaseOpacity(ready, count);
        expect(opacity).toBeGreaterThanOrEqual(previous);
        expect(opacity).toBeLessThanOrEqual(0.6);
        previous = opacity;
      }
    }
  });
});
