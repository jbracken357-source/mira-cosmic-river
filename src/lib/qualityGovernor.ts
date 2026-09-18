// Runtime quality governor (#26): adjust the quality tier from sustained frame
// times, with hysteresis and a cooldown so the tier never flaps on short spikes.
//
// The rules, in domain terms (docs/design-audit-2026-09-17/SPEC.md):
//
//   - desktop is effect-first: start from the detected tier and only move when the
//     evidence is sustained — a window of frames is judged by its P75 (a GC pause
//     or a background tab's timer throttle must not count), and a change needs two
//     consecutive windows on the same side of the band;
//   - the band between upFrameMs and downFrameMs is the hysteresis: frame times
//     inside it (a healthy vsync-locked 60fps) reset both streaks and change
//     nothing;
//   - every change steps exactly one tier and starts a cooldown, so a session
//     slides high → mid → low over tens of seconds, never in one jump;
//   - phones are exempt (desktopOnly): the SPEC sets no frame-rate bar for mobile;
//   - an explicit ?quality= is the viewer's own decision and pins the tier: the
//     governor stays off;
//   - frames rendered while the entry gate is still waiting are not evidence:
//     loading and shader compilation dominate them, and under software rendering
//     the load alone would walk the tier off its start before the scene is even
//     presented. The caller feeds frames through driveQualityGovernor, which
//     evaluates nothing until the gate opens.
//
// The descent order "costly post-processing/resolution first, decoration last"
// is not encoded here — it falls out of the tier table in Scene.tsx: high → mid
// cuts ONLY bloom levels and dpr (the star field, the tail and the stream keep
// their full counts); mid → low drops post-processing entirely and only then
// thins the decoration. The governor only ever moves one step along that fixed
// ladder.
import { explicitQualityPin, isMobileSized } from '../constants/quality';
import type { QualityTier } from '../constants/quality';

export interface GovernorConfig {
  downFrameMs: number;   // sustained P75 above this considers a downgrade (~52fps floor)
  upFrameMs: number;     // sustained P75 below this considers an upgrade
  windowMs: number;      // aggregation window
  cooldownMs: number;    // minimum time between two tier changes
  desktopOnly: boolean;  // phones keep their detected tier, no frame-rate bar
  stallFrameMs: number;  // a frame slower than this is a stall, not a measurement
}

export const DEFAULT_GOVERNOR_CONFIG: GovernorConfig = {
  // 19/13 brackets a vsync-locked 60fps (16.7ms): healthy sessions sit inside the
  // band, and a downgrade requires genuinely missing frames, an upgrade genuinely
  // fast ones (high-refresh displays). The 8s cooldown plus two 2s windows bounds
  // the worst-case oscillation to one change per ~12s, far from visible flapping.
  downFrameMs: 19,
  upFrameMs: 13,
  windowMs: 2000,
  cooldownMs: 8000,
  desktopOnly: true,
  // 250ms (~4fps) and slower is rAF starvation — a minimized or fully occluded
  // window stops BeginFrames without always firing visibilitychange, and the
  // occasional frame that still lands carries a delta that says nothing about
  // what the GPU can sustain. Measured on Windows: a minimized headed window
  // kept rendering ~1 frame/s with visibilityState still 'visible'.
  stallFrameMs: 250,
};

export interface GovernorState {
  tier: QualityTier;
  lastChangeAt: number;   // ms clock of the last change; initialisation counts as one
  windowStartAt: number;
  slowWindows: number;    // consecutive windows over downFrameMs
  fastWindows: number;    // consecutive windows under upFrameMs
  samples: number[];      // frame times collected in the current window
}

export type GovernorVerdict =
  | { kind: 'stable'; state: GovernorState }
  | { kind: 'cooldown'; state: GovernorState }
  | { kind: 'change'; state: GovernorState; from: QualityTier; to: QualityTier; reason: 'sustained-slow' | 'sustained-fast' };

// Two consecutive windows on one side of the band before the tier moves.
const WINDOWS_TO_CHANGE = 2;

const TIERS: readonly QualityTier[] = ['high', 'mid', 'low'];

// The timestamp of initialisation doubles as the last change: the first seconds
// of a session carry shader compilation and material uploads, and reacting to
// them would open every visit by punishing the viewer's first look.
export function initialGovernorState(tier: QualityTier, now: number): GovernorState {
  return { tier, lastChangeAt: now, windowStartAt: now, slowWindows: 0, fastWindows: 0, samples: [] };
}

