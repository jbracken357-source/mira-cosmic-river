// The tail's occupancy in space: one centerline, one generation envelope, one
// click volume. MiraTail, RiverVeil and Scene all consume this so a bend cannot
// leave the click target and the haze behind.
//
// Particle points follow `tailCenterline` ± `tailSpread`. The veil ribbons keep
// their own (verbatim) offset from that idea — they were never the same curve —
// but the numbers live here. The yaw that presents the tail to the explore
// camera is a fact of the occupancy, not a Scene spelling.
//
// #91: the tail springs from between the two stars — its root (根) sits on the
// home A→B axis just outside the giant's breathing photosphere, in the gap (空隙)
// the pair keep between them. A soft bend returns the centerline to the legacy
// wake within the first quarter of the path (the mid-stretch passes behind the
// giant on the way; the road reads as wrapping it), so the far composition, the
// heading, the click volume and the haze are untouched. The near cone widens over
// the same window (近处有气): mist surrounds the pair at the road's start without
// plugging the gap.
import { calculateOrbitalPosition, PHYSICS } from '../constants/physics';
import { MIRA_A_PULSE_AMPLITUDE } from './binaryLighting';

export type Vec3 = [number, number, number];

export interface Box3 {
  min: Vec3;
  max: Vec3;
}

export interface CenterSize {
  position: Vec3;
  size: Vec3;
}

export const TAIL_YAW = Math.PI * 0.12;

// 根 (the root, #91): where the road springs from — on the home A→B axis, just
// past the giant's breathing photosphere, in the space between the two stars. The
// first calibration took the pair's home midpoint, which sits 1.86–2.06 units
// from the giant's centre at every orbit phase — inside the opaque sphere of
// radius 2.5 (±9% pulse), so the root's gas rendered nowhere and the visible road
// still sprang from the giant's limb. Placing the root at the pulse-peak radius
// plus a clearance keeps it outside the sphere at every phase (the giant wobbles
// on a 0.1-radius circle; the clearance covers that too), while staying in the
// gap before the companion. The root is fixed in the journey frame and rides the
// shared journey (共同前行); the companion's visible orbit moves around it.
const PAIR_HOME = calculateOrbitalPosition(0, PHYSICS.ORBIT);
// The breathing limb at maximum swell: the photosphere's radius plus its pulse
// amplitude (shaders/miraA's radiusPulse), so the root never dips inside the
// sphere even at the bright end of the cycle.
const GIANT_LIMB =
  PHYSICS.MIRA_A.radius * (1 + MIRA_A_PULSE_AMPLITUDE);
// Room for the giant's own wobble (a 0.1-radius circle) and the root cone's mist
// to read as springing AT the limb rather than from inside it.
const ROOT_CLEARANCE = 0.2;
const HOME_AXIS_LENGTH = Math.hypot(
  PAIR_HOME.companion[0] - PAIR_HOME.primary[0],
  PAIR_HOME.companion[1] - PAIR_HOME.primary[1],
  PAIR_HOME.companion[2] - PAIR_HOME.primary[2],
);
export const TAIL_ROOT: Vec3 = [
  PAIR_HOME.primary[0] +
    ((PAIR_HOME.companion[0] - PAIR_HOME.primary[0]) / HOME_AXIS_LENGTH) *
      (GIANT_LIMB + ROOT_CLEARANCE),
  PAIR_HOME.primary[1] +
    ((PAIR_HOME.companion[1] - PAIR_HOME.primary[1]) / HOME_AXIS_LENGTH) *
      (GIANT_LIMB + ROOT_CLEARANCE),
  PAIR_HOME.primary[2] +
    ((PAIR_HOME.companion[2] - PAIR_HOME.primary[2]) / HOME_AXIS_LENGTH) *
      (GIANT_LIMB + ROOT_CLEARANCE),
];

// How far down the path the root's bend reaches (a fraction of the tail): within
// this window the centerline eases from the root back onto the legacy wake, so the
// far composition and the heading (去向) never move.
export const TAIL_ROOT_FADE = 0.22;

// The root cone's extra width (近处有气): enough for mist to wrap the pair's region,
// soft enough that the gap between the two stars stays visible.
export const TAIL_ROOT_SPREAD = 0.9;

// How far along the tail the particles fade in (aLength fraction). The fade must
// complete while the path is still in the open gap (the centerline ducks behind
// the giant from roughly t=0.03): at 0.07 the root's gas was still near-zero
// alpha where it was actually visible. 0.03 puts the fade's shoulder at the limb,
// so the mist between the two stars reads from the first beat.
export const TAIL_FADE_IN = 0.03;

