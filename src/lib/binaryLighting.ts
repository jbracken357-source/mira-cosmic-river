// Binary lighting: the pure calibration math behind the two stars and the inflow
// between them (issue #25).
//
// As with riverLighting, the shaders in src/shaders/miraA.ts and
// src/shaders/accretionDisk.ts mirror these formulas in GLSL, and
// tests/unit/shaderParity.spec.ts guards the mirror; the material stream consumes
// streamClump directly on the CPU. The numbers are unit-tested here, the visuals
// are validated by the deterministic baselines in
// docs/design-audit-2026-09-17/baselines/.

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

// The hot spot sits where the stream actually lands: tight in angle, centred on its
// own radius within the disk.
export const HOT_SPOT_ANGLE_WIDTH = 0.42;
export const HOT_SPOT_RADIUS = 0.85;
export const HOT_SPOT_RADIAL_WIDTH = 0.26;

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
