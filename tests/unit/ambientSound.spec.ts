import { test, expect } from '@playwright/test';
import {
  AMBIENT_SOUND_KEY,
  initialAmbientState,
  loadAmbientPreference,
  persistAmbientPreference,
  transition,
  distanceTone,
} from '../../src/lib/ambientPreference';
import type { AmbientSoundState } from '../../src/lib/ambientPreference';

// Ambient sound (#22): the pure half of the feature. The machine separates the
// viewer's DESIRED state (the remembered preference) from ACTUAL playback, so the
// UI never claims sound that is not real and a denied autoplay is never retried
// behind the viewer's back.

const OFF = initialAmbientState(false);
const PENDING = initialAmbientState(true);

function play(): AmbientSoundState {
  return transition(transition(OFF, 'toggle-on').state, 'started').state;
}

function effectTypes(state: AmbientSoundState, event: Parameters<typeof transition>[1]) {
  return transition(state, event).effects.map((effect) => effect.type);
}

test.describe('ambient sound preference', () => {
  test('defaults to silent when storage is absent or unreadable', () => {
    expect(loadAmbientPreference()).toBe(false);
  });

  test('round-trips the preference through localStorage when available', () => {
    const memory = new Map<string, string>();
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => void memory.set(key, value),
      },
    });
    try {
      expect(loadAmbientPreference()).toBe(false);
      persistAmbientPreference(true);
      expect(memory.get(AMBIENT_SOUND_KEY)).toBe('1');
      expect(loadAmbientPreference()).toBe(true);
      persistAmbientPreference(false);
      expect(loadAmbientPreference()).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original });
    }
  });

  test('a remembered preference starts pending a gesture, never playing', () => {
    expect(initialAmbientState(false).phase).toBe('off');
    const pending = initialAmbientState(true);
    expect(pending.phase).toBe('pending-gesture');
    expect(pending.failure).toBeNull();
  });
});

