// Viewer control rules: who owns the camera and when the idle takeover is allowed.
//
// One shared clock — the last intentional input (drag, wheel, touch, key, control
// presses; never mousemove, never the auto camera itself) — feeds both thresholds:
// 30s idle resumes the slow auto rotation over a ~3s ramp, 60s idle allows the
// epilogue (the closing camera leads the text by TRANSITIONS.CLOSING_CAMERA).
//
// Priority, highest first: capture mode > full cinematic > manual pause >
// background / reading a card / saving tonight's frame > free exploration. While
// any hold is active (`holdsIdle`) the caller restamps the clock, so the idle run
// restarts from zero when the hold ends instead of triggering a backlog takeover.
// Ticket #23 adds its saving hold as one more flag on ViewerHolds and one line in
// collectViewerHolds — no rule changes.
//
// Reduced motion is not a hold: it suppresses the idle CAMERA takeover (no auto
// drift, no closing flight) but the idle clock keeps counting and the epilogue text
// is still allowed at the 60s mark — it fades in place, no camera motion.
import { TRANSITIONS } from '../constants/animation';
import { captureMode } from './captureMode';

// OrbitControls speed once the ramp completes (the pre-existing drift rate).
export const AUTO_ROTATE_SPEED = 0.3;

export interface IdleTiming {
  resumeMs: number;        // idle before the auto camera starts ramping back
  rampMs: number;          // ramp duration, 0 → full speed
  epilogueMs: number;      // idle before the epilogue text may appear
  epilogueLeadMs: number;  // how far ahead of the text the closing camera starts
}

export const DEFAULT_IDLE_TIMING: IdleTiming = {
  resumeMs: 30_000,
  rampMs: 3_000,
  epilogueMs: 60_000,
  epilogueLeadMs: TRANSITIONS.CLOSING_CAMERA * 1000,
};

export interface ViewerHolds {
  captureActive: boolean;
  cinematicActive: boolean;
  manualPause: boolean;
  background: boolean;
  readingCard: boolean;
  saving: boolean;
  reduceMotion: boolean;
}

export type AutoCameraState = 'off' | 'ramping' | 'on';

export type ViewerControlReason =
  | 'capture'
  | 'cinematic'
  | 'manual-pause'
  | 'background'
  | 'reading-card'
  | 'saving'
  | 'reduced-motion'
  | 'epilogue'
  | 'idle';

