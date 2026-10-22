// River lighting: the pure calibration math behind the tail and the veil (issue #19).
//
// The shaders consume these results as uniforms, so the numbers can be unit-tested while
// the visuals are validated by the deterministic baselines in
// docs/design-audit-2026-09-17/baselines/. The GLSL in src/shaders/tail.ts and
// src/components/Scene/RiverVeil.tsx mirrors starLightFalloff and riverBrightness exactly;
// keep the two sides in step when tuning.

import type { SkyState } from './starClock';

// Scene-scale reach of each star's light, in world units (Mira A radius 2.5, tail length 25).
// The companion's pool is deliberately tighter: it lights its own neighbourhood, not the river.
export const MIRA_A_REACH = 7.5;
export const MIRA_B_REACH = 3.2;
export const MIRA_B_GAIN = 0.8;

// Far river never goes black — the dark half keeps structure instead of voiding out.
export const RIVER_SHADOW_FLOOR = 0.24;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// Smooth inverse-square soft falloff: 1 at the star, 1/2 at `reach`, no cutoff anywhere, so
// the lit region can never end in a visible seam. Degenerate reach means no light.
export function starLightFalloff(distance: number, reach: number): number {
  if (reach <= 0) return 0;
  const x = Math.abs(distance) / reach;
  return 1 / (1 + x * x);
}

// Combined light at a point given its distances to Mira A and Mira B.
export function riverLight(distanceA: number, distanceB: number): number {
  return clamp01(
    starLightFalloff(distanceA, MIRA_A_REACH) +
      MIRA_B_GAIN * starLightFalloff(distanceB, MIRA_B_REACH),
  );
}

// Map raw light to the brightness multiplier the shaders apply. The floor is what keeps the
// dark half of the river structured rather than black.
export function riverBrightness(light: number): number {
  return RIVER_SHADOW_FLOOR + (1 - RIVER_SHADOW_FLOOR) * clamp01(light);
}

// The veil's shadow floor and full-light lift: the alpha-blended ribbons keep three
// quarters of their body in shadow and gain a third under full light.
export const VEIL_SHADOW_RETAIN = 0.75;
export const VEIL_LIGHT_LIFT = 0.6;

// The veil's spine lift: how far the dense material inside the lane rises above the
// body, in HDR. At full sparkle the accent ridges reach ~2.6x their body colour, past
// the bloom threshold; volume ribbons take 60% of it.
export const VEIL_SPINE_GAIN = 1.6;

// The flow map's share of the veil density (it can only add threads: max with the
// smoke), and how far its image stretches across the ribbon — above 1 squeezes the
// threads toward the lane so the widest strands stay inside the ribbon's own fade.
export const FLOW_WEIGHT = 1.0;
export const FLOW_SPREAD = 1.25;

// The veil ribbons are alpha-blended over near-black space, so the multiplicative floor that
// suits the additive tail would crush them to invisible. Their response is gentler: shadow
// keeps three quarters of the body, full light lifts it by a third.
export function veilLightResponse(light: number): number {
  return VEIL_SHADOW_RETAIN + VEIL_LIGHT_LIFT * clamp01(light);
}

// How tonight's sky bends the river: gain scales its brightness, warmth shifts its
// palette toward the dim red of a faint Mira A.
export interface SkyRiverCoupling {
  gain: number;
  warmth: number;
}

// Real-time binding to the star clock: the pulsation bends the river's brightness and warmth
// without ever switching it off. Warmth tracks colour shift — a dim, red Mira A casts a
// warmer river; a bright, white one a cooler river.
export function skyRiverGain(
  brightness: number,
  colorShift: number,
): SkyRiverCoupling {
  return {
    gain: 0.8 + 0.22 * clamp01(brightness),
    warmth: 0.25 * (1 - clamp01(colorShift)),
  };
}

// How tonight's sky sits on the river beyond the plain gain/warmth above (issue #27).
// One deterministic sky in, four coordinated channels out, so local colour temperature,
// brightness and material density move together and the same date always renders the
// same river. gain composes the plain coupling's gain with the daily lift here, once, so
// the component and the tests consume one formula; warmth is the curve the river already
// follows, collected into this seam so every daily channel has one home. The lift and
// the density are deliberately small — the sky modulates the river, it never re-tunes it.
export interface DailySkyCoupling {
  gain: number;
  warmth: number;
  brightnessLift: number;
  density: number;
  sparkle: number;
}