test.describe('ambient sound state machine', () => {
  test('toggle-on from off starts the graph inside the gesture and remembers the choice', () => {
    const { state, effects } = transition(OFF, 'toggle-on');
    expect(state.phase).toBe('enabling');
    expect(effectTypes(OFF, 'toggle-on')).toEqual(['start', 'remember']);
    expect(effects[1]).toEqual({ type: 'remember', on: true });
  });

  test('enabling becomes playing once the graph is really running', () => {
    const enabling = transition(OFF, 'toggle-on').state;
    const { state, effects } = transition(enabling, 'started');
    expect(state.phase).toBe('playing');
    expect(state.failure).toBeNull();
    expect(effects).toEqual([]);
  });

  test('a denied resume lands in failed with the denial recorded', () => {
    const enabling = transition(OFF, 'toggle-on').state;
    const { state, effects } = transition(enabling, 'start-denied');
    expect(state.phase).toBe('failed');
    expect(state.failure).toBe('denied');
    expect(effects).toEqual([]);
  });

  test('a graph failure lands in failed as a plain error, retryable', () => {
    const enabling = transition(OFF, 'toggle-on').state;
    const { state } = transition(enabling, 'start-error');
    expect(state.phase).toBe('failed');
    expect(state.failure).toBe('error');
    expect(transition(state, 'retry').state.phase).toBe('enabling');
    expect(effectTypes(state, 'retry')).toEqual(['start']);
  });

  test('explicit off stops the graph, forgets nothing else, and never auto-resumes', () => {
    const playing = play();
    const { state, effects } = transition(playing, 'toggle-off');
    expect(state.phase).toBe('off');
    expect(effects).toEqual([{ type: 'stop' }, { type: 'remember', on: false }]);
    // A later gesture (click, key) must not bring the sound back on its own.
    const afterGesture = transition(state, 'gesture');
    expect(afterGesture.state.phase).toBe('off');
    expect(afterGesture.effects).toEqual([]);
  });

  test('a remembered preference only starts on a real gesture', () => {
    const { state, effects } = transition(PENDING, 'gesture');
    expect(state.phase).toBe('enabling');
    expect(effectTypes(PENDING, 'gesture')).toEqual(['start']);
    // The preference was remembered at the original toggle; no second write.
    expect(effects.some((effect) => effect.type === 'remember')).toBe(false);
  });

  test('pending can still be turned explicitly off', () => {
    const { state, effects } = transition(PENDING, 'toggle-off');
    expect(state.phase).toBe('off');
    expect(effects).toEqual([{ type: 'remember', on: false }]);
  });

  test('rapid retoggles never stack a second start', () => {
    const enabling = transition(OFF, 'toggle-on').state;
    // Toggle-on again mid-start: no extra start effect, still enabling.
    expect(transition(enabling, 'toggle-on').effects).toEqual([]);
    expect(transition(enabling, 'toggle-on').state.phase).toBe('enabling');
    // A gesture in playing is meaningless — the graph already exists.
    const playing = play();
    expect(transition(playing, 'gesture').effects).toEqual([]);
    expect(transition(playing, 'toggle-on').effects).toEqual([]);
  });

  test('background suspends playback; returning resumes only because it was playing', () => {
    const playing = play();
    const hidden = transition(playing, 'hidden');
    expect(hidden.effects).toEqual([{ type: 'suspend' }]);
    expect(hidden.state.phase).toBe('playing');
    expect(hidden.state.backgrounded).toBe(true);
    expect(hidden.state.resumeOnReturn).toBe(true);

    const visible = transition(hidden.state, 'visible');
    expect(visible.effects).toEqual([{ type: 'resume' }]);
    expect(visible.state.backgrounded).toBe(false);
    expect(visible.state.resumeOnReturn).toBe(false);
  });

  test('backgrounding silence stays silent: no suspend, no catch-up resume', () => {
    for (const quiet of [OFF, PENDING]) {
      const hidden = transition(quiet, 'hidden');
      expect(hidden.effects).toEqual([]);
      const visible = transition(hidden.state, 'visible');
      expect(visible.effects).toEqual([]);
    }
  });

  test('a denial is never auto-retried on foreground return', () => {
    const enabling = transition(OFF, 'toggle-on').state;
    const failed = transition(enabling, 'start-denied').state;
    const hidden = transition(failed, 'hidden');
    const visible = transition(hidden.state, 'visible');
    expect(visible.effects).toEqual([]);
    expect(visible.state.phase).toBe('failed');
  });

  test('turning off mid-start stops whatever exists', () => {
    const enabling = transition(OFF, 'toggle-on').state;
    const { state, effects } = transition(enabling, 'toggle-off');
    expect(state.phase).toBe('off');
    expect(effects).toEqual([{ type: 'stop' }, { type: 'remember', on: false }]);
  });
});

test.describe('distance tone', () => {
  test('stays barely-there across the whole zoom range', () => {
    for (let d = 5; d <= 40; d += 1) {
      const tone = distanceTone(d);
      expect(tone.gain).toBeGreaterThanOrEqual(0.8);
      expect(tone.gain).toBeLessThanOrEqual(1.05);
      expect(tone.cutoffHz).toBeGreaterThanOrEqual(300);
      expect(tone.cutoffHz).toBeLessThanOrEqual(900);
    }
  });

  test('farther is quieter and darker, monotonically', () => {
    let previous = distanceTone(5);
    for (let d = 6; d <= 40; d += 1) {
      const tone = distanceTone(d);
      expect(tone.gain).toBeLessThanOrEqual(previous.gain);
      expect(tone.cutoffHz).toBeLessThanOrEqual(previous.cutoffHz);
      previous = tone;
    }
  });

  test('clamps outside the zoom range instead of drifting', () => {
    expect(distanceTone(0)).toEqual(distanceTone(5));
    expect(distanceTone(1000)).toEqual(distanceTone(40));
  });
});
