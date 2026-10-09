// Binary lighting: the pure calibration math behind the two stars and the inflow
// between them (issue #25).
//
// As with riverLighting, the shaders in src/shaders/miraA.ts and
// src/shaders/accretionDisk.ts mirror these formulas in GLSL — MiraB.tsx shares the
// HIGHLIGHT_SHOULDER_GLSL snippet from miraA.ts — and tests/unit/shaderParity.spec.ts
// guards the mirror; the material stream consumes streamClump directly on the CPU. The numbers are unit-tested here, the visuals
// are validated by the deterministic baselines in
// docs/design-audit-2026-09-17/baselines/.

import { COLORS } from '../constants/colors';

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// GLSL-compatible smoothstep.
function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

// Wrap an angle into [-pi, pi], the same atan(sin, cos) the GLSL side uses, so an arc
// centred near ±pi never tears across the wraparound.
export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

// Gaussian falloff: 1 at the centre, exp(-1) at one width, no cutoff anywhere.
// A degenerate width means no bump at all.
export function gaussFalloff(x: number, width: number): number {
  if (width <= 0) return 0;
  const q = x / width;
  return Math.exp(-q * q);
}

// --- Mira A's surface -------------------------------------------------------

// Fine granulation never fully vanishes — even the calm patches keep a trace of
// surface life — but most of the surface is not allowed to carry full-strength
// high-frequency texture.
export const SURFACE_DETAIL_FLOOR = 0.25;

// How strong the fine surface detail (the high-frequency noise and the density map's
// contrast) may run at a point. `region` is a large-scale patchiness value in 0..1,
// `limb` is the view factor mu (1 at the disc centre, 0 at the limb). Detail
// concentrates in patches and calms toward the limb, so the photosphere reads as
// regions of activity between smooth stretches rather than uniform grit.
export function surfaceDetailStrength(region: number, limb: number): number {
  const patch = smoothstep(0.3, 0.75, clamp01(region));
  const inward = 0.45 + 0.55 * smoothstep(0.05, 0.5, clamp01(limb));
  return SURFACE_DETAIL_FLOOR + (1 - SURFACE_DETAIL_FLOOR) * patch * inward;
}

// --- Mira A's breathing photosphere (issue #87) --------------------------------

// The decorative pulsation moves the photosphere's light with its radius — bright
// when swollen, dim when shrunk, in step, or the surface reads as a static shell
// behind a breathing halo. The swing is large enough to read in the opening
// close-up, small enough that the star never goes out at the dim end nor lifts the
// whole disc into dead white at the bright end.
export const PULSE_LIGHT_SWING = 0.2;

// The radius's own swing in the same decorative cycle: the photosphere swells and
// shrinks by this fraction of its base radius (the vertex shader's radiusPulse).
// Lives with the other pulse constants so the tail's root (lib/tailPath) can
// clear the breathing limb without reaching into the shader module.
export const MIRA_A_PULSE_AMPLITUDE = 0.09; // 9% of the radius come and gone each cycle

// The photosphere's light at one pulsation phase angle: 0 is the dimmest, pi the
// brightest, and the two half-turns have to read differently. The shader runs the
// same curve at theta = uTime * PULSE_RATE + pi/2, where it is one multiply against
// the radius pulse's own sine.
export function surfacePulseLight(phaseAngle: number): number {
  return 1 - PULSE_LIGHT_SWING * Math.cos(phaseAngle);
}

// The granulation's hot network breathes with the same phase: near maximum the
// bright cells lift off the ember floor, near minimum they sink back into it. The
// cycle moves the surface itself instead of dimming one static shell — this is what
// keeps the disc from reading as a uniform hard shell at full intensity. The bright
// end stays well under flooding the disc, the dim end never lets the cells vanish.
export const PULSE_CELL_LIFT_DIM = 0.3;
export const PULSE_CELL_LIFT_BRIGHT = 0.62;

