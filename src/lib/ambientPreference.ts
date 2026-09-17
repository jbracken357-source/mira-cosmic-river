// Ambient sound preference and state machine (#22, ADR-0004).
//
// The pure half of the feature: no WebAudio, no DOM, no timers — state in, events
// in, next state plus effects out. The imperative shell in hooks/useAmbientSound
// owns the single audio graph and applies the effects; everything here is
// unit-testable in Node.
//
// The core separation is DESIRED vs ACTUAL. `phase` only ever reports what is
// really true: a remembered preference loads as `pending-gesture` (not playing),
// a browser denial lands in `failed` with the denial recorded, and explicit off
// never auto-resumes. The shell never starts the graph outside a user gesture.
//
// State machine (events on the left; [effects] the shell applies):
//
//   off              --toggle-on-->   enabling          [start, remember on]
//   off              --gesture-->     off               (explicit off never auto-resumes)
//   pending-gesture  --gesture-->     enabling          [start]
//   pending-gesture  --toggle-off-->  off               [remember off]
//   enabling         --started-->     playing
//   enabling         --start-denied-> failed (denied)
//   enabling         --start-error--> failed (error)
//   enabling         --toggle-off-->  off               [stop, remember off]
//   playing          --toggle-off-->  off               [stop, remember off]
//   playing          --hidden-->      playing (bg)      [suspend]
//   playing (bg)     --visible-->     playing           [resume] — only because it was playing
//   failed           --retry-->       enabling          [start]
//   failed           --toggle-off-->  off               [stop, remember off]
//   failed           --visible-->     failed            (a denial is never auto-retried)
//   off/pending/failed --hidden/visible--> bookkeeping only, no effects
//
// No stacking: `start` is only emitted on the transition INTO enabling; repeated
// toggles or gestures while enabling/playing return the same state with no
// effects, so the shell can never build a second graph.

export const AMBIENT_SOUND_KEY = 'mira:ambient-sound';

export type AmbientPhase = 'off' | 'pending-gesture' | 'enabling' | 'playing' | 'failed';

// Why playback failed: 'denied' is the browser refusing autoplay (NotAllowedError),
// 'error' is anything else in graph setup. Both are retryable by the viewer; the
// difference is that a denial must never be retried implicitly.
export type AmbientFailure = 'denied' | 'error';

export interface AmbientSoundState {
  phase: AmbientPhase;
  failure: AmbientFailure | null;
  // Page visibility bookkeeping. resumeOnReturn remembers "was actually sounding
  // when hidden" so a foreground return only resumes real playback.
  backgrounded: boolean;
  resumeOnReturn: boolean;
}

export type AmbientEvent =
  | 'toggle-on'
  | 'toggle-off'
  | 'retry'
  | 'gesture'
  | 'started'
  | 'start-denied'
  | 'start-error'
  | 'hidden'
  | 'visible';

export type AmbientEffect =
  | { type: 'start' } // build + resume the graph; only ever inside a user gesture
  | { type: 'stop' } // tear the graph down and release the context
  | { type: 'suspend' } // background: fade out, then suspend the context
  | { type: 'resume' } // foreground: resume the context, fade back in
  | { type: 'remember'; on: boolean };

export interface AmbientTransition {
  state: AmbientSoundState;
  effects: AmbientEffect[];
}

export function initialAmbientState(preferenceOn: boolean): AmbientSoundState {
  return {
    phase: preferenceOn ? 'pending-gesture' : 'off',
    failure: null,
    backgrounded: false,
    resumeOnReturn: false,
  };
}

export function loadAmbientPreference(): boolean {
  try {
    return globalThis.localStorage?.getItem(AMBIENT_SOUND_KEY) === '1';
  } catch {
    return false;
  }
}

export function persistAmbientPreference(on: boolean): void {
  try {
    globalThis.localStorage?.setItem(AMBIENT_SOUND_KEY, on ? '1' : '0');
  } catch {
    // Private mode / blocked storage: the session still works, it just won't remember.
  }
}

