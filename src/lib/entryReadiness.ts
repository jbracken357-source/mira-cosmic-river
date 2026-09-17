// Entry readiness (#24): the pure decisions behind a resilient entry.
//
// The full cinematic may start only once the main materials — or a meaningful
// procedural fallback — can actually be presented. Loads that hang are bounded
// by MATERIALS_TIMEOUT_MS: a slow network or a 404 settles the gate on the
// fallback path instead of holding the opening forever.
//
// This module is pure: no DOM, no timers, no THREE. The store hook
// (src/hooks/useEntryReadiness.ts) feeds it real events; Scene reads the gate
// before letting the cinematic clock move.

export type MaterialName = 'river' | 'surface';

// pending: still loading within the budget. ready: the texture is bound.
// failed: the load errored (404 etc.) — the procedural path is active.
// timed-out: the load outlasted the budget — treated as the fallback path;
// a texture that still arrives later simply fades in over it.
export type MaterialState = 'pending' | 'ready' | 'failed' | 'timed-out';

export interface MaterialSet {
  river: MaterialState;
  surface: MaterialState;
}

// How the scene can be entered. waiting: nothing presentable yet.
// materials: every main material is textured. fallback: at least one material
// failed or timed out — the procedural river and convection carry the scene.
export type EntryGate = 'waiting' | 'materials' | 'fallback';

// Whether this page load can show the live scene at all. unavailable: WebGL
// context creation failed or was never possible — the static fallback covers
// the screen and only a retry (reload) leaves it. lost: the context dropped
// after creation; a restore event returns to available exactly once per loss.
export type SceneAccess = 'available' | 'unavailable' | 'lost';

export type SceneAccessEvent = 'context-lost' | 'context-restored' | 'create-failed';

// Long enough for a slow-but-alive connection, short enough that a hung request
// never reads as an infinite wait. Bounded by the unit tests on both ends.
export const MATERIALS_TIMEOUT_MS = 5000;

export function initialMaterials(): MaterialSet {
  return { river: 'pending', surface: 'pending' };
}

// Settled states are sticky: the opening may already have started on the
// fallback, and a late texture must not rewrite the recorded reason.
export function noteMaterial(
  set: MaterialSet,
  name: MaterialName,
  outcome: 'ready' | 'failed',
): MaterialSet {
  if (set[name] !== 'pending') return set;
  return { ...set, [name]: outcome };
}

export function timeoutMaterials(set: MaterialSet): MaterialSet {
  const next = { ...set };
  for (const name of Object.keys(next) as MaterialName[]) {
    if (next[name] === 'pending') next[name] = 'timed-out';
  }
  return next;
}

export function resolveEntryGate(set: MaterialSet): EntryGate {
  const states = [set.river, set.surface];
  if (states.some((state) => state === 'pending')) return 'waiting';
  return states.every((state) => state === 'ready') ? 'materials' : 'fallback';
}

export function gateAllowsCinematic(gate: EntryGate): boolean {
  return gate !== 'waiting';
}

// WebGL availability as an injectable decision: the caller hands in the probe
// (in the browser, "create a canvas and ask for a context"), this decides.
// A throwing probe is a refusal, never an exception to the caller.
export function probeWebGLSupport(probe: () => unknown): 'available' | 'unavailable' {
  try {
    return probe() ? 'available' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export function detectWebGLSupport(): 'available' | 'unavailable' {
  if (typeof window === 'undefined') return 'available';
  return probeWebGLSupport(() => {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  });
}

export function reduceSceneAccess(state: SceneAccess, event: SceneAccessEvent): SceneAccess {
  switch (event) {
    case 'context-lost':
      return state === 'available' ? 'lost' : state;
    case 'context-restored':
      // Restore answers exactly one loss — a stray event changes nothing, so
      // recovery can never re-register what was never torn down.
      return state === 'lost' ? 'available' : state;
    case 'create-failed':
      return 'unavailable';
  }
}