export function surfacePulseCellLift(phaseAngle: number): number {
  const phase01 = 0.5 - 0.5 * Math.cos(phaseAngle); // 0 at the dimmest, 1 at the brightest
  return PULSE_CELL_LIFT_DIM + (PULSE_CELL_LIFT_BRIGHT - PULSE_CELL_LIFT_DIM) * phase01;
}

// --- Highlight shoulder ------------------------------------------------------

// Linear up to the knee, then an exponential approach to the ceiling. Bright cores
// keep their hue instead of clipping to dead white.
export const HIGHLIGHT_KNEE = 0.85;
export const HIGHLIGHT_CEILING = 1.35;

export function highlightShoulder(x: number): number {
  const head = HIGHLIGHT_CEILING - HIGHLIGHT_KNEE;
  const over = Math.max(x - HIGHLIGHT_KNEE, 0);
  return Math.min(x, HIGHLIGHT_KNEE) + head * (1 - Math.exp(-over / head));
}

// --- Mira B's accretion arcs ---------------------------------------------------

// The disk's shape calibration (#91): the mesh (MiraB) and the hot-spot angle math
// below share this one source, so the ring the shader paints and the ring the
// geometry presents can never drift apart.
//
// The plane is tilted towards the viewer rather than lying in the 30-degree-inclined
// orbital plane. Those are the same plane as far as the physics is concerned, but
// the explore camera sits within a few degrees of the orbital plane, where a
// coplanar disk is edge-on and collapses to a smear. A ninth of a pi keeps the ring
// an unmistakable ellipse from the angles the camera actually reaches.
//
// The disk is a puff, not a mathematical plane: the camera's azimuth is unrestricted,
// and a flat band is exactly edge-on at two points of every revolution, where it
// degenerates into a one-pixel bar. A thickness under a sixth of the radius read as
// that bar from the explore axis (the sideways white blob of #91); three tenths
// keeps a soft vertical extent from every angle. Real disks flared like this are
// just as thin.
export const DISK_GEOMETRY = {
  tilt: Math.PI / 9, // radians about X, off the orbital plane
  scale: 4.8, // outer radius in white-dwarf radii — clears the star's own bloom
  thickness: 0.3, // vertical half-thickness as a fraction of the outer radius
} as const;

// The disk-local azimuth of the direction from the companion toward the giant —
// where the inflow lands, so the hot spot rides the pair's live separation (orbit
// and shared journey alike) instead of sitting fixed on the sky. The disk mesh
// only ever carries a rotation about X, so the world A-ward vector rotates into
// the disk's own tilted plane by hand: local X is world X, and the plane's second
// basis vector is (0, -sin tilt, cos tilt).
export function impactAngleFor(
  primary: readonly [number, number, number],
  companion: readonly [number, number, number],
): number {
  const wx = primary[0] - companion[0];
  const wy = primary[1] - companion[1];
  const wz = primary[2] - companion[2];
  const localZ = -wy * Math.sin(DISK_GEOMETRY.tilt) + wz * Math.cos(DISK_GEOMETRY.tilt);
  return Math.atan2(localZ, wx);
}

// Outside the two arcs the orbit keeps only a faint trace of dust — enough to suggest
// the disk plane, never enough to read as a complete ring.
export const DISK_ARC_TRACE = 0.05;

// The impact arc where the inflow lands, and the weaker wake trailing it.
export const IMPACT_ARC_WIDTH = 0.85;
export const WAKE_ARC_OFFSET = 2.35;
export const WAKE_ARC_WIDTH = 0.6;
export const WAKE_ARC_GAIN = 0.38;

// Opacity envelope along the orbit: two soft gaussian arcs over a faint trace.
export function arcEnvelope(angle: number, impactAngle: number): number {
  const impact = gaussFalloff(wrapAngle(angle - impactAngle), IMPACT_ARC_WIDTH);
  const wake = WAKE_ARC_GAIN * gaussFalloff(wrapAngle(angle - impactAngle - WAKE_ARC_OFFSET), WAKE_ARC_WIDTH);
  return DISK_ARC_TRACE + (1 - DISK_ARC_TRACE) * Math.min(1, impact + wake);
}

