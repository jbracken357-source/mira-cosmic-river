// How tonight's pulsation lights the rest of the scene — the star field, bloom,
// and Mira A's halo clock. The river already goes through dailySkyCoupling; these
// four curves used to live at each call site.
//
// First version is a verbatim lift of the existing numbers. Changing them would
// fail the daily-sky pixel check. A later pass may unify the envelopes.

import type { SkyState } from './starClock';

export interface PulsationLighting {
  starFieldSky: number;
  bloomIntensity: number;
  bloomRadius: number;
  miraAClock: number;
}

export function pulsationLighting(sky: Pick<SkyState, 'brightness' | 'colorShift'>): PulsationLighting {
  const { brightness, colorShift } = sky;
  return {
    starFieldSky: 0.35 + 0.65 * brightness,
    bloomIntensity: 0.18 + 0.62 * brightness,
    bloomRadius: 0.28 + 0.44 * colorShift,
    miraAClock: 0.38 + 0.62 * brightness,
  };
}
