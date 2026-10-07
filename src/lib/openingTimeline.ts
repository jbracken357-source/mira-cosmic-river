// Opening timeline (#28, ticket 03): the full cinematic as a pure function of time.
//
// resolveOpeningPose(t) is the single source of the opening's camera path and tail
// ramp; the scene's frame loop only applies the result. Three beats:
//
//   起 hold       0–4s     tight on the pair (CLOSE), the tail dark until the road
//                          begins to gather at 3s (TAIL_FORMING_START, #91)
//   中 pull-back  4–12s    the scale reveal. The path bows through MID toward the
//                          river, so its near edge sweeps past the lens (前景经过)
//                          instead of the camera retreating in a straight line;
//                          the look-at swings onto the river during 8–11s
//   末 settle     12.5–15s an eased landing from the far framing onto the explore
//                          framing — the hand-off to free exploration is a landing,
//                          not a cut
//
// Reduced motion pins the explore framing for the whole sequence: the dramatic move
// goes, the content (phases, captions, tail reveal) stays. Portrait composes CLOSE
// and MID on its own — the pair stays the subject and the river keeps its direction
// below it, rather than cropping the desktop framing.
import { CINEMATIC, CAMERA, PORTRAIT_CAMERA } from '../constants/animation';
import type { CinematicPhase } from '../types';

type Vec3 = [number, number, number];