// Where the far fade's window starts (aLength fraction): alpha eases out across
// the last stretch so the road dissolves into the starfield instead of ending in
// a hard edge. The landscape window, unchanged since the tail's first frame.
export const TAIL_FAR_FADE = 0.85;

// 竖屏长卷 (#92 review): in the tall frame the road's far reach IS the lower
// half's foreground, so the portrait fade eases later — aLength scaled by 0.93
// keeps the mist nearly full to t≈0.91 and lands it softly (alpha ≈ 0.45) at the
// far end instead of vanishing across the last sixth of the tail. Landscape
// binds the identity 1, bit-exact.
export const PORTRAIT_FAR_FADE_SCALE = 0.93;

// The river veil ribbons' own far fade, in vUv.x (their uv runs tail-ward: the
// far end is vUv.x 0). The ribbon's far tip is a geometric cut, so unlike the
// points — whose portrait fade never quite reaches zero — the veil must still
// fade TO zero at the tip or the cut shows as a hard edge. The same portrait
// intent as PORTRAIT_FAR_FADE_SCALE, in the veil's own vocabulary: the window
// halves, so the ribbon's body accompanies the points deeper into the tall
// frame (fade start t 0.92 → 0.96) and still dissolves before the cut.
// Landscape binds VEIL_FAR_SPAN, bit-exact.
export const VEIL_FAR_SPAN = 0.08;
export const PORTRAIT_VEIL_FAR_SPAN = 0.04;

// The mid-road probe anchor (#92 review): the point the portrait assertions read
// for the river's VISIBLE reach — deep inside the strong-alpha body (the far
// fade only starts past t=0.85 even unscaled), never the far end, whose own
// alpha is zero. t=0.7 sits in the lower half of the long scroll at both named
// portrait sizes.
export const TAIL_MID_PROBE_T = 0.7;

// The mid-road anchor in the journey frame's world orientation (the yaw
// applied), anchored like tailFarEnd so the probe rides the shared journey.
export function tailMidProbe(length: number): Vec3 {
  return yawY(tailCenterline(TAIL_MID_PROBE_T, length));
}

// smoothstep(0, TAIL_ROOT_FADE, t), the bend's falloff shape.
function rootFade(t: number): number {
  const s = Math.min(1, Math.max(0, t / TAIL_ROOT_FADE));
  return s * s * (3 - 2 * s);
}

// The offset that carries the centerline from the root back onto the legacy path:
// full at t=0, gone by TAIL_ROOT_FADE, smooth (zero slope) at both ends.
export function tailRootBend(t: number): Vec3 {
  const w = 1 - rootFade(t);
  return [TAIL_ROOT[0] * w, TAIL_ROOT[1] * w, TAIL_ROOT[2] * w];
}

// The bend's derivative, for the veil ribbons' tangents (the ribbons orient their
// cross-section by the tangent; a bend they ignore would twist them near the root).
function tailRootBendDerivative(t: number): Vec3 {
  if (t <= 0 || t >= TAIL_ROOT_FADE) return [0, 0, 0];
  const s = t / TAIL_ROOT_FADE;
  const dw = (-6 * s * (1 - s)) / TAIL_ROOT_FADE;
  return [TAIL_ROOT[0] * dw, TAIL_ROOT[1] * dw, TAIL_ROOT[2] * dw];
}

// The existing click target the explore camera was calibrated against. The
// derived volume must cover this, so a viewer who could open the card still can.
const LEGACY_CLICK: CenterSize = { position: [-8, 2, 6], size: [12, 8, 2] };

// Calibrated visual haze (explore only). Deriving it from the full generation
// envelope would park it halfway down the 13-light-year wake; the picture was
// tuned on this near-tail anchor. It lives here so a path change has one file
// to update, and daily-sky pixels stay put.
export const TAIL_HAZE = { position: [-6, 1, 4] as Vec3, radius: 5 };

export function tailCenterline(t: number, length: number): Vec3 {
  const bend = tailRootBend(t);
  return [
    -t * length * 0.6 + bend[0],
    Math.sin(t * Math.PI * 0.8) * 2.0 + bend[1],
    t * length * 0.5 + bend[2],
  ];
}

export function tailSpread(t: number): number {
  // The legacy cone, plus the root's extra reach over the same fade window.
  return 0.3 + t * 3.0 + TAIL_ROOT_SPREAD * (1 - rootFade(t));
}

// 去向 (the heading): the direction the pair travels in free viewing (#86). The
// tail is the wake they leave behind, so the heading is the far end of the same
// centerline read backwards, in world space (the yaw the explore camera sees).
// Derived from the path, never hardcoded — bending the tail bends the heading.
export function tailHeading(length: number): Vec3 {
  const far = yawY(tailCenterline(1, length));
  const n = Math.hypot(far[0], far[1], far[2]);
  return [-far[0] / n, -far[1] / n, -far[2] / n];
}

