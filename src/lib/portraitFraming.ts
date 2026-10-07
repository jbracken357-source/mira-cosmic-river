// 竖屏长卷 (the portrait long scroll, #92): in the tall frame the 光河 runs down
// the screen's long axis — the pair high on the right, the 根 between them, the
// road falling away into the lower half so the lower screen is never empty. The
// composition is calibrated once (PORTRAIT_CAMERA.EXPLORE at the reference
// aspect) and then PINNED: whatever the phone's exact proportions, the 根 holds
// the same screen point, so the 顶栏 never covers the pair on a short screen and
// the road always reaches the lower half on a tall one. Only the aim moves with
// aspect — the camera position is aspect-independent, so 主视角's home check and
// the capture fallback read the constant unchanged.
//
// Landscape is untouched by all of this: it keeps its own wide vista (the road
// from between the pair toward the left), never this composition cropped narrow.
//
// Pure seams, no three.js: the projection below is the same pipeline the scene
// runs (tilt → look-at basis → fitted fov), spelled in plain tuples so tests and
// e2e share it. tests/unit/portraitFraming.spec.ts pins the parity.
import { PORTRAIT_CAMERA } from '../constants/animation';
import { TAIL_ROOT } from './tailPath';

export type Vec3 = [number, number, number];

export interface FramingPose {
  position: Vec3;
  lookAt: Vec3;
  // The stored fov names the shared horizontal framing, exactly as in
  // constants/animation: on portrait aspects the on-screen vertical angle widens
  // to preserve it (fittedFov in lib/freeViewCamera is the fitting).
  fov: number;
}

export interface ScreenProjection {
  x: number; // percent across the frame, 0 left → 100 right (Scene's screenPercent)
  y: number; // percent down the frame, 0 top → 100 bottom
  depth: number; // world units along the view axis; negative = behind the camera
}

// The diagonal the whole scene carries in portrait (Scene's group rotation and
// the idle advance vector both read this — one spelling, no drift).
export const PORTRAIT_TILT = Math.PI / 3;

// The frame the long scroll is calibrated against: 390×844, the ticket's named
// size. At this aspect the pinned pose IS the stored constant, bit for bit.
export const PORTRAIT_REFERENCE_ASPECT = 390 / 844;

const UP: Vec3 = [0, 1, 0];

function sub(a: readonly number[], b: readonly number[]): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function dot(a: readonly number[], b: readonly number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: readonly number[], b: readonly number[]): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(v: Vec3): Vec3 {
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
}

// The scene's diagonal: a point in the journey frame lands in world space through
// this rotation (Scene applies it as the group's rotation-z).
export function tiltZ(p: readonly number[], tilt: number): Vec3 {
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
}

// The fitted camera's half-angle tangents. fittedFov keeps the horizontal framing
// of the stored fov: tan(vertical/2) = tan(stored/2) / min(1, aspect), and the
// horizontal follows as tan(vertical/2) · aspect.
function halfAngleTangents(fov: number, aspect: number): { tanH: number; tanV: number } {
  const stored = Math.tan((fov * Math.PI) / 360);
  const tanV = stored / Math.min(1, aspect);
  return { tanH: tanV * aspect, tanV };
}

// Project a journey-frame point through a pose to screen percents — the same
// reading Scene's dev probes write (data-mira-a-screen etc.), so unit tests and
// e2e assertions speak one geometry.
export function projectToScreenPercent(
  point: readonly number[],
  pose: FramingPose,
  aspect: number,
  tilt = 0,
): ScreenProjection {
  const world = tilt === 0 ? (point as Vec3) : tiltZ(point, tilt);
  const forward = norm(sub(pose.lookAt, pose.position));
  const right = norm(cross(forward, UP));
  const up = cross(right, forward);
  const rel = sub(world, pose.position);
  const depth = dot(rel, forward);
  const { tanH, tanV } = halfAngleTangents(pose.fov, aspect);
  return {
    x: ((dot(rel, right) / (depth * tanH) + 1) / 2) * 100,
    y: ((1 - dot(rel, up) / (depth * tanV)) / 2) * 100,
    depth,
  };
}

// A world-radius read as a percent of the screen's height at the point's depth —
// the pair's on-screen disc, for the 顶栏 / 终幕标题 clearance proofs.
export function screenDiscRadiusPercent(
  center: ScreenProjection,
  radius: number,
  pose: FramingPose,
  aspect: number,
): number {
  const { tanV } = halfAngleTangents(pose.fov, aspect);
  return (radius / center.depth / tanV) * 50;
}