// The frame-feeding entry point the Scene uses. Until the entry gate opens the
// governor does not exist (state stays null and nothing is evaluated); the
// gate-land frame begins it — startup grace counted from that moment — and from
// the next frame on this is exactly evaluateQuality. The gate-land frame itself
// is not fed: it carries the last of the load, not a steady-state measurement.
export function driveQualityGovernor(
  state: GovernorState | null,
  gateOpen: boolean,
  frameMs: number,
  now: number,
  config: GovernorConfig,
  tier: QualityTier,
): { state: GovernorState | null; verdict: GovernorVerdict | null } {
  if (!gateOpen) return { state, verdict: null };
  if (state === null) return { state: initialGovernorState(tier, now), verdict: null };
  const verdict = evaluateQuality(state, frameMs, now, config);
  return { state: verdict.state, verdict };
}

// Shared percentile over an ascending-sorted array (window P75 below, recorder
// stats further down).
function percentile(sorted: number[], q: number): number {
  return sorted[Math.max(0, Math.ceil(sorted.length * q) - 1)];
}

export function evaluateQuality(
  state: GovernorState,
  frameMs: number,
  now: number,
  config: GovernorConfig,
): GovernorVerdict {
  // A stall is not evidence: the frame took that long because the loop was
  // starved, not because the scene is expensive. Leave the window and the
  // streaks untouched; the pre-stall samples still count when the loop resumes.
  if (frameMs > config.stallFrameMs) {
    return { kind: 'stable', state };
  }
  const samples = [...state.samples, frameMs];
  if (now - state.windowStartAt < config.windowMs) {
    return { kind: 'stable', state: { ...state, samples } };
  }

  // The window is settled by the frame that arrives after it expired — possibly
  // the only frame in it (a heavily throttled machine renders slower than the
  // window is long). A window with no frames at all never settles, because this
  // function is only ever fed by a rendered frame; background resume is handled
  // by the caller resetting the state, not by judging stale samples.
  const typical = percentile([...samples].sort((a, b) => a - b), 0.75);
  let { slowWindows, fastWindows } = state;
  if (typical > config.downFrameMs) {
    slowWindows += 1;
    fastWindows = 0;
  } else if (typical < config.upFrameMs) {
    fastWindows += 1;
    slowWindows = 0;
  } else {
    // Inside the hysteresis band: neither side may build a streak.
    slowWindows = 0;
    fastWindows = 0;
  }

  const settled: GovernorState = { ...state, samples: [], windowStartAt: now, slowWindows, fastWindows };
  const index = TIERS.indexOf(state.tier);
  const direction =
    slowWindows >= WINDOWS_TO_CHANGE && index < TIERS.length - 1
      ? 1
      : fastWindows >= WINDOWS_TO_CHANGE && index > 0
        ? -1
        : 0;

  if (direction === 0) return { kind: 'stable', state: settled };
  if (now - state.lastChangeAt < config.cooldownMs) return { kind: 'cooldown', state: settled };

  const to = TIERS[index + direction];
  return {
    kind: 'change',
    state: { ...settled, tier: to, lastChangeAt: now, slowWindows: 0, fastWindows: 0 },
    from: state.tier,
    to,
    reason: direction === 1 ? 'sustained-slow' : 'sustained-fast',
  };
}

export type GovernorSetupReason = 'pinned' | 'mobile' | 'desktop';

export interface GovernorSetup {
  enabled: boolean;
  reason: GovernorSetupReason;
}

export function resolveGovernorSetup(
  env: { qualityQuery: string | null; innerWidth: number; innerHeight: number },
  config: GovernorConfig = DEFAULT_GOVERNOR_CONFIG,
): GovernorSetup {
  // An explicit ?quality= is a decision, not a starting point: pinning wins.
  if (explicitQualityPin(env.qualityQuery) !== null) return { enabled: false, reason: 'pinned' };
  if (config.desktopOnly && isMobileSized(env.innerWidth, env.innerHeight)) {
    return { enabled: false, reason: 'mobile' };
  }
  return { enabled: true, reason: 'desktop' };
}

export interface ResolvedGovernorSetup extends GovernorSetup {
  config: GovernorConfig;
  // Dev-only ?quality-start= picks the governor's opening tier WITHOUT pinning it,
  // so e2e can watch an upgrade (the auto-detected tier on a desktop is always high).
  startTier: QualityTier | null;
}

let cachedSetup: ResolvedGovernorSetup | null = null;

