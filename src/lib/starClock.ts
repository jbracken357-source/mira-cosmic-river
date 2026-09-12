// Mira as a clock. The wall clock is the only input: same instant, same sky — no network,
// no randomness — which is what makes "tonight's Mira" differ from last week's.

import { PHYSICS } from '../constants/physics';

// One source of truth: the pulsation period lives with the rest of Mira's physical data.
export const MIRA_PERIOD_DAYS = PHYSICS.MIRA_A.pulsationPeriod;

// Epoch anchor: the middle of a documented maximum of Mira (omicron Ceti). Wikipedia's table
// of contemporary maxima (https://en.wikipedia.org/wiki/Mira) places that cycle in
// 21-30 Sep 2011. Mira's maxima are broad plateaus rather than a peak on a stated day, so the
// centre of the cited window is the best available estimate; the residual error is ~1% of a
// cycle and invisible in the scene.
export const MIRA_MAXIMUM_EPOCH_MS = Date.UTC(2011, 8, 25);

// Minimum → maximum takes ~100 days, the fall back down the remaining ~232. That asymmetry
// is why the curve below is two half-cosines instead of one cosine.
export const MIRA_RISE_DAYS = 100;

// Mira AB's orbital period is orders of magnitude slower than the pulsation. Published values
// range from ~276 to ~500 years; this is a slow decorative progression anchored at J2000.0,
// not a prediction, and it must not replace the fast decorative orbit in Scene.tsx.
export const MIRA_ORBITAL_PERIOD_YEARS = 500;

const DAY_MS = 86_400_000;
const ORBITAL_PERIOD_MS = MIRA_ORBITAL_PERIOD_YEARS * 365.25 * DAY_MS;
const ORBITAL_EPOCH_MS = Date.UTC(2000, 0, 1, 12);

const RISE_FRACTION = MIRA_RISE_DAYS / MIRA_PERIOD_DAYS;
const DECLINE_FRACTION = 1 - RISE_FRACTION;

// A few percent of the cycle: long enough to notice, short enough that "at maximum" is not a season.
export const MILESTONE_WINDOW_DAYS = 10;

export interface SkyState {
  pulsationPhase: number; // 0 at maximum light, rising through the cycle to 1
  brightness: number; // 0..1 normalised, 1 = brightest
  colorShift: number; // 0 = dimmest/reddest .. 1 = brightest/whitest
  orbitalPhase: number; // 0..1 through the real binary orbit (~500 years)
  cycleIndex: number; // whole pulsation cycles since the epoch; names a max/min for persistence
}

export type PhaseMilestone = 'maximum' | 'minimum' | 'none';
export type PhaseDirection = 'brightening' | 'fading';

export interface PhaseReadout {
  daysToNextMaximum: number;
  daysToNextMinimum: number;
  milestone: PhaseMilestone;
  direction: PhaseDirection;
}

function fractional(x: number): number {
  return ((x % 1) + 1) % 1;
}

// Two cosine half-waves of unequal length — a fast rise, a slow decline. Both halves meet at
// zero slope, so brightness stays smooth across the minimum and across the 0/1 wrap.
function brightnessAt(phase: number): number {
  if (phase > DECLINE_FRACTION) {
    return 0.5 * (1 - Math.cos(Math.PI * ((phase - DECLINE_FRACTION) / RISE_FRACTION)));
  }
  return 0.5 * (1 + Math.cos(Math.PI * (phase / DECLINE_FRACTION)));
}

export function skyStateAt(date: Date): SkyState {
  const ms = date.getTime();
  const sinceMaximum = (ms - MIRA_MAXIMUM_EPOCH_MS) / DAY_MS;

  const pulsationPhase = fractional(sinceMaximum / MIRA_PERIOD_DAYS);
  const brightness = brightnessAt(pulsationPhase);

  // Colour saturates ahead of luminosity: Mira A reaches its whitest while it is still
  // brightening. Keeping the two curves separate is what makes the colour shift a distinct
  // output rather than a second name for brightness.
  const colorShift = Math.pow(brightness, 0.6);

  return {
    pulsationPhase,
    brightness,
    colorShift,
    orbitalPhase: fractional((ms - ORBITAL_EPOCH_MS) / ORBITAL_PERIOD_MS),
    cycleIndex: Math.floor(sinceMaximum / MIRA_PERIOD_DAYS),
  };
}

// `?epoch=<ISO date or unix seconds>` pins the clock for development and for tests. #2's
// acceptance requires the shipped build to expose no way to set the clock, so the pinning
// entry point sits under PROD and is dropped from the bundle at build time.
function pinnedDate(): Date | null {
  if (typeof window === 'undefined') return null;

  if (!import.meta.env.PROD) {
    const raw = new URLSearchParams(window.location.search).get('epoch');
    if (raw) {
      const pinned = /^\d+$/.test(raw) ? new Date(Number(raw) * 1000) : new Date(raw);
      if (!Number.isNaN(pinned.getTime())) return pinned;
    }
  }

  return null;
}

export function currentSkyState(): SkyState {
  return skyStateAt(pinnedDate() ?? new Date());
}

function asSky(input: SkyState | Date): SkyState {
  return input instanceof Date ? skyStateAt(input) : input;
}

function daysUntilPhase(phase: number, target: number): number {
  const remaining = fractional(target - phase);
  const days = remaining * MIRA_PERIOD_DAYS;
  // A remaining of ~1 is a floating-point "just past the target", not a whole cycle to wait.
  return days > MIRA_PERIOD_DAYS - 1e-6 ? 0 : days;
}

export function daysUntilNextMaximum(input: SkyState | Date): number {
  return daysUntilPhase(asSky(input).pulsationPhase, 0);
}

export function daysUntilNextMinimum(input: SkyState | Date): number {
  return daysUntilPhase(asSky(input).pulsationPhase, DECLINE_FRACTION);
}

export function phaseDirection(input: SkyState | Date): PhaseDirection {
  return asSky(input).pulsationPhase >= DECLINE_FRACTION ? 'brightening' : 'fading';
}

export function phaseMilestone(input: SkyState | Date): PhaseMilestone {
  const sky = asSky(input);
  const toMax = daysUntilPhase(sky.pulsationPhase, 0);
  const sinceMax = sky.pulsationPhase * MIRA_PERIOD_DAYS;
  if (Math.min(toMax, sinceMax) <= MILESTONE_WINDOW_DAYS) return 'maximum';

  const toMin = daysUntilPhase(sky.pulsationPhase, DECLINE_FRACTION);
  const sinceMin = fractional(sky.pulsationPhase - DECLINE_FRACTION) * MIRA_PERIOD_DAYS;
  if (Math.min(toMin, sinceMin) <= MILESTONE_WINDOW_DAYS) return 'minimum';

  return 'none';
}

export function phaseReadout(input: SkyState | Date): PhaseReadout {
  const sky = asSky(input);
  return {
    daysToNextMaximum: daysUntilNextMaximum(sky),
    daysToNextMinimum: daysUntilNextMinimum(sky),
    milestone: phaseMilestone(sky),
    direction: phaseDirection(sky),
  };
}

export function milestoneStorageKey(kind: 'maximum' | 'minimum', sky: SkyState): string {
  let cycle = sky.cycleIndex;
  if (kind === 'maximum' && sky.pulsationPhase * MIRA_PERIOD_DAYS > MILESTONE_WINDOW_DAYS) {
    cycle += 1;
  }
  return `mira:milestone:${kind}:${cycle}`;
}