// The lift peaks near 1% of river gain; the density swing stays within ±4%. Both sit far
// inside the protection of the gain floor above (0.8): the tail can thin or thicken with
// the season, never empty.
export const DAILY_LIFT_AMPLITUDE = 0.05;
export const DAILY_DENSITY_AMPLITUDE = 0.08;

export function dailySkyCoupling(sky: SkyState): DailySkyCoupling {
  const brightness = clamp01(sky.brightness);
  const colorShift = clamp01(sky.colorShift);
  const plain = skyRiverGain(brightness, colorShift);
  // Colour saturates ahead of luminosity (starClock), so their gap reads as the star
  // running ahead of its own light: zero at maximum and minimum where the curves meet,
  // peaking mid-cycle. A lift on top of the gain, not a second gain.
  const brightnessLift = DAILY_LIFT_AMPLITUDE * Math.max(0, colorShift - brightness);
  return {
    gain: plain.gain + brightnessLift,
    warmth: plain.warmth,
    brightnessLift,
    // A brighter Mira A drives a stronger wind and spreads the river slightly thinner; a
    // faint one lets material settle. Centred on 0.5 — the exact cycle mean of the two
    // half-cosines — so the year as a whole neither gains nor loses river.
    density: 1 + DAILY_DENSITY_AMPLITUDE * (0.5 - brightness),
    sparkle: dailySparkle(brightness),
  };
}

// The one daily channel meant to be SEEN from one night to the next: how hard the
// river's lit spine and its gold beads shine. Gain, warmth and density above stay
// whispers (the river is never re-tuned by the sky), and on their own two nights a
// season apart rendered nearly the same frame. Sparkle carries the cycle where the
// eye notices it: the river glitters near maximum and banks to embers near
// minimum, never out. Centred on 1 at the cycle mean brightness (0.5).
export const DAILY_SPARKLE_FLOOR = 0.5;
export const DAILY_SPARKLE_SWING = 1.0;

export function dailySparkle(brightness: number): number {
  return DAILY_SPARKLE_FLOOR + DAILY_SPARKLE_SWING * clamp01(brightness);
}

// Gold accents are local to the primary's full light: quadratic falloff kills them well
// before the mid-river, so the blue-violet body keeps the palette.
export function goldAccentStrength(lightA: number): number {
  const l = clamp01(lightA);
  return 0.5 * l * l;
}

// Per-layer weight for the veil ribbons. Volume layers peak at the centre of the spread and
// soften toward the edges so the stack reads as one body with a feathered silhouette rather
// than a deck of identical cards; accent layers always sit below the volume body.
export function veilLayerWeight(index: number, count: number, accent: boolean): number {
  if (accent) return 0.72;
  const p = count <= 1 ? 0 : (index / (count - 1)) * 2 - 1; // -1 .. 1 across the spread
  return (1.05 + 0.75 * (1 - p * p)) * 1.4;
}

// The tail's beads: a share of the points become hot grains riding close to the spine,
// the gold-and-pearl glitter of the reference art. They are grains, not dust: their
// opacity does not thin with the particle count, their core sits in HDR so the bloom
// lights them, and they draw a little smaller than the dust around them.
export const TAIL_BEAD_FRACTION = 0.05;
export const TAIL_BEAD_SPREAD = 0.55; // of the dust's lateral spread: beads hug the spine
export const TAIL_BEAD_OPACITY = 0.8;
export const TAIL_BEAD_HDR = 2.6;
export const TAIL_BEAD_SIZE = 0.6;

// Base opacity for the tail points. With the density image the veil carries the body and the
// points are texture; without it the points alone must keep the river visibly non-empty, and
// lighter tiers thin the count so each point does more work. `density` is the daily-sky
// modulation (issue #27): it scales texture and fallback alike, so a sparse night reads as
// a sparser river, never as a broken one.
export function tailBaseOpacity(textureReady: boolean, particleCount: number, density = 1): number {
  const base = textureReady
    ? 0.16 * Math.min(1, 600 / particleCount)
    : 0.6 * Math.min(1, Math.sqrt(300 / particleCount));
  return base * density;
}
