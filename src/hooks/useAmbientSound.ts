// Ambient sound shell (#22, ADR-0004): owns the single WebAudio graph, applies
// the pure machine's effects (lib/ambientPreference), and wires the environment
// (visibility, gestures, camera distance) into it. The machine decides; this file
// is the only place that touches an AudioContext.
//
// No stacking, by construction: there is exactly one module-level graph slot. It
// is filled only by the 'start' effect, which the machine emits solely on the
// transition into `enabling`; explicit off empties the slot (nodes stopped,
// context closed) so a replay of the full cinematic or a React remount can never
// create a second graph.
//
// Autoplay honesty: the graph is only ever built inside a real user gesture —
// the toggle click, or any pointer/key while the remembered preference waits in
// `pending-gesture`. A remembered preference alone never starts sound.

import { create } from 'zustand';
import {
  distanceTone,
  initialAmbientState,
  loadAmbientPreference,
  persistAmbientPreference,
  transition,
} from '../lib/ambientPreference';
import type { AmbientEvent, AmbientFailure, AmbientPhase } from '../lib/ambientPreference';
import { AMBIENT_BASE_LEVEL, createAmbientGraph } from '../lib/ambientGraph';
import type { AmbientGraph } from '../lib/ambientGraph';

const FADE_SECONDS = 0.8;
const TONE_POLL_MS = 400;

// Camera distance to the origin, written imperatively from Scene's useFrame
// (same pattern as data-camera-pose: a plain write, no React churn). The tone
// poll below reads it a few times a second.
export const ambientSpace = { distance: 20 };

interface AmbientSoundStore {
  phase: AmbientPhase;
  failure: AmbientFailure | null;
  toggle: () => void;
  retry: () => void;
}

// Module-level singletons: the machine state, the one graph slot, and its context.
let machine = initialAmbientState(false);
let graph: AmbientGraph | null = null;
let audioContext: AudioContext | null = null;
let suspendTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

// Dev-only e2e probe (same gate as ?epoch=): proves one context at a time and
// lets specs observe the real AudioContext state instead of guessing.
const probe = { created: 0, closed: 0 };

function syncProbe() {
  if (import.meta.env.PROD || typeof window === 'undefined') return;
  (window as unknown as Record<string, unknown>).__miraAmbient = {
    contextsCreated: () => probe.created,
    liveContexts: () => probe.created - probe.closed,
    contextState: () => audioContext?.state ?? 'none',
  };
}

export const useAmbientSound = create<AmbientSoundStore>(() => ({
  phase: machine.phase,
  failure: null,
  toggle: () => {
    const { phase } = machine;
    if (phase === 'off') dispatch('toggle-on');
    else if (phase === 'pending-gesture') dispatch('gesture');
    else if (phase === 'failed') dispatch('retry');
    else dispatch('toggle-off');
  },
  retry: () => dispatch('retry'),
}));

function publish() {
  useAmbientSound.setState({ phase: machine.phase, failure: machine.failure });
}

function teardownGraph() {
  if (suspendTimer !== null) {
    clearTimeout(suspendTimer);
    suspendTimer = null;
  }
  graph?.stop();
  graph = null;
  const context = audioContext;
  audioContext = null;
  if (context && context.state !== 'closed') {
    probe.closed += 1;
    void context.close().catch(() => undefined);
  }
  syncProbe();
}

function applyTone() {
  if (!graph || !audioContext) return;
  const tone = distanceTone(ambientSpace.distance);
  graph.setTone(tone);
  if (machine.phase === 'playing' && !machine.backgrounded) {
    graph.master.gain.setTargetAtTime(AMBIENT_BASE_LEVEL * tone.gain, audioContext.currentTime, FADE_SECONDS / 3);
  }
}

async function startGraph() {
  // Called synchronously from a user gesture; the context is created and resumed
  // inside that gesture's call stack, which is what autoplay policies allow.
  try {
    if (!audioContext) {
      audioContext = new AudioContext();
      probe.created += 1;
      syncProbe();
      graph = createAmbientGraph(audioContext);
      graph.start();
    }
    await audioContext.resume();
    // The viewer may have toggled off (or the page hidden) while resume was in
    // flight; only `enabling` is a valid landing pad.
    if (machine.phase !== 'enabling' || !graph || !audioContext) return;
    dispatch('started');
    const settled = machine;
    if (settled.phase === 'playing' && graph && audioContext) {
      const tone = distanceTone(ambientSpace.distance);
      graph.setTone(tone);
      graph.master.gain.setTargetAtTime(AMBIENT_BASE_LEVEL * tone.gain, audioContext.currentTime, FADE_SECONDS / 3);
    }
  } catch (error) {
    teardownGraph();
    const denied = error instanceof DOMException && error.name === 'NotAllowedError';
    dispatch(denied ? 'start-denied' : 'start-error');
  }
}

function applyEffect(effect: { type: string; on?: boolean }) {
  switch (effect.type) {
    case 'start':
      void startGraph();
      break;
    case 'stop':
      teardownGraph();
      break;
    case 'suspend': {
      if (!graph || !audioContext) break;
      graph.master.gain.setTargetAtTime(0, audioContext.currentTime, FADE_SECONDS / 3);
      const context = audioContext;
      suspendTimer = setTimeout(() => {
        suspendTimer = null;
        if (machine.backgrounded && context.state === 'running') void context.suspend().catch(() => undefined);
      }, FADE_SECONDS * 1000);
      break;
    }
    case 'resume': {
      if (!graph || !audioContext) {
        // The graph vanished while hidden (explicit off raced the timers): the
        // machine still believes in playback, so rebuild honestly inside this
        // visibility event — not a gesture, so a refusal lands in failed.
        dispatch('start-error');
        break;
      }
      const context = audioContext;
      context
        .resume()
        .then(() => {
          if (machine.phase === 'playing' && graph) {
            const tone = distanceTone(ambientSpace.distance);
            graph.master.gain.setTargetAtTime(AMBIENT_BASE_LEVEL * tone.gain, context.currentTime, FADE_SECONDS / 3);
          }
        })
        .catch((error: unknown) => {
          const denied = error instanceof DOMException && error.name === 'NotAllowedError';
          dispatch(denied ? 'start-denied' : 'start-error');
        });
      break;
    }
    case 'remember':
      persistAmbientPreference(Boolean(effect.on));
      break;
  }
}

function dispatch(event: AmbientEvent) {
  const { state, effects } = transition(machine, event);
  machine = state;
  publish();
  for (const effect of effects) applyEffect(effect);
}

function onGesture(event: Event) {
  // The toggle's own click IS the gesture; letting the window listener consume it
  // first would flip the machine to enabling and the click would turn it back off.
  if (event.target instanceof Element && event.target.closest('[data-ambient-toggle]')) return;
  if (machine.phase === 'pending-gesture') dispatch('gesture');
}

function onVisibility() {
  dispatch(document.hidden ? 'hidden' : 'visible');
}

// Idempotent: App calls this once on mount; remounts must not double-register
// listeners or reset a running graph (SPEC: restored interaction/sound never
// registers twice).
export function initAmbientSound() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  machine = initialAmbientState(loadAmbientPreference());
  machine = { ...machine, backgrounded: document.hidden };
  publish();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
  window.addEventListener('keydown', onGesture, { capture: true });
  setInterval(applyTone, TONE_POLL_MS);
  syncProbe();
}