function silent(state: AmbientSoundState, patch: Partial<AmbientSoundState> = {}): AmbientTransition {
  return { state: { ...state, ...patch }, effects: [] };
}

export function transition(state: AmbientSoundState, event: AmbientEvent): AmbientTransition {
  switch (event) {
    case 'toggle-on':
      // Only a genuinely silent machine can start; anything else already has (or
      // is building) the single graph.
      if (state.phase === 'off' || state.phase === 'pending-gesture') {
        return {
          state: { ...state, phase: 'enabling', failure: null },
          effects: [
            { type: 'start' },
            // Pending already carries the remembered preference; a fresh opt-in
            // from off writes it now.
            ...(state.phase === 'off' ? [{ type: 'remember', on: true } as AmbientEffect] : []),
          ],
        };
      }
      return silent(state);

    case 'gesture':
      if (state.phase === 'pending-gesture') {
        return { state: { ...state, phase: 'enabling', failure: null }, effects: [{ type: 'start' }] };
      }
      return silent(state);

    case 'retry':
      if (state.phase === 'failed') {
        return { state: { ...state, phase: 'enabling', failure: null }, effects: [{ type: 'start' }] };
      }
      return silent(state);

    case 'toggle-off':
      if (state.phase === 'off' || state.phase === 'pending-gesture') {
        return {
          state: { ...state, phase: 'off', failure: null, resumeOnReturn: false },
          effects: state.phase === 'pending-gesture' ? [{ type: 'remember', on: false }] : [],
        };
      }
      return {
        state: { ...state, phase: 'off', failure: null, resumeOnReturn: false },
        effects: [{ type: 'stop' }, { type: 'remember', on: false }],
      };

    case 'started':
      if (state.phase === 'enabling') {
        return silent(state, { phase: 'playing', failure: null });
      }
      return silent(state);

    case 'start-denied':
    case 'start-error':
      // Denial/failure can also arrive from a foreground resume that the browser
      // rejects after the fact — either way the honest landing is failed.
      if (state.phase === 'enabling' || state.phase === 'playing') {
        return silent(state, {
          phase: 'failed',
          failure: event === 'start-denied' ? 'denied' : 'error',
          resumeOnReturn: false,
        });
      }
      return silent(state);

    case 'hidden':
      if (state.backgrounded) return silent(state);
      if (state.phase === 'playing') {
        return {
          state: { ...state, backgrounded: true, resumeOnReturn: true },
          effects: [{ type: 'suspend' }],
        };
      }
      return silent(state, { backgrounded: true, resumeOnReturn: false });

    case 'visible': {
      if (!state.backgrounded) return silent(state);
      // Resume only when sound was really playing before the background, the
      // viewer never explicitly turned it off, and no denial is on record.
      if (state.phase === 'playing' && state.resumeOnReturn && state.failure === null) {
        return {
          state: { ...state, backgrounded: false, resumeOnReturn: false },
          effects: [{ type: 'resume' }],
        };
      }
      return silent(state, { backgrounded: false, resumeOnReturn: false });
    }
  }
}

// Distance binding (克制): camera distance to the origin maps to a barely-there
// tone shift — closer is a touch brighter and louder, farther darker and quieter.
// The range matches the OrbitControls zoom limits in Scene.tsx.
export const AMBIENT_DISTANCE_RANGE = { min: 5, max: 40 } as const;

export interface AmbientTone {
  gain: number; // multiplier on the master level
  cutoffHz: number; // lowpass corner on the noise bed
}

export function distanceTone(distance: number): AmbientTone {
  const { min, max } = AMBIENT_DISTANCE_RANGE;
  const t = Math.min(1, Math.max(0, (distance - min) / (max - min)));
  return {
    gain: 1.0 + (0.82 - 1.0) * t,
    cutoffHz: 760 + (380 - 760) * t,
  };
}