export function yawY(p: Vec3, yaw: number = TAIL_YAW): Vec3 {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}

// The road's far end in the journey frame's world orientation (the yaw applied).
// Scene projects it as the parallax probe anchor (#91): it sits much closer to the
// explore camera than the pair, so a drag or a zoom separates it from the stars.
export function tailFarEnd(length: number): Vec3 {
  return yawY(tailCenterline(1, length));
}

export function veilRibbon(
  t: number,
  length: number,
  index: number,
  count: number,
): { position: Vec3; tangent: Vec3 } {
  const offset = index - (count - 1) / 2;
  const wave = t * Math.PI * 0.8;
  const curl = t * 5 + index * 0.7;
  // The ribbons share the root bend: the road's body springs from between the pair
  // too, and its tangent follows the bend so the cross-sections don't twist.
  const bend = tailRootBend(t);
  const bendSlope = tailRootBendDerivative(t);
  return {
    position: [
      -t * length * 0.56 + bend[0],
      Math.sin(wave) * 2.2 + Math.sin(curl) * t * 0.55 + offset * t * 0.62 + bend[1],
      t * length * 0.62 + offset * t * 1.05 + bend[2],
    ],
    tangent: [
      -length * 0.56 + bendSlope[0],
      Math.cos(wave) * Math.PI * 1.6 + (0.45 * Math.sin(curl) + 2.25 * t * Math.cos(curl)) + offset * 0.45 + bendSlope[1],
      length * 0.62 + offset * 1.05 + bendSlope[2],
    ],
  };
}

export function veilSide(t: number, accent: boolean, uvY: number): number {
  return (uvY - 0.5) * (accent ? 5.5 + t * 5 : 7 + t * 7);
}

function emptyBox(): Box3 {
  return { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
}

function expand(box: Box3, p: Vec3): void {
  for (let i = 0; i < 3; i += 1) {
    if (p[i] < box.min[i]) box.min[i] = p[i];
    if (p[i] > box.max[i]) box.max[i] = p[i];
  }
}

export function boxFromCenterSize(cs: CenterSize): Box3 {
  return {
    min: [
      cs.position[0] - cs.size[0] / 2,
      cs.position[1] - cs.size[1] / 2,
      cs.position[2] - cs.size[2] / 2,
    ],
    max: [
      cs.position[0] + cs.size[0] / 2,
      cs.position[1] + cs.size[1] / 2,
      cs.position[2] + cs.size[2] / 2,
    ],
  };
}

export function boxContains(outer: Box3, inner: Box3): boolean {
  return (
    outer.min[0] <= inner.min[0] &&
    outer.max[0] >= inner.max[0] &&
    outer.min[1] <= inner.min[1] &&
    outer.max[1] >= inner.max[1] &&
    outer.min[2] <= inner.min[2] &&
    outer.max[2] >= inner.max[2]
  );
}

// Local AABB of the particle cone: centerline ± spread in y and z (the disk
// the points fill), x on the centerline.
export function tailGenerationBounds(length: number, samples = 32): Box3 {
  const box = emptyBox();
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const [cx, cy, cz] = tailCenterline(t, length);
    const s = tailSpread(t);
    expand(box, [cx, cy - s, cz - s]);
    expand(box, [cx, cy + s, cz + s]);
  }
  return box;
}

export function tailWorldBounds(length: number): Box3 {
  const local = tailGenerationBounds(length);
  const box = emptyBox();
  const xs = [local.min[0], local.max[0]];
  const ys = [local.min[1], local.max[1]];
  const zs = [local.min[2], local.max[2]];
  for (const x of xs) {
    for (const y of ys) {
      for (const z of zs) expand(box, yawY([x, y, z]));
    }
  }
  return box;
}

export function tailClickVolume(): CenterSize {
  // The calibrated slab, not the generation AABB. The cone runs from the origin
  // to the far wake; an AABB around that swallows Mira A and steals its ray.
  // Covering the existing target is the occupancy contract; bending the path
  // updates generation bounds here so the mismatch is visible in one file.
  return LEGACY_CLICK;
}

// Stable occupancy Scene consumes. Computing generation bounds on every render
// allocated a new click/haze identity and rebuilt the (invisible) box geometry
// each frame — enough to make two frozen visits disagree on CI software GL.
export const TAIL_OCCUPANCY = {
  yaw: TAIL_YAW,
  click: LEGACY_CLICK,
  haze: TAIL_HAZE,
} as const;

export function tailOccupancy(length: number) {
  return {
    ...TAIL_OCCUPANCY,
    generation: tailWorldBounds(length),
  };
}
