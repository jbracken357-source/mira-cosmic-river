import { test, expect } from '@playwright/test';
import {
  MIRA_MAXIMUM_EPOCH_MS,
  MIRA_PERIOD_DAYS,
  MIRA_RISE_DAYS,
  MILESTONE_WINDOW_DAYS,
  skyStateAt,
  daysUntilNextMaximum,
  daysUntilNextMinimum,
  phaseMilestone,
  phaseDirection,
  phaseReadout,
  milestoneStorageKey,
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
    expect(state.cycleIndex).toBe(0);
  });

  test('shifts colour ahead of brightness rather than restating it', () => {
    // Half a rise before maximum: still dim, but already well past the red end.
    const rising = skyStateAt(new Date(MIRA_MAXIMUM_EPOCH_MS - (MIRA_RISE_DAYS * DAY_MS) / 2));

    expect(rising.colorShift).toBeGreaterThan(rising.brightness);
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

  test('spends about 100 days climbing and 232 falling', () => {
    // The asymmetry the curve encodes: minimum sits exactly one rise-length before the anchor
    // comes round again.
    const atMinimum = skyStateAt(new Date(MINIMUM_EPOCH_MS));

    expect(atMinimum.pulsationPhase).toBeCloseTo(
      (MIRA_PERIOD_DAYS - MIRA_RISE_DAYS) / MIRA_PERIOD_DAYS,
      3,
    );
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

test.describe('phase readout', () => {
  test('days until next maximum is ~0 at epoch and ~rise at minimum', () => {
    expect(daysUntilNextMaximum(new Date(MIRA_MAXIMUM_EPOCH_MS))).toBeCloseTo(0, 5);
    expect(daysUntilNextMaximum(new Date(MINIMUM_EPOCH_MS))).toBeCloseTo(MIRA_RISE_DAYS, 5);
    expect(daysUntilNextMaximum(skyStateAt(new Date(MIRA_MAXIMUM_EPOCH_MS)))).toBeCloseTo(0, 5);
  });

  test('days until next minimum is ~0 at the dimmest moment and a decline-length at epoch', () => {
    expect(daysUntilNextMinimum(new Date(MINIMUM_EPOCH_MS))).toBeCloseTo(0, 5);
    expect(daysUntilNextMinimum(new Date(MIRA_MAXIMUM_EPOCH_MS))).toBeCloseTo(
      MIRA_PERIOD_DAYS - MIRA_RISE_DAYS,
      5,
    );
  });

  test('days until next maximum decreases through a cycle and wraps at the following peak', () => {
    const stepDays = 1;
    const from = MIRA_MAXIMUM_EPOCH_MS + DAY_MS;
    const to = MIRA_MAXIMUM_EPOCH_MS + (MIRA_PERIOD_DAYS - 1) * DAY_MS;
    const days: number[] = [];
    for (let ms = from; ms <= to; ms += stepDays * DAY_MS) {
      days.push(daysUntilNextMaximum(new Date(ms)));
    }

    for (let i = 1; i < days.length; i++) {
      expect(days[i]).toBeLessThan(days[i - 1]);
      expect(days[i - 1] - days[i]).toBeCloseTo(stepDays, 5);
    }

    expect(days[0]).toBeCloseTo(MIRA_PERIOD_DAYS - 1, 5);
    expect(daysUntilNextMaximum(new Date(MIRA_MAXIMUM_EPOCH_MS + (MIRA_PERIOD_DAYS - 1) * DAY_MS))).toBeCloseTo(1, 5);

    const nextPeak = MIRA_MAXIMUM_EPOCH_MS + MIRA_PERIOD_DAYS * DAY_MS;
    expect(daysUntilNextMaximum(new Date(nextPeak))).toBeCloseTo(0, 5);
    expect(skyStateAt(new Date(nextPeak)).cycleIndex).toBe(1);
  });

  test('milestone is maximum or minimum only inside the window, otherwise none', () => {
    expect(phaseMilestone(new Date(MIRA_MAXIMUM_EPOCH_MS))).toBe('maximum');
    expect(phaseMilestone(new Date(MIRA_MAXIMUM_EPOCH_MS + 9 * DAY_MS))).toBe('maximum');
    expect(phaseMilestone(new Date(MIRA_MAXIMUM_EPOCH_MS - 9 * DAY_MS))).toBe('maximum');
    expect(phaseMilestone(new Date(MIRA_MAXIMUM_EPOCH_MS + 11 * DAY_MS))).toBe('none');
    expect(phaseMilestone(new Date(MIRA_MAXIMUM_EPOCH_MS - 11 * DAY_MS))).toBe('none');

    expect(phaseMilestone(new Date(MINIMUM_EPOCH_MS))).toBe('minimum');
    expect(phaseMilestone(new Date(MINIMUM_EPOCH_MS + 9 * DAY_MS))).toBe('minimum');
    expect(phaseMilestone(new Date(MINIMUM_EPOCH_MS - 9 * DAY_MS))).toBe('minimum');
    expect(phaseMilestone(new Date(MINIMUM_EPOCH_MS + 11 * DAY_MS))).toBe('none');

    expect(MILESTONE_WINDOW_DAYS).toBe(10);
  });

  test('direction is fading after maximum and brightening after minimum', () => {
    expect(phaseDirection(new Date(MIRA_MAXIMUM_EPOCH_MS))).toBe('fading');
    expect(phaseDirection(new Date(MIRA_MAXIMUM_EPOCH_MS + 20 * DAY_MS))).toBe('fading');
    expect(phaseDirection(new Date(MINIMUM_EPOCH_MS))).toBe('brightening');
    expect(phaseDirection(new Date(MINIMUM_EPOCH_MS + 20 * DAY_MS))).toBe('brightening');
  });

  test('readout numbers match the clock and the storage key is stable across one peak', () => {
    const atMax = phaseReadout(new Date(MIRA_MAXIMUM_EPOCH_MS));
    expect(atMax.daysToNextMaximum).toBeCloseTo(0, 5);
    expect(atMax.milestone).toBe('maximum');
    expect(atMax.direction).toBe('fading');

    const atMin = phaseReadout(new Date(MINIMUM_EPOCH_MS));
    expect(atMin.daysToNextMaximum).toBeCloseTo(MIRA_RISE_DAYS, 5);
    expect(atMin.milestone).toBe('minimum');
    expect(atMin.direction).toBe('brightening');

    const before = skyStateAt(new Date(MIRA_MAXIMUM_EPOCH_MS - 5 * DAY_MS));
    const after = skyStateAt(new Date(MIRA_MAXIMUM_EPOCH_MS + 5 * DAY_MS));
    expect(milestoneStorageKey('maximum', before)).toBe('mira:milestone:maximum:0');
    expect(milestoneStorageKey('maximum', after)).toBe('mira:milestone:maximum:0');
    expect(milestoneStorageKey('minimum', skyStateAt(new Date(MINIMUM_EPOCH_MS)))).toBe(
      'mira:milestone:minimum:0',
    );
  });
});
