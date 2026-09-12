import { test, expect } from '@playwright/test';
import {
  MIRA_MAXIMUM_EPOCH_MS,
  MIRA_PERIOD_DAYS,
  MIRA_RISE_DAYS,
  skyStateAt,
} from '../../src/lib/starClock';
import type { SkyState } from '../../src/lib/starClock';

const DAY_MS = 86_400_000;

// The curve leaves maximum light and falls for the rest of the cycle, so the dimmest moment
// sits one rise-length before the anchor comes round again.
const MINIMUM_EPOCH_MS = MIRA_MAXIMUM_EPOCH_MS + (MIRA_PERIOD_DAYS - MIRA_RISE_DAYS) * DAY_MS;

function sampleFrom(fromMs: number, toMs: number, stepDays: number): SkyState[] {
  const step = stepDays * DAY_MS;
  const states: SkyState[] = [];
  for (let ms = fromMs; ms <= toMs; ms += step) {
    states.push(skyStateAt(new Date(ms)));
  }
  return states;
}

function fractional(x: number): number {
  return ((x % 1) + 1) % 1;
}

test.describe('star clock', () => {
  test('anchors the epoch exactly at maximum light', () => {
    const state = skyStateAt(new Date(MIRA_MAXIMUM_EPOCH_MS));

    expect(state.pulsationPhase).toBe(0);
    expect(state.brightness).toBe(1);
    expect(state.colorShift).toBe(1);
    expect(state.daysToMaximum).toBe(MIRA_PERIOD_DAYS);
  });

  test('is brightest at maximum and dimmest at minimum', () => {
    const maximum = skyStateAt(new Date(MIRA_MAXIMUM_EPOCH_MS));
    const minimum = skyStateAt(new Date(MINIMUM_EPOCH_MS));

    expect(maximum.brightness).toBeGreaterThan(minimum.brightness);
    expect(minimum.brightness).toBeCloseTo(0, 10);

    // Nothing in a sampled cycle escapes the two extremes.
    const cycle = sampleFrom(MIRA_MAXIMUM_EPOCH_MS, MIRA_MAXIMUM_EPOCH_MS + MIRA_PERIOD_DAYS * DAY_MS, 2);
    expect(Math.max(...cycle.map((s) => s.brightness))).toBe(1);
    expect(Math.min(...cycle.map((s) => s.brightness))).toBeLessThan(0.001);
  });

  test('takes about the documented 100 days to rise from minimum back to maximum', () => {
    // The asymmetry the curve encodes: a ~100 day climb against a ~232 day fall.
    expect(skyStateAt(new Date(MINIMUM_EPOCH_MS)).daysToMaximum).toBeCloseTo(MIRA_RISE_DAYS, 3);
  });

  test('advances the pulsation phase monotonically with time', () => {
    const stepDays = 0.25;
    const states = sampleFrom(
      MIRA_MAXIMUM_EPOCH_MS - 365 * DAY_MS,
      MIRA_MAXIMUM_EPOCH_MS + 365 * DAY_MS,
      stepDays,
    );
    const expectedAdvance = stepDays / MIRA_PERIOD_DAYS;

    for (let i = 1; i < states.length; i++) {
      // Unwrapped, so the 1→0 wrap is the only step that is not the same advance as the rest.
      const advance = fractional(states[i].pulsationPhase - states[i - 1].pulsationPhase);
      expect(advance).toBeCloseTo(expectedAdvance, 6);
    }
  });

  test('stays continuous and in range across period boundaries', () => {
    // Two years either side of the anchor: the cycle wraps twice, so a seam would show.
    const states = sampleFrom(
      MIRA_MAXIMUM_EPOCH_MS - 400 * DAY_MS,
      MIRA_MAXIMUM_EPOCH_MS + 400 * DAY_MS,
      1,
    );

    for (const state of states) {
      expect(state.brightness).toBeGreaterThanOrEqual(0);
      expect(state.brightness).toBeLessThanOrEqual(1);
    }

    // The steepest stretch is the ~100 day rise, which moves brightness by pi/200 per day.
    // A seam would move it by an order of magnitude more.
    const maxDailySwing = 0.02;
    for (let i = 1; i < states.length; i++) {
      const swing = Math.abs(states[i].brightness - states[i - 1].brightness);
      expect(swing).toBeLessThan(maxDailySwing);
    }
  });

  test('advances the slow orbital phase monotonically without leaving its range', () => {
    const states = sampleFrom(
      MIRA_MAXIMUM_EPOCH_MS - 365 * DAY_MS,
      MIRA_MAXIMUM_EPOCH_MS + 365 * DAY_MS,
      30,
    );

    for (let i = 1; i < states.length; i++) {
      const advance = fractional(states[i].orbitalPhase - states[i - 1].orbitalPhase);
      // Slow enough that two years of clock moves it by well under a tenth of the orbit.
      expect(advance).toBeGreaterThan(0);
      expect(advance).toBeLessThan(0.1);
    }
  });
});
