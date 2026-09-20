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
  classifyAmbientContextError,
  distanceTone,
  initialAmbientState,
  loadAmbientPreference,
  persistAmbientPreference,
  primaryAction,
  transition,
} from '../lib/ambientPreference';
import type { AmbientEffect, AmbientEvent, AmbientFailure, AmbientPhase } from '../lib/ambientPreference';
import { AMBIENT_BASE_LEVEL, createAmbientGraph } from '../lib/ambientGraph';
import type { AmbientGraph } from '../lib/ambientGraph';

const FADE_SECONDS = 0.8;
const TONE_POLL_MS = 400;

// Camera distance to the orbit target (the honest 观看距离), written
// imperatively from Scene's useFrame (same pattern as data-camera-pose: a plain
// write, no React churn). The tone poll below reads it a few times a second.
export const ambientSpace = { distance: 20 };

interface AmbientSoundStore {
  phase: AmbientPhase;
  failure: AmbientFailure | null;
  toggle: () => void;
  retry: () => void;
}

// Context factory: default is the live constructor. Tests inject a throwing
// factory so denial/error land without monkey-patching the global. The factory
// is only ever called from startGraph, which itself only runs on a 'start'
// effect — i.e. inside a viewer gesture (ADR-0004). initAmbientSound must not
// call it.
export type AmbientContextFactory = () => AudioContext;

let createAmbientContext: AmbientContextFactory = () => new AudioContext();

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
  toggle: () => dispatch(primaryAction(machine.phase)),
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

// The one fade-in: apply the distance tone and ease the master toward the level.
// Callers decide WHEN this is allowed (playing and, where background is possible,
// not backgrounded); the fade itself is spelled out once.
function fadeInGraph() {
  if (!graph || !audioContext) return;
  const tone = distanceTone(ambientSpace.distance);
  graph.setTone(tone);
  graph.master.gain.setTargetAtTime(AMBIENT_BASE_LEVEL * tone.gain, audioContext.currentTime, FADE_SECONDS / 3);
}

function applyTone() {
  if (machine.phase === 'playing' && !machine.backgrounded) fadeInGraph();
}

async function startGraph() {
  // Called synchronously from a user gesture; the context is created and resumed
  // inside that gesture's call stack, which is what autoplay policies allow.
  try {
    if (!audioContext) {
      audioContext = createAmbientContext();
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
    // Backgrounded starts must stay silent — the machine already emitted
    // 'suspend' for this landing; do not fade in over it.
    if (settled.phase === 'playing' && !settled.backgrounded) fadeInGraph();
  } catch (error) {
    teardownGraph();
    dispatch(classifyAmbientContextError(error));
  }
}

function applyEffect(effect: AmbientEffect) {
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
          // 'resume' only ever fires on a visible return; playing is enough.
          if (machine.phase === 'playing') fadeInGraph();
        })
        .catch((error: unknown) => {
          dispatch(classifyAmbientContextError(error));
        });
      break;
    }
    case 'remember':
      persistAmbientPreference(effect.on);
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
export function initAmbientSound(options?: { createContext?: AmbientContextFactory }) {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  if (options?.createContext) createAmbientContext = options.createContext;
  machine = initialAmbientState(loadAmbientPreference());
  machine = { ...machine, backgrounded: document.hidden };
  publish();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
  window.addEventListener('keydown', onGesture, { capture: true });
  setInterval(applyTone, TONE_POLL_MS);
  syncProbe();
}
