// Mira as a clock. The wall clock is the only input: same instant, same sky — no network,
// no randomness — which is what makes "tonight's Mira" differ from last week's.

export const MIRA_PERIOD_DAYS = 331.96;

// Epoch anchor: a real, well-observed maximum. Wikipedia's table of contemporary maxima for
// Mira (https://en.wikipedia.org/wiki/Mira) dates that cycle to 21–30 Sep 2011, and the
// observing reports that followed put Mira at its brightest in living memory into early
// October, so this instant sits inside a broad plateau rather than on a peak measured to the
// day. Days of slack is ~1% of a cycle: invisible once it reaches the scene.
export const MIRA_MAXIMUM_EPOCH_MS = Date.UTC(2011, 9, 6);

// Minimum → maximum takes ~100 days, the fall back down the remaining ~232. That asymmetry
// is why the curve below is two half-cosines instead of one cosine.
export const MIRA_RISE_DAYS = 100;

// Mira AB's orbital period is orders of magnitude slower than the pulsation. Published values
// range from ~276 to ~500 years; this is a slow decorative progression anchored at J2000.0,
// not a prediction, and it must not replace the fast decorative orbit in Scene.tsx.
export const MIRA_ORBITAL_PERIOD_YEARS = 500;

// A session is minutes long and the phase barely moves, so a minute is plenty.
export const SKY_REFRESH_INTERVAL_MS = 60_000;

const DAY_MS = 86_400_000;
const ORBITAL_PERIOD_MS = MIRA_ORBITAL_PERIOD_YEARS * 365.25 * DAY_MS;
const ORBITAL_EPOCH_MS = Date.UTC(2000, 0, 1, 12);

export interface SkyState {
  date: Date;
  pulsationPhase: number; // 0 at maximum light, rising through the cycle to 1
  brightness: number; // 0..1 normalised, 1 = brightest
  colorShift: number; // 0 = dimmest/reddest .. 1 = brightest/whitest
  orbitalPhase: number; // 0..1 through the real binary orbit (~500 years)
  daysToMaximum: number; // days until the next maximum (issue #6 will show this)
}

function fractional(x: number): number {
  return ((x % 1) + 1) % 1;
}

// Two cosine half-waves of unequal length — a fast rise, a slow decline. Both halves meet at
// zero slope, so brightness stays smooth across the minimum and across the 0/1 wrap.
function brightnessAt(phase: number): number {
  const riseFraction = MIRA_RISE_DAYS / MIRA_PERIOD_DAYS;
  const declineFraction = 1 - riseFraction;

  if (phase > declineFraction) {
    return 0.5 * (1 - Math.cos(Math.PI * ((phase - declineFraction) / riseFraction)));
  }
  return 0.5 * (1 + Math.cos(Math.PI * (phase / declineFraction)));
}

export function skyStateAt(date: Date): SkyState {
  const ms = date.getTime();
  const sinceMaximum = (ms - MIRA_MAXIMUM_EPOCH_MS) / DAY_MS;

  const pulsationPhase = fractional(sinceMaximum / MIRA_PERIOD_DAYS);
  const brightness = brightnessAt(pulsationPhase);

  return {
    date,
    pulsationPhase,
    brightness,
    colorShift: brightness,
    orbitalPhase: fractional((ms - ORBITAL_EPOCH_MS) / ORBITAL_PERIOD_MS),
    daysToMaximum: (1 - pulsationPhase) * MIRA_PERIOD_DAYS,
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