// Where the 根 sits in the calibrated composition, as NDC: the pin target.
// Derived from the constants, never restated — retune PORTRAIT_CAMERA.EXPLORE and
// the pin follows. The conversion to view-axis tangents happens per aspect at
// solve time (the vertical tangent is aspect-dependent; the NDC point is not).
function calibratedRootNdc(): { nx: number; ny: number } {
  const pose = PORTRAIT_CAMERA.EXPLORE;
  const projection = projectToScreenPercent(TAIL_ROOT, pose, PORTRAIT_REFERENCE_ASPECT, PORTRAIT_TILT);
  return { nx: projection.x / 50 - 1, ny: 1 - projection.y / 50 };
}

let pinCache: { aspect: number; pose: FramingPose } | null = null;

// The long scroll's explore framing for one aspect: the stored composition with
// the aim re-solved so the 根 holds its calibrated screen point. The solve is a
// two-line Newton on the view direction (below), exact to machine precision at
// any portrait aspect. pinCache is a single-entry memo: the frame loop asks for
// the one aspect currently on screen, so keeping the last solve covers every
// steady visit; a resize simply re-solves once.
export function portraitExplorePose(aspect: number): FramingPose {
  const stored = PORTRAIT_CAMERA.EXPLORE;
  if (aspect === PORTRAIT_REFERENCE_ASPECT || aspect >= 1) {
    // Bit-exact identity at the reference aspect (and a sane constant if a
    // landscape aspect ever arrives here by mistake).
    return {
      position: [...stored.position],
      lookAt: [...stored.lookAt],
      fov: stored.fov,
    };
  }
  if (pinCache && pinCache.aspect === aspect) {
    return {
      position: [...pinCache.pose.position],
      lookAt: [...pinCache.pose.lookAt],
      fov: pinCache.pose.fov,
    };
  }
  const ndc = calibratedRootNdc();
  const { tanH, tanV } = halfAngleTangents(stored.fov, aspect);
  const target = { ax: ndc.nx * tanH, ay: ndc.ny * tanV };
  const rootWorld = tiltZ(TAIL_ROOT, PORTRAIT_TILT);
  const rel = sub(rootWorld, stored.position);
  // Re-aim the view direction so the 根 lands on the target tangents. A 2D Newton
  // solve on (right, up) steps with a numeric Jacobian — the tangent coupling and
  // the depth change make the plain first-order step wander at extreme aspects;
  // this converges to machine precision in a handful of passes, once per aspect.
  const offsets = (f: Vec3) => {
    const right = norm(cross(f, UP));
    const up = cross(right, f);
    const depth = dot(rel, f);
    return { right, up, ax: dot(rel, right) / depth, ay: dot(rel, up) / depth };
  };
  let forward = norm(sub(stored.lookAt, stored.position));
  for (let i = 0; i < 10; i += 1) {
    const { right, up, ax, ay } = offsets(forward);
    const ex = ax - target.ax;
    const ey = ay - target.ay;
    if (Math.hypot(ex, ey) < 1e-12) break;
    const eps = 1e-6;
    const stepR = offsets(norm([forward[0] + eps * right[0], forward[1] + eps * right[1], forward[2] + eps * right[2]]));
    const stepU = offsets(norm([forward[0] + eps * up[0], forward[1] + eps * up[1], forward[2] + eps * up[2]]));
    const jxx = (stepR.ax - ax) / eps;
    const jxy = (stepR.ay - ay) / eps;
    const jyx = (stepU.ax - ax) / eps;
    const jyy = (stepU.ay - ay) / eps;
    const det = jxx * jyy - jxy * jyx;
    const dx = (ex * jyy - ey * jxy) / det;
    const dy = (jxx * ey - jyx * ex) / det;
    forward = norm([
      forward[0] - right[0] * dx - up[0] * dy,
      forward[1] - right[1] * dx - up[1] * dy,
      forward[2] - right[2] * dx - up[2] * dy,
    ]);
  }
  const reach = Math.hypot(...sub(stored.lookAt, stored.position));
  const pose: FramingPose = {
    position: [...stored.position],
    lookAt: [
      stored.position[0] + forward[0] * reach,
      stored.position[1] + forward[1] * reach,
      stored.position[2] + forward[2] * reach,
    ],
    fov: stored.fov,
  };
  pinCache = { aspect, pose };
  return { position: [...pose.position], lookAt: [...pose.lookAt], fov: pose.fov };
}
