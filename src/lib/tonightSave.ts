// 今晚的 Mira (#23): the pure half of the still-frame save. No canvas, no DOM, no
// timers — sizing, naming, the fixed phrase, and the state machine. The imperative
// shell in hooks/useTonightSave owns the snapshot pixels and applies the effects;
// everything here is unit-testable in Node.
//
// The machine's core guarantee: one save action == one snapshot. Pressing the entry
// captures immediately; overlay toggles only re-compose the same snapshot; a failed
// export retries THE SAME snapshot; only closing and reopening captures fresh.
//
// State machine (events on the left; [effects] the shell applies):
//
//   idle       --open----------> capturing        [capture] — anything else is a no-op
//   capturing  --captured------> preview          (snapshot locked)
//   capturing  --capture-failed> failed (capture) — no snapshot exists to reuse
//   capturing  --context-lost--> failed (context-lost) — the honest WebGL-lost landing
//   preview    --toggle-*------> preview          (overlay flags only, no effects)
//   preview    --export--------> exporting        [export]
//   exporting  --exported------> success
//   exporting  --export-failed-> failed (export)  — snapshot kept
//   failed     --retry---------> exporting [export]   (export failure: same snapshot)
//   failed     --retry---------> capturing [capture]  (capture failure: nothing to reuse)
//   any live   --close---------> idle             [discard when a snapshot exists]
//
// No stacking by construction: 'open' is only honoured from idle and 'export' only
// from preview/success, so rapid repeated clicks in capturing/exporting land nowhere.

import { TRANSLATIONS } from '../constants/translations';
import type { Language } from '../constants/translations';

// Spec: PNG, long edge at most 2560px, current aspect ratio kept.
export const TONIGHT_EXPORT_LONG_EDGE = 2560;

export interface ExportSize {
  width: number;
  height: number;
}