// Inside an arc the material is clumpy: a floor keeps the gas present, the
// interference of two slow waves punches the gaps that make it intermittent.
export const ARC_CLUMP_FLOOR = 0.25;

export function arcClump(angle: number, time: number): number {
  const long = 0.5 + 0.5 * Math.sin(angle * 3 + 1.7 + time * 0.22);
  const short = 0.5 + 0.5 * Math.sin(angle * 7 - time * 0.9);
  return ARC_CLUMP_FLOOR + (1 - ARC_CLUMP_FLOOR) * smoothstep(0.2, 0.8, long * short);
}

// The hot spot sits where the stream actually lands: tight enough to be a place,
// broad enough to read as a soft landing region rather than a white bead pasted
// beside the star (#91).
export const HOT_SPOT_ANGLE_WIDTH = 0.55;
export const HOT_SPOT_RADIUS = 0.85;
export const HOT_SPOT_RADIAL_WIDTH = 0.3;

export function hotSpotProfile(deltaAngle: number, radius: number): number {
  return (
    gaussFalloff(wrapAngle(deltaAngle), HOT_SPOT_ANGLE_WIDTH) *
    gaussFalloff(radius - HOT_SPOT_RADIUS, HOT_SPOT_RADIAL_WIDTH)
  );
}

// --- The inflow from Mira A to Mira B -----------------------------------------

// Clumps along the stream: five waves per crossing, gaps that dim to a floor rather
// than vanishing, and both ends pinned bright so the flow leaves Mira A and arrives
// at the hot spot without a break.
export const STREAM_CLUMP_COUNT = 5;
export const STREAM_CLUMP_FLOOR = 0.12;
export const STREAM_DEPARTURE_BLEND = 0.12;
export const STREAM_ARRIVAL_BLEND = 0.2;

// Brightness of one stream particle at position t (0 leaves Mira A, 1 reaches Mira B)
// for a per-particle seed. Deterministic: the same particle keeps its own rhythm.
export function streamClump(t: number, seed: number): number {
  const tt = clamp01(t);
  const phase = seed - Math.floor(seed);
  const wave = 0.5 + 0.5 * Math.sin(2 * Math.PI * (STREAM_CLUMP_COUNT * tt + phase));
  const clump = STREAM_CLUMP_FLOOR + (1 - STREAM_CLUMP_FLOOR) * smoothstep(0.25, 0.7, wave);
  const ends = Math.max(
    1 - smoothstep(0, STREAM_DEPARTURE_BLEND, tt),
    smoothstep(1 - STREAM_ARRIVAL_BLEND, 1, tt),
  );
  return Math.min(1, clump + (1 - clump) * ends);
}

// --- The halo shells around each star -------------------------------------------
// Scene geometry consumed by the components (MiraA.tsx, MiraB.tsx) and the framing
// proofs; the shared shell SHADER stays in src/shaders/miraA.ts. They live here so
// every scene number has one owner in lib (#105).

// Mira A's atmosphere, as two shells a viewer reads as one volume: a dense layer hugging the
// photosphere and a wide thin haze that gives the star its reach on screen. `falloff` is the
// exponential rate at which each shell's glow dies away between the limb and the shell edge —
// a low rate for the wide haze, a high one for the dense layer.
export const MIRA_A_ATMOSPHERE = {
  mid: { scale: 1.22, opacity: 0.3, falloff: 3.4, color: '#f58b3c' },
  outer: { scale: 1.8, opacity: 0.12, falloff: 2.5, color: '#df6531' },
} as const;

// Mira B's corona: same shader, white dwarf colours, a much tighter shell. Kept small on
// purpose — a broad halo around the companion buries the accretion disk behind it and
// fattens the star into a white bead.
export const MIRA_B_CORONA = {
  scale: 1.75,
  opacity: 0.19,
  falloff: 2.1,
  color: COLORS.MIRA_B_CORONA,
  pulseAmp: 0.015,
} as const;
