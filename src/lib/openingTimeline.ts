// Opening timeline (#28, ticket 03): the full cinematic as a pure function of time.
//
// resolveOpeningPose(t) is the single source of the opening's camera path and tail
// ramp; the scene's frame loop only applies the result. Three beats:
//
//   起 hold       0–4s     tight on the pair (CLOSE), the tail still dark
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
// The pull-back glimmer (up to TAIL_GLIMMER) is the floor the reveal grows from —
// resetting to zero at the tail-reveal mark read as a pop.
export const TAIL_GLIMMER = 0.15;
export const TAIL_FULL_OPACITY = 0.85;

function tailRamp(t: number): number {
  if (t < CINEMATIC.PULL_BACK_START) return 0;
  if (t < CINEMATIC.TAIL_REVEAL_START) {
    return clamp01((t - CINEMATIC.PULL_BACK_START) / (CINEMATIC.TAIL_REVEAL_START - CINEMATIC.PULL_BACK_START)) * TAIL_GLIMMER;
  }
  return TAIL_GLIMMER + easeInOutCubic(clamp01((t - CINEMATIC.TAIL_REVEAL_START) / (CINEMATIC.TAIL_FULL - CINEMATIC.TAIL_REVEAL_START))) * (TAIL_FULL_OPACITY - TAIL_GLIMMER);
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

// The caption overlay only reacts at its four segment boundaries (CinematicOverlay),
// so the frame loop publishes the boundary value instead of the raw clock — the
// store updates on segment changes only, never per frame.
export function openingCaptionMark(t: number): number {
  if (t < CINEMATIC.STARS_APPEAR) return 0;
  if (t < CINEMATIC.PULL_BACK_START) return CINEMATIC.STARS_APPEAR;
  if (t < CINEMATIC.TAIL_REVEAL_START) return CINEMATIC.PULL_BACK_START;
  if (t < CINEMATIC.FINAL_TEXT) return CINEMATIC.TAIL_REVEAL_START;
  return CINEMATIC.FINAL_TEXT;
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