// Fit the source into the cap: keep the aspect, clamp the long edge, and never
// upscale — a frame smaller than the cap exports at its own size (a viewer on a
// small screen gets exactly what they saw, not an interpolated imitation).
// Degenerate edges clamp to one pixel so a 2D canvas can always be created.
export function fitExportSize(
  sourceWidth: number,
  sourceHeight: number,
  cap: number = TONIGHT_EXPORT_LONG_EDGE,
): ExportSize {
  const width = Math.max(1, Math.round(sourceWidth));
  const height = Math.max(1, Math.round(sourceHeight));
  const longEdge = Math.max(width, height);
  if (longEdge <= cap) return { width, height };
  const scale = cap / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

// Date-stamped from the LOCAL save moment (tonight is the viewer's tonight, not UTC's).
export function tonightFilename(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `mira-tonight-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.png`;
}

const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// The optional date overlay line, in the save moment's language.
export function formatTonightDate(now: Date, language: Language): string {
  if (language === 'ch') {
    return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  }
  return `${EN_MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
}

// The fixed short phrase (companionship theme, no free input) — recorded with the
// rest of the viewer-facing copy in translations.
export function tonightPhrase(language: Language): string {
  return TRANSLATIONS[language].tonightPhrase;
}

// Overlay text fit. The compose path measures with a real 2D context; the policy —
// ideal size from the frame's short edge, shrink until every line fits inside the
// margins, never below the floor — lives here so both languages are provably inside
// the frame without a canvas.
export const TONIGHT_TEXT_MIN_SIZE = 10;

export interface TonightTextLayout {
  margin: number;
  ideal: number;
  floor: number;
  available: number;
}

export function tonightTextLayout(frame: { width: number; height: number }): TonightTextLayout {
  const minEdge = Math.min(frame.width, frame.height);
  const margin = Math.max(12, Math.round(minEdge * 0.045));
  return {
    margin,
    ideal: Math.max(14, Math.round(minEdge * 0.032)),
    floor: TONIGHT_TEXT_MIN_SIZE,
    available: Math.max(1, frame.width - 2 * margin),
  };
}

export function fitTonightFontSize(
  lines: string[],
  frame: { width: number; height: number },
  measure: (line: string, fontSize: number) => number,
): number {
  const { ideal, floor, available } = tonightTextLayout(frame);
  for (let size = ideal; size > floor; size -= 1) {
    if (lines.every((line) => measure(line, size) <= available)) return size;
  }
  return floor;
}

export type TonightSavePhase = 'idle' | 'capturing' | 'preview' | 'exporting' | 'success' | 'failed';

export type TonightPrimaryAction = 'retry' | 'save' | 'disabled';

export function primaryAction(phase: TonightSavePhase): TonightPrimaryAction {
  if (phase === 'failed') return 'retry';
  if (phase === 'capturing' || phase === 'exporting') return 'disabled';
  return 'save';
}

// Why the flow failed: 'capture' (no frame could be taken), 'context-lost' (the
// WebGL context is gone — restore the scene first, never fake a live capture),
// 'export' (compose/download failed; the snapshot survives).
export type TonightSaveFailure = 'capture' | 'context-lost' | 'export';

export interface TonightOverlays {
  date: boolean;
  phrase: boolean;
}

export interface TonightSaveState {
  phase: TonightSavePhase;
  // Serial of the locked snapshot (the pixels live in the shell, which also owns
  // the counter). Null until the first capture of this save action lands; a fresh
  // capture always carries a new serial so "same snapshot" vs "new snapshot" is
  // testable without pixels.
  snapshot: number | null;
  overlays: TonightOverlays;
  failure: TonightSaveFailure | null;
}

export type TonightSaveEvent =
  | 'open'
  // The serial is supplied by the shell (it owns the counter): the machine stays
  // pure and identity only ever moves forward, even across close/reopen.
  | { type: 'captured'; serial: number }
  | 'capture-failed'
  | 'context-lost'
  | 'toggle-date'
  | 'toggle-phrase'
  | 'export'
  | 'exported'
  | 'export-failed'
  | 'retry'
  | 'close';

export type TonightSaveEffect =
  | { type: 'capture' } // take a fresh snapshot NOW, synchronously inside the press
  | { type: 'export' } // compose and hand the viewer the file
  | { type: 'discard' }; // release the snapshot and any preview resources

export interface TonightSaveTransition {
  state: TonightSaveState;
  effects: TonightSaveEffect[];
}

export function initialTonightSaveState(): TonightSaveState {
  return {
    phase: 'idle',
    snapshot: null,
    overlays: { date: false, phrase: false },
    failure: null,
  };
}

function silent(state: TonightSaveState, patch: Partial<TonightSaveState> = {}): TonightSaveTransition {
  return { state: { ...state, ...patch }, effects: [] };
}

export function transition(state: TonightSaveState, event: TonightSaveEvent): TonightSaveTransition {
  const type = typeof event === 'string' ? event : event.type;
  switch (type) {
    case 'open':
      // Only a genuinely closed flow opens; every other press is already inside
      // this save action and must not stack work.
      if (state.phase !== 'idle') return silent(state);
      return {
        state: { ...initialTonightSaveState(), phase: 'capturing' },
        effects: [{ type: 'capture' }],
      };

    case 'captured':
      if (state.phase !== 'capturing' || typeof event === 'string') return silent(state);
      return silent(state, { phase: 'preview', snapshot: event.serial, failure: null });

    case 'capture-failed':
    case 'context-lost':
      if (state.phase !== 'capturing') return silent(state);
      return silent(state, {
        phase: 'failed',
        failure: event === 'context-lost' ? 'context-lost' : 'capture',
        snapshot: null,
      });

    case 'toggle-date':
    case 'toggle-phrase': {
      // Options re-compose the overlay on the same snapshot; with no snapshot there
      // is nothing to compose. Allowed in preview and after a failed export (the
      // frame is still on screen) — never mid-capture or mid-export.
      const key = event === 'toggle-date' ? 'date' : 'phrase';
      const adjustable = state.phase === 'preview' || state.phase === 'success' ||
        (state.phase === 'failed' && state.snapshot !== null);
      if (!adjustable) return silent(state);
      return silent(state, { overlays: { ...state.overlays, [key]: !state.overlays[key] } });
    }

    case 'export':
      if (state.phase !== 'preview' && state.phase !== 'success') return silent(state);
      return { state: { ...state, phase: 'exporting', failure: null }, effects: [{ type: 'export' }] };

    case 'exported':
      if (state.phase !== 'exporting') return silent(state);
      return silent(state, { phase: 'success' });

    case 'export-failed':
      if (state.phase !== 'exporting') return silent(state);
      // The snapshot survives; the viewing state was never touched.
      return silent(state, { phase: 'failed', failure: 'export' });

    case 'retry':
      if (state.phase !== 'failed') return silent(state);
      if (state.failure === 'export' && state.snapshot !== null) {
        // Retry re-exports THE SAME snapshot — never a fresh capture.
        return { state: { ...state, phase: 'exporting', failure: null }, effects: [{ type: 'export' }] };
      }
      // Nothing was ever captured: retrying means capturing now.
      return {
        state: { ...state, phase: 'capturing', failure: null },
        effects: [{ type: 'capture' }],
      };

    case 'close': {
      if (state.phase === 'idle') return silent(state);
      const hadSnapshot = state.snapshot !== null;
      return {
        state: initialTonightSaveState(),
        effects: hadSnapshot ? [{ type: 'discard' }] : [],
      };
    }
  }
}
