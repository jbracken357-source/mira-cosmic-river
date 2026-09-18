// Capture mode: the dev-only switch behind reproducible screenshot baselines
// (docs/design-audit-2026-09-17/tickets/01-river.md).
//
// `?capture=1` freezes the scene into one fixed moment so two captures of the same URL
// are pixel-identical:
//
//   - the star clock is pinned (to `?epoch=` when given, else CAPTURE_EPOCH_ISO), so
//     tonight's Mira is the same Mira in every run;
//   - every time-driven uniform (uTime accumulation, twinkle phases, stream flow, the
//     decorative orbit) is parked at CAPTURE_TIME, one fixed animation phase;
//   - OrbitControls auto-rotate and damping switch off, mouse influence drops to zero;
//   - the run starts from direct entry — the full cinematic belongs to the ritual moment —
//     unless `?cinematic-t=<ms>` is also given, which freezes the opening at that instant
//     (opening phase captures; the pose comes from lib/openingTimeline, so it is
//     deterministic frame for frame);
//   - `?cam=default|near|az90|az180|az270` parks the camera at a named pose, re-applied
//     every frame so nothing can drift.
//
// Like `?epoch=`, the mode is gated by import.meta.env.PROD and drops out of production
// bundles. With the params absent nothing changes: captureMode().active is false and
// every call site takes its normal path.
// The baseline date. Matches the epoch the existing visual-evidence scripts pinned, so
// old and new evidence show the same sky.
export const CAPTURE_EPOCH_ISO = '2026-09-12T00:00:00Z';

// The fixed animation phase, in the same seconds each component accumulates into its
// uTime. Non-zero so shaders sit mid-motion rather than at a possibly degenerate t=0.
export const CAPTURE_TIME = 8;

type Vec3 = [number, number, number];

export interface CapturePose {
  position: Vec3;
  lookAt: Vec3;
  fov: number;
}

export interface CaptureMode {
  active: boolean;
  camera: string;
  // Milliseconds into the full cinematic, or null for the usual direct entry. Only
  // honored while capture mode is active.
  cinematicT: number | null;
}

let cached: CaptureMode | null = null;

export function captureMode(): CaptureMode {
  if (cached === null) {
    let active = false;
    let camera = 'default';
    let cinematicT: number | null = null;
    if (typeof window !== 'undefined' && !import.meta.env.PROD) {
      const params = new URLSearchParams(window.location.search);
      active = params.get('capture') === '1';
      camera = params.get('cam') ?? 'default';
      const rawT = params.get('cinematic-t');
      const parsed = rawT === null ? NaN : Number(rawT);
      if (Number.isFinite(parsed) && parsed >= 0) cinematicT = parsed;
    }
    cached = { active, camera, cinematicT };
  }
  return cached;
}

// Advance one uTime-style accumulator by a frame. Capture mode pins every phase at
// CAPTURE_TIME; otherwise time accrues only while motion is allowed, the viewer has
// not paused the scene, and the tab is visible, clamped so a background tab's long
// frame cannot lurch the scene. `scale` covers callers whose clock runs slower than
// wall time (the orbital mechanics). The real-time star clock is untouched — it
// keeps its own source in lib/starClock.
// The pause policy lives here with the rest of the clock policy, so a new pause
// source means editing this file, not every call site. The store registers itself
// (it already imports this module; importing it back would cycle).
let pauseSource: () => boolean = () => false;

export function registerPauseSource(source: () => boolean) {
  pauseSource = source;
}

export function advanceTime(
  current: number,
  delta: number,
  { reduceMotion, scale = 1, paused }: { reduceMotion: boolean; scale?: number; paused?: boolean },
): number {
  if (captureMode().active) return CAPTURE_TIME;
  const isPaused = paused ?? pauseSource();
  if (!reduceMotion && !isPaused && !document.hidden) return current + Math.min(delta, .05) * scale;
  return current;
}

// The wall-clock-driven variant (the StarField twinkle reads the shared clock rather
// than accumulating): capture mode parks it at the same fixed phase.
export function captureClock(elapsed: number): number {
  return captureMode().active ? CAPTURE_TIME : elapsed;
}

// Rotate a camera position around its look-at on the ground plane (Y-up), so the rotated
// azimuths keep the explore framing's height and distance.
function rotateAroundLookAt(position: Vec3, lookAt: Vec3, radians: number): Vec3 {
  const dx = position[0] - lookAt[0];
  const dz = position[2] - lookAt[2];
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [
    lookAt[0] + dx * cos + dz * sin,
    position[1],
    lookAt[2] - dx * sin + dz * cos,
  ];
}

// Resolve a named preset against the explore framing of the current orientation, so
// portrait baselines rotate around the portrait composition rather than the desktop one.
export function resolveCapturePose(name: string, base: CapturePose): CapturePose {
  switch (name) {
    case 'near': {
      // Partway in toward the pair: the stars fill more of the frame without losing the tail.
      const t = 0.45;
      return {
        position: [
          base.lookAt[0] + (base.position[0] - base.lookAt[0]) * t,
          base.lookAt[1] + (base.position[1] - base.lookAt[1]) * t,
          base.lookAt[2] + (base.position[2] - base.lookAt[2]) * t,
        ],
        lookAt: base.lookAt,
        fov: base.fov,
      };
    }
    case 'az90':
      return { ...base, position: rotateAroundLookAt(base.position, base.lookAt, Math.PI / 2) };
    case 'az180':
      return { ...base, position: rotateAroundLookAt(base.position, base.lookAt, Math.PI) };
    case 'az270':
      return { ...base, position: rotateAroundLookAt(base.position, base.lookAt, (3 * Math.PI) / 2) };
    default:
      return base;
  }
}
