import { test, expect } from '@playwright/test';
import {
  RIVER_SHADOW_FLOOR,
  MIRA_A_REACH,
  MIRA_B_REACH,
  MIRA_B_GAIN,
  starLightFalloff,
  riverLight,
  riverBrightness,
  veilLightResponse,
  skyRiverGain,
  dailySkyCoupling,
  DAILY_DENSITY_AMPLITUDE,
  goldAccentStrength,
  veilLayerWeight,
  tailBaseOpacity,
} from '../../src/lib/riverLighting';
import {
  MIRA_MAXIMUM_EPOCH_MS,
  MIRA_PERIOD_DAYS,
  MIRA_RISE_DAYS,
  skyStateAt,
} from '../../src/lib/starClock';

const DAY_MS = 86_400_000;
// Representative dates: the epoch anchors a documented maximum; the minimum follows the
// decline fraction of the same cycle (the two half-cosines of the star clock).
const MAXIMUM_DATE = new Date(MIRA_MAXIMUM_EPOCH_MS);
const MINIMUM_DATE = new Date(MIRA_MAXIMUM_EPOCH_MS + (MIRA_PERIOD_DAYS - MIRA_RISE_DAYS) * DAY_MS);

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

test.describe('veil light response', () => {
  test('shadow keeps most of the body and full light lifts it', () => {
    // The veil is alpha-blended over near-black space: a crushing shadow curve would void it.
    expect(veilLightResponse(0)).toBeGreaterThanOrEqual(0.7);
    expect(veilLightResponse(1)).toBeGreaterThan(1);
    expect(veilLightResponse(1)).toBeLessThanOrEqual(1.5);
  });

  test('climbs monotonically with the light', () => {
    let previous = veilLightResponse(0);
    for (let light = 0.05; light <= 1; light += 0.05) {
      const value = veilLightResponse(light);
      expect(value).toBeGreaterThan(previous);
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

test.describe('daily sky coupling', () => {
  test('the same date couples to the same river, value for value', () => {
    // Determinism is the ticket's first promise: one deterministic clock in, one
    // deterministic coupling out — no wall-clock reads inside the function.
    const date = new Date(Date.UTC(2026, 8, 12));
    const a = dailySkyCoupling(skyStateAt(date));
    const b = dailySkyCoupling(skyStateAt(new Date(date.getTime())));
    expect(b).toEqual(a);
  });

  test('a faint Mira lets the river settle denser; a bright one spreads it thinner', () => {
    const atMaximum = dailySkyCoupling(skyStateAt(MAXIMUM_DATE));
    const atMinimum = dailySkyCoupling(skyStateAt(MINIMUM_DATE));

    expect(atMinimum.density).toBeGreaterThan(atMaximum.density);
    expect(atMinimum.warmth).toBeGreaterThan(atMaximum.warmth);

    // Colour and luminosity meet at both extremes of the cycle, so the lift is zero
    // there; mid-cycle the colour runs ahead of the light and the lift peaks.
    expect(atMaximum.brightnessLift).toBeCloseTo(0, 10);
    expect(atMinimum.brightnessLift).toBeCloseTo(0, 10);
    const midDecline = dailySkyCoupling(
      skyStateAt(new Date(MIRA_MAXIMUM_EPOCH_MS + (MIRA_PERIOD_DAYS / 2) * DAY_MS)),
    );
    expect(midDecline.brightnessLift).toBeGreaterThan(0.004);
  });

  test('stays within its bounds across the whole cycle, so the tail never empties', () => {
    for (let day = 0; day < MIRA_PERIOD_DAYS; day += 3) {
      const sky = skyStateAt(new Date(MIRA_MAXIMUM_EPOCH_MS + day * DAY_MS));
      const coupling = dailySkyCoupling(sky);
      // The amplitude is centred on 1, so brightness 0..1 swings density exactly ±amplitude/2.
      expect(coupling.density).toBeGreaterThanOrEqual(1 - DAILY_DENSITY_AMPLITUDE / 2);
      expect(coupling.density).toBeLessThanOrEqual(1 + DAILY_DENSITY_AMPLITUDE / 2);
      expect(coupling.brightnessLift).toBeGreaterThanOrEqual(0);
      expect(coupling.brightnessLift).toBeLessThanOrEqual(0.01);
      expect(coupling.warmth).toBeGreaterThanOrEqual(0);
      expect(coupling.warmth).toBeLessThanOrEqual(0.25);
      // Stacked on the dimmest night the lift never lifts the river past a few percent,
      // and the gain floor from the plain coupling still holds — the seam composes the
      // gain once, so this is the same number the component writes to the uniform.
      expect(coupling.gain).toBeGreaterThanOrEqual(0.8);
      expect(coupling.gain).toBeLessThanOrEqual(1.04);
    }
  });

  test('keeps the baseline epoch at the calibration the visual direction was tuned on', () => {
    // The 2026-09-12 capture epoch pins every committed baseline; the coupling's effect
    // there must stay a small modulation, never a re-tuning.
    const baseline = dailySkyCoupling(skyStateAt(new Date(Date.UTC(2026, 8, 12))));
    expect(Math.abs(baseline.density - 1)).toBeLessThan(0.03);
    expect(baseline.brightnessLift).toBeLessThan(0.01);
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

  test('the daily density scales both texture and fallback paths without emptying either', () => {
    for (const ready of [true, false]) {
      const neutral = tailBaseOpacity(ready, 10000);
      // A missing density argument is the neutral night: old callers keep their numbers.
      expect(tailBaseOpacity(ready, 10000, 1)).toBe(neutral);
      expect(tailBaseOpacity(ready, 10000, 0.96)).toBeCloseTo(neutral * 0.96, 10);
      expect(tailBaseOpacity(ready, 10000, 1.04)).toBeCloseTo(neutral * 1.04, 10);
    }
  });
});