export interface ViewerControl {
  autoCamera: AutoCameraState;
  autoRotateSpeed: number; // eased, 0 → AUTO_ROTATE_SPEED across the ramp
  rampProgress: number;    // raw 0..1 while ramping
  epilogueCamera: boolean;
  epilogueText: boolean;
  holdsIdle: boolean;      // while true the caller keeps restamping the clock
  reason: ViewerControlReason;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function held(reason: ViewerControlReason): ViewerControl {
  return {
    autoCamera: 'off',
    autoRotateSpeed: 0,
    rampProgress: 0,
    epilogueCamera: false,
    epilogueText: false,
    holdsIdle: true,
    reason,
  };
}

export function resolveViewerControl(
  now: number,
  lastIntentionalInputAt: number,
  holds: ViewerHolds,
  timing: IdleTiming = DEFAULT_IDLE_TIMING,
): ViewerControl {
  if (holds.captureActive) return held('capture');
  if (holds.cinematicActive) return held('cinematic');
  if (holds.manualPause) return held('manual-pause');
  if (holds.background) return held('background');
  if (holds.readingCard) return held('reading-card');
  if (holds.saving) return held('saving');

  const idleMs = Math.max(0, now - lastIntentionalInputAt);
  const epilogueText = idleMs >= timing.epilogueMs;

  // Reduced motion holds the camera only: no drift, no closing flight, but the
  // epilogue text still arrives on the same idle count.
  if (holds.reduceMotion) {
    return { ...held('reduced-motion'), holdsIdle: false, epilogueText };
  }

  // A lead longer than the epilogue threshold would arm the closing camera before
  // any idle time; collapse to camera-with-text instead of going negative.
  const cameraAt =
    timing.epilogueMs > timing.epilogueLeadMs ? timing.epilogueMs - timing.epilogueLeadMs : timing.epilogueMs;
  const epilogueCamera = idleMs >= cameraAt;

  // Where the drift would be on its 3s ease-in, epilogue or not — the fade below
  // multiplies it down so the hand-off never snaps.
  const rampProgress = Math.min(1, Math.max(0, (idleMs - timing.resumeMs) / timing.rampMs));
  const rampSpeed = AUTO_ROTATE_SPEED * easeInOutCubic(rampProgress);

  if (epilogueCamera) {
    // Symmetric to the ease-in: the drift eases out over one ramp window as the
    // closing camera takes over, rather than halting at the arm point.
    const fade = Math.min(1, (idleMs - cameraAt) / timing.rampMs);
    const speed = rampSpeed * (1 - easeInOutCubic(fade));
    return {
      autoCamera: speed > 0 ? 'ramping' : 'off',
      autoRotateSpeed: speed,
      rampProgress,
      epilogueCamera,
      epilogueText,
      holdsIdle: false,
      reason: 'epilogue',
    };
  }

  if (idleMs < timing.resumeMs) {
    return { ...held('idle'), holdsIdle: false };
  }
  return {
    autoCamera: rampProgress >= 1 ? 'on' : 'ramping',
    autoRotateSpeed: rampSpeed,
    rampProgress,
    epilogueCamera,
    epilogueText,
    holdsIdle: false,
    reason: 'idle',
  };
}

// Everything the assembled verdict needs from the store: the four hold fields plus
// the shared idle clock. Narrower than the store itself, so tests pass a plain
// object and call sites pass their snapshot unchanged.
export interface ViewerControlSnapshot {
  introComplete: boolean;
  isPlaying: boolean;
  cardOpen: boolean;
  tonightSaveOpen: boolean;
  lastIntentionalInputAt: number;
}

// The assembled verdict from a whole store snapshot — one call instead of the
// four-input assembly (now, clock, holds, timing) that used to be spelled out, word
// for word, at every caller. The frame loop is the epilogue's only clock-driven
// writer, so this is the single place that assembly lives.
export function viewerControlNow(
  state: ViewerControlSnapshot,
  reduceMotion: boolean,
  timing: IdleTiming = idleTiming(),
): ViewerControl {
  return resolveViewerControl(
    Date.now(),
    state.lastIntentionalInputAt,
    collectViewerHolds(state, reduceMotion),
    timing,
  );
}

// Snapshot the current holds from the store fields plus the environment. Adding a
// hold (saving, #23) means one flag here and one line below.
function collectViewerHolds(
  state: { introComplete: boolean; isPlaying: boolean; cardOpen: boolean; tonightSaveOpen: boolean },
  reduceMotion: boolean,
): ViewerHolds {
  return {
    captureActive: captureMode().active,
    cinematicActive: !state.introComplete,
    manualPause: !state.isPlaying,
    background: typeof document !== 'undefined' ? document.hidden : false,
    readingCard: state.cardOpen,
    saving: state.tonightSaveOpen,
    reduceMotion,
  };
}

let cachedTiming: IdleTiming | null = null;

// Dev-only threshold override so e2e can reach the 30s/60s rules in seconds:
// `?idle-resume=1000&idle-ramp=800&idle-epilogue=4000&idle-lead=800` (all ms).
// Gated like `?epoch=` and dropped from production bundles.
export function idleTiming(): IdleTiming {
  if (cachedTiming === null) {
    cachedTiming = DEFAULT_IDLE_TIMING;
    if (typeof window !== 'undefined' && !import.meta.env.PROD) {
      const params = new URLSearchParams(window.location.search);
      const read = (key: string, fallback: number) => {
        const raw = params.get(key);
        if (raw === null) return fallback;
        const value = Number(raw);
        return Number.isFinite(value) && value >= 0 ? value : fallback;
      };
      cachedTiming = {
        resumeMs: read('idle-resume', DEFAULT_IDLE_TIMING.resumeMs),
        rampMs: Math.max(1, read('idle-ramp', DEFAULT_IDLE_TIMING.rampMs)),
        epilogueMs: read('idle-epilogue', DEFAULT_IDLE_TIMING.epilogueMs),
        epilogueLeadMs: read('idle-lead', DEFAULT_IDLE_TIMING.epilogueLeadMs),
      };
    }
  }
  return cachedTiming;
}