// The query string cannot change without a reload, so resolve once (same pattern as
// resolveQualityTier / idleTiming). The ?quality-window / ?quality-cooldown /
// ?quality-start overrides are dev-only and drop out of production bundles.
export function governorSetup(): ResolvedGovernorSetup {
  if (cachedSetup === null) {
    let config = DEFAULT_GOVERNOR_CONFIG;
    let startTier: QualityTier | null = null;
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    if (params !== null && !import.meta.env.PROD) {
      const read = (key: string, fallback: number) => {
        const raw = params.get(key);
        if (raw === null) return fallback;
        const value = Number(raw);
        return Number.isFinite(value) && value > 0 ? value : fallback;
      };
      config = {
        ...config,
        windowMs: read('quality-window', config.windowMs),
        cooldownMs: read('quality-cooldown', config.cooldownMs),
      };
      startTier = explicitQualityPin(params.get('quality-start'));
    }
    const env = {
      qualityQuery: params?.get('quality') ?? null,
      innerWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
      innerHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
    };
    const base = resolveGovernorSetup(env, config);
    cachedSetup = { ...base, config, startTier: base.enabled ? startTier : null };
  }
  return cachedSetup;
}

let cachedProbe: number | null | undefined;

// Dev-only synthetic frame time (?quality-probe=slow|fast|steady), fed to the
// governor in place of the real delta so e2e can reach the slow/fast rules
// deterministically under software rendering. Gated like ?epoch=.
export function governorProbeFrameMs(): number | null {
  if (cachedProbe === undefined) {
    cachedProbe = null;
    if (typeof window !== 'undefined' && !import.meta.env.PROD) {
      const probe = new URLSearchParams(window.location.search).get('quality-probe');
      if (probe === 'slow') cachedProbe = 40;
      else if (probe === 'fast') cachedProbe = 8;
      else if (probe === 'steady') cachedProbe = 16;
    }
  }
  return cachedProbe;
}

export interface QualityChangeEvent {
  at: number; // ms since navigation start
  from: QualityTier;
  to: QualityTier;
  reason: 'sustained-slow' | 'sustained-fast';
}

export interface ResourceSample {
  at: number;
  tier: QualityTier;
  dpr: number;
  width: number;
  height: number;
  geometries: number;
  textures: number;
  heapBytes: number | null; // performance.memory is Chrome-only; null elsewhere
}

// The long-run recorder the SPEC asks for (真实 GPU 记录质量切换、帧时间、资源变化):
// a fixed-size ring of frame times plus every tier change and periodic resource
// samples, readable from devtools and measurement scripts as window.__miraQuality.
// Always on — observing is part of the deliverable; only the injection probes
// above are dev-gated. One array write per frame, no DOM work.
export interface QualityRecorder {
  noteFrame(frameMs: number): void;
  noteChange(event: QualityChangeEvent): void;
  noteResources(sample: ResourceSample): void;
  readonly changes: QualityChangeEvent[];
  readonly resources: ResourceSample[];
  frameCount(): number;
  // `slowOver25` counts frames past 25ms (under 40fps): the stutter line the SPEC
  // asks long-run recordings to report.
  frameStats(): { count: number; mean: number; p50: number; p75: number; p95: number; max: number; slowOver25: number } | null;
}

export function createQualityRecorder(capacity = 8192): QualityRecorder {
  const ring = new Float64Array(capacity);
  let written = 0;
  const changes: QualityChangeEvent[] = [];
  const resources: ResourceSample[] = [];
  return {
    changes,
    resources,
    noteFrame(frameMs) {
      ring[written % capacity] = frameMs;
      written += 1;
    },
    noteChange(event) {
      changes.push(event);
    },
    noteResources(sample) {
      resources.push(sample);
    },
    frameCount() {
      return written;
    },
    frameStats() {
      const count = Math.min(written, capacity);
      if (count === 0) return null;
      const values = Array.from(ring.slice(0, count)).sort((a, b) => a - b);
      const mean = values.reduce((sum, v) => sum + v, 0) / count;
      const slowOver25 = values.filter((v) => v > 25).length;
      return {
        count,
        mean,
        p50: percentile(values, 0.5),
        p75: percentile(values, 0.75),
        p95: percentile(values, 0.95),
        max: values[count - 1],
        slowOver25,
      };
    },
  };
}

let cachedRecorder: QualityRecorder | null = null;

export function qualityRecorder(): QualityRecorder {
  if (cachedRecorder === null) {
    cachedRecorder = createQualityRecorder();
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__miraQuality = cachedRecorder;
    }
  }
  return cachedRecorder;
}

