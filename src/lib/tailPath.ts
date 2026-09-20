// The tail's occupancy in space: one centerline, one generation envelope, one
// click volume. MiraTail, RiverVeil and Scene all consume this so a bend cannot
// leave the click target and the haze behind.
//
// Particle points follow `tailCenterline` ± `tailSpread`. The veil ribbons keep
// their own (verbatim) offset from that idea — they were never the same curve —
// but the numbers live here. The yaw that presents the tail to the explore
// camera is a fact of the occupancy, not a Scene spelling.

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

// The existing click target the explore camera was calibrated against. The
// derived volume must cover this, so a viewer who could open the card still can.
const LEGACY_CLICK: CenterSize = { position: [-8, 2, 6], size: [12, 8, 2] };

// Calibrated visual haze (explore only). Deriving it from the full generation
// envelope would park it halfway down the 13-light-year wake; the picture was
// tuned on this near-tail anchor. It lives here so a path change has one file
// to update, and daily-sky pixels stay put.
export const TAIL_HAZE = { position: [-6, 1, 4] as Vec3, radius: 5 };

export function tailCenterline(t: number, length: number): Vec3 {
  return [
    -t * length * 0.6,
    Math.sin(t * Math.PI * 0.8) * 2.0,
    t * length * 0.5,
  ];
}

export function tailSpread(t: number): number {
  return 0.3 + t * 3.0;
}

export function yawY(p: Vec3, yaw: number = TAIL_YAW): Vec3 {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
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
  return {
    position: [
      -t * length * 0.56,
      Math.sin(wave) * 2.2 + Math.sin(curl) * t * 0.55 + offset * t * 0.62,
      t * length * 0.62 + offset * t * 1.05,
    ],
    tangent: [
      -length * 0.56,
      Math.cos(wave) * Math.PI * 1.6 + (0.45 * Math.sin(curl) + 2.25 * t * Math.cos(curl)) + offset * 0.45,
      length * 0.62 + offset * 1.05,
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
  return { position: [...LEGACY_CLICK.position], size: [...LEGACY_CLICK.size] };
}

export function tailOccupancy(length: number) {
  return {
    yaw: TAIL_YAW,
    click: tailClickVolume(),
    haze: TAIL_HAZE,
    generation: tailWorldBounds(length),
  };
}