export interface OpeningPose {
  position: Vec3;
  lookAt: Vec3;
  fov: number;
  tailOpacity: number;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

function lerpVec(a: readonly number[], b: readonly number[], k: number): Vec3 {
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
}

// Quadratic bezier through the MID waypoint: the bow toward the river lives in the
// constants (CAMERA.MID), so the path is data, not math buried in the frame loop.
function bowedPath(close: readonly number[], mid: readonly number[], far: readonly number[], k: number): Vec3 {
  const u = 1 - k;
  return [
    u * u * close[0] + 2 * u * k * mid[0] + k * k * far[0],
    u * u * close[1] + 2 * u * k * mid[1] + k * k * far[1],
    u * u * close[2] + 2 * u * k * mid[2] + k * k * far[2],
  ];
}

// The tail's opacity envelope, shared with the scene's explore-state value so the
// ramp can never drift away from where the opening lands.
// #91's strict reading of 「出现时…已经…不再只是底光」: the rise begins inside the
// FIRST caption's window (TAIL_FORMING_START) and crosses the base glow exactly as
// the second caption appears — opacity at PULL_BACK_START is TAIL_EMERGING, twice
// the glimmer floor. The first caption itself never carries more than the old
// floor, so its own beat stays quiet. Both joins are slope-zero eases: a reset or
// a kink at either mark read as a pop.
export const TAIL_GLIMMER = 0.15;
export const TAIL_EMERGING = TAIL_GLIMMER * 2;
export const TAIL_FULL_OPACITY = 0.85;

function tailRamp(t: number): number {
  if (t < CINEMATIC.TAIL_FORMING_START) return 0;
  if (t < CINEMATIC.PULL_BACK_START) {
    // The gathering: dark → TAIL_EMERGING across the first caption's latter half.
    return easeInOutCubic(clamp01((t - CINEMATIC.TAIL_FORMING_START) / (CINEMATIC.PULL_BACK_START - CINEMATIC.TAIL_FORMING_START))) * TAIL_EMERGING;
  }
  // Full visibility is a hard state, not the float sum of two eased segments.
  if (t >= CINEMATIC.TAIL_FULL) return TAIL_FULL_OPACITY;
  return TAIL_EMERGING + easeInOutCubic(clamp01((t - CINEMATIC.PULL_BACK_START) / (CINEMATIC.TAIL_FULL - CINEMATIC.PULL_BACK_START))) * (TAIL_FULL_OPACITY - TAIL_EMERGING);
}

export function resolveOpeningPose(
  t: number,
  { reduceMotion, portrait }: { reduceMotion: boolean; portrait: boolean },
): OpeningPose {
  const cam = portrait ? PORTRAIT_CAMERA : CAMERA;
  const tailOpacity = tailRamp(t);

  if (reduceMotion) {
    return { position: [...cam.EXPLORE.position], lookAt: [...cam.EXPLORE.lookAt], fov: cam.EXPLORE.fov, tailOpacity };
  }
  if (t >= CINEMATIC.EXPLORE_MODE) {
    // Past the end the pose IS the explore framing, so the introComplete hand-off
    // has nothing left to move.
    return { position: [...cam.EXPLORE.position], lookAt: [...cam.EXPLORE.lookAt], fov: cam.EXPLORE.fov, tailOpacity: TAIL_FULL_OPACITY };
  }
  if (t < CINEMATIC.PULL_BACK_START) {
    return { position: [...cam.CLOSE.position], lookAt: [...cam.CLOSE.lookAt], fov: cam.CLOSE.fov, tailOpacity };
  }
  if (t < CINEMATIC.PULL_BACK_END) {
    const eased = easeInOutCubic(clamp01((t - CINEMATIC.PULL_BACK_START) / (CINEMATIC.PULL_BACK_END - CINEMATIC.PULL_BACK_START)));
    const lookAt =
      t < CINEMATIC.TAIL_REVEAL_START
        ? ([...cam.CLOSE.lookAt] as Vec3)
        : lerpVec(cam.CLOSE.lookAt, cam.FAR.lookAt, easeInOutCubic(clamp01((t - CINEMATIC.TAIL_REVEAL_START) / (CINEMATIC.TAIL_FULL - CINEMATIC.TAIL_REVEAL_START))));
    return {
      position: bowedPath(cam.CLOSE.position, cam.MID.position, cam.FAR.position, eased),
      lookAt,
      fov: lerp(cam.CLOSE.fov, cam.FAR.fov, eased),
      tailOpacity,
    };
  }
  if (t < CINEMATIC.FINAL_TEXT) {
    // A short hold on the far framing before the landing begins.
    return { position: [...cam.FAR.position], lookAt: [...cam.FAR.lookAt], fov: cam.FAR.fov, tailOpacity };
  }
  const settle = easeInOutCubic(clamp01((t - CINEMATIC.FINAL_TEXT) / (CINEMATIC.EXPLORE_MODE - CINEMATIC.FINAL_TEXT)));
  return {
    position: lerpVec(cam.FAR.position, cam.EXPLORE.position, settle),
    lookAt: lerpVec(cam.FAR.lookAt, cam.EXPLORE.lookAt, settle),
    fov: lerp(cam.FAR.fov, cam.EXPLORE.fov, settle),
    tailOpacity,
  };
}

// One opening beat: the discrete phase the store may publish, the caption the
// overlay shows, and whether the title is visible. The overlay used to re-compare
// CINEMATIC.* against the published mark; title visibility then only worked
// because the mark quantizes to FINAL_TEXT while the phase is still tail-reveal
// (12.5–15s). That quantization is the contract — `title` states it.
export type OpeningCaption = 'cinematic1' | 'cinematic2' | 'cinematic3' | null;

export interface OpeningSegment {
  phase: CinematicPhase;
  caption: OpeningCaption;
  title: boolean;
  mark: number;
}

export function openingSegment(t: number): OpeningSegment {
  if (t >= CINEMATIC.EXPLORE_MODE) {
    return { phase: 'explore', caption: null, title: true, mark: CINEMATIC.FINAL_TEXT };
  }
  if (t >= CINEMATIC.FINAL_TEXT) {
    return { phase: 'tail-reveal', caption: null, title: true, mark: CINEMATIC.FINAL_TEXT };
  }
  if (t >= CINEMATIC.TAIL_REVEAL_START) {
    return { phase: 'tail-reveal', caption: 'cinematic3', title: false, mark: CINEMATIC.TAIL_REVEAL_START };
  }
  if (t >= CINEMATIC.PULL_BACK_START) {
    return { phase: 'pull-back', caption: 'cinematic2', title: false, mark: CINEMATIC.PULL_BACK_START };
  }
  if (t >= CINEMATIC.STARS_APPEAR) {
    return { phase: 'stars-appear', caption: 'cinematic1', title: false, mark: CINEMATIC.STARS_APPEAR };
  }
  return { phase: 'dark', caption: null, title: false, mark: 0 };
}

let cachedScale: number | null = null;

// Dev-only wall-clock scale for the opening: `?cinematic-scale=5` runs the 15s
// sequence in ~3s so e2e can reach the natural ending. Gated like `?epoch=` —
// dropped from production bundles.
export function cinematicTimeScale(): number {
  if (cachedScale === null) {
    cachedScale = 1;
    if (typeof window !== 'undefined' && !import.meta.env.PROD) {
      const raw = new URLSearchParams(window.location.search).get('cinematic-scale');
      const value = raw === null ? NaN : Number(raw);
      if (Number.isFinite(value) && value > 0) cachedScale = value;
    }
  }
  return cachedScale;
}
