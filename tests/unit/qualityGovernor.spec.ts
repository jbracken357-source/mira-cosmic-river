import { test, expect } from '@playwright/test';
import {
  DEFAULT_GOVERNOR_CONFIG,
  driveQualityGovernor,
  evaluateQuality,
  initialGovernorState,
  resolveGovernorSetup,
} from '../../src/lib/qualityGovernor';
import type { GovernorConfig, GovernorState, GovernorVerdict } from '../../src/lib/qualityGovernor';

// Compressed windows/cooldown so the rules are exercised in a handful of feeds.
const CONFIG: GovernorConfig = {
  downFrameMs: 19,
  upFrameMs: 13,
  windowMs: 1000,
  cooldownMs: 5000,
  desktopOnly: true,
  stallFrameMs: 250,
};

const SLOW = 40; // ms per frame, well past the down threshold
const FAST = 8; // ms per frame, well under the up threshold
const STEADY = 16; // inside the hysteresis band: neither slow nor fast

// A state whose last change is far enough in the past that the cooldown never
// interferes with the rule under test.
function readyState(tier: GovernorState['tier']): GovernorState {
  return { ...initialGovernorState(tier, 0), lastChangeAt: -CONFIG.cooldownMs };
}

// Feed whole windows of a constant frame time, returning every verdict.
function feedWindows(
  state: GovernorState,
  frameMs: number,
  windows: number,
  startAt = 0,
): { state: GovernorState; verdicts: GovernorVerdict[]; now: number } {
  const verdicts: GovernorVerdict[] = [];
  let now = startAt;
  const framesPerWindow = 20;
  const step = CONFIG.windowMs / framesPerWindow;
  for (let w = 0; w < windows; w += 1) {
    for (let f = 0; f < framesPerWindow; f += 1) {
      now += step;
      const verdict = evaluateQuality(state, frameMs, now, CONFIG);
      state = verdict.state;
      verdicts.push(verdict);
    }
  }
  return { state, verdicts, now };
}

const changes = (verdicts: GovernorVerdict[]) =>
  verdicts.filter((v): v is Extract<GovernorVerdict, { kind: 'change' }> => v.kind === 'change');

test.describe('evaluateQuality', () => {
  test('frame times inside the hysteresis band never change the tier', () => {
    // 16ms sits between up (13) and down (19): the classic 60fps-with-jitter
    // signal that must not move anything.
    const { state, verdicts } = feedWindows(readyState('high'), STEADY, 8);
    expect(state.tier).toBe('high');
    expect(changes(verdicts)).toHaveLength(0);
    expect(verdicts.every((v) => v.kind === 'stable')).toBe(true);
  });

  test('one slow window is not enough; the streak resets on a steady window', () => {
    let state = readyState('high');
    let now = 0;
    ({ state, now } = feedWindows(state, SLOW, 1, now));
    expect(state.tier).toBe('high');
    ({ state, now } = feedWindows(state, STEADY, 1, now));
    ({ state } = feedWindows(state, SLOW, 1, now));
    expect(state.tier).toBe('high');
  });

  test('two consecutive slow windows step down exactly one tier', () => {
    const { state, verdicts } = feedWindows(readyState('high'), SLOW, 2);
    const events = changes(verdicts);
    expect(events).toHaveLength(1);
    expect(events[0].from).toBe('high');
    expect(events[0].to).toBe('mid');
    expect(events[0].reason).toBe('sustained-slow');
    expect(state.tier).toBe('mid');
  });

  test('the light tier is the floor: sustained slow at low stays low', () => {
    const { state, verdicts } = feedWindows(readyState('low'), SLOW, 4);
    expect(state.tier).toBe('low');
    expect(changes(verdicts)).toHaveLength(0);
  });

  test('the cooldown forbids a second change right after the first, so high never lands on low in one slide', () => {
    const { verdicts } = feedWindows(readyState('high'), SLOW, 4);
    const events = changes(verdicts);
    expect(events).toHaveLength(1);
    expect(events[0].to).toBe('mid');
    // The remaining slow windows fall inside the cooldown: reported, not acted on.
    expect(verdicts.some((v) => v.kind === 'cooldown')).toBe(true);
  });

  test('after the cooldown the descent continues, again one tier at a time', () => {
    const { state, verdicts } = feedWindows(readyState('high'), SLOW, 12);
    const events = changes(verdicts);
    expect(events.map((e) => `${e.from}>${e.to}`)).toEqual(['high>mid', 'mid>low']);
    expect(state.tier).toBe('low');
    // window 2 (~2s) and, past the 5s cooldown, the earliest window with two
    // consecutive slow settlements
    expect(events[1].state.lastChangeAt - events[0].state.lastChangeAt).toBeGreaterThanOrEqual(
      CONFIG.cooldownMs,
    );
  });

  test('two consecutive fast windows step up one tier, once the cooldown allows', () => {
    const { state, verdicts } = feedWindows(readyState('low'), FAST, 3);
    const events = changes(verdicts);
    expect(events).toHaveLength(1);
    expect(events[0].from).toBe('low');
    expect(events[0].to).toBe('mid');
    expect(events[0].reason).toBe('sustained-fast');
    expect(state.tier).toBe('mid');
  });

  test('the high tier is the ceiling: sustained fast at high stays high', () => {
    const { state, verdicts } = feedWindows(readyState('high'), FAST, 4);
    expect(state.tier).toBe('high');
    expect(changes(verdicts)).toHaveLength(0);
  });

  test('a fast streak inside the cooldown is reported but not acted on', () => {
    // State as if a downgrade happened one window ago.
    const state: GovernorState = {
      ...initialGovernorState('mid', 0),
      tier: 'mid',
      lastChangeAt: 0,
    };
    const { state: after, verdicts } = feedWindows(state, FAST, 3, 1000);
    expect(after.tier).toBe('mid');
    expect(changes(verdicts)).toHaveLength(0);
    expect(verdicts.some((v) => v.kind === 'cooldown')).toBe(true);
  });

  test('the startup grace period treats initialisation as a change', () => {
    // Shader compilation makes the first seconds slow; a governor that reacted
    // to them would open every session by punishing the viewer's first look.
    const { state, verdicts } = feedWindows(initialGovernorState('high', 0), SLOW, 2);
    expect(state.tier).toBe('high');
    expect(changes(verdicts)).toHaveLength(0);
    expect(verdicts.some((v) => v.kind === 'cooldown')).toBe(true);
  });

  test('a window judges by its P75, so single-frame spikes do not count as slow', () => {
    // 20% of frames at 90ms (GC pauses), the rest a steady 15ms: P75 stays 15.
    let state = readyState('high');
    let now = 0;
    for (let w = 0; w < 4; w += 1) {
      for (let f = 0; f < 20; f += 1) {
        now += CONFIG.windowMs / 20;
        const spike = f % 5 === 0;
        const verdict = evaluateQuality(state, spike ? 90 : 15, now, CONFIG);
        state = verdict.state;
        expect(verdict.kind).toBe('stable');
      }
    }
    expect(state.tier).toBe('high');
  });

  test('frames sparser than the window still settle, one window per late frame', () => {
    // A heavily throttled machine can render slower than the window is long; the
    // late frame's own time is still evidence and the streak must keep building.
    let state = readyState('high');
    let now = 0;
    let verdict = evaluateQuality(state, SLOW, (now += 50), CONFIG);
    state = verdict.state;
    verdict = evaluateQuality(state, SLOW, (now += CONFIG.windowMs), CONFIG);
    state = verdict.state;
    expect(state.slowWindows).toBe(1);
    verdict = evaluateQuality(state, SLOW, (now += CONFIG.windowMs + 1), CONFIG);
    state = verdict.state;
    expect(verdict.kind).toBe('change');
    expect(state.tier).toBe('mid');
  });

  test('a stalled loop is not evidence: starved frames neither build nor break a streak', () => {
    // Minimised/occluded windows keep producing rare frames with huge deltas.
    let state = readyState('high');
    let now = 0;
    // One genuine slow window starts a streak…
    ({ state, now } = feedWindows(state, SLOW, 1, now));
    expect(state.slowWindows).toBe(1);
    // …then the loop starves for seconds (minimised window). No verdict may act
    // on those frames, and the streak must survive them intact.
    for (let i = 0; i < 6; i += 1) {
      const verdict = evaluateQuality(state, 900, (now += 900), CONFIG);
      state = verdict.state;
      expect(verdict.kind).toBe('stable');
    }
    expect(state.slowWindows).toBe(1);
    // …and the next genuine slow window completes the pair: the streak resumed
    // exactly where the stall interrupted it.
    const { state: after, verdicts } = feedWindows(state, SLOW, 1, now);
    expect(changes(verdicts)).toHaveLength(1);
    expect(after.tier).toBe('mid');
  });

  test('stall frames alone never move the tier', () => {
    let state = readyState('high');
    let now = 0;
    for (let i = 0; i < 20; i += 1) {
      const verdict = evaluateQuality(state, 1000, (now += 1000), CONFIG);
      state = verdict.state;
    }
    expect(state.tier).toBe('high');
    expect(state.slowWindows).toBe(0);
  });
});

test.describe('driveQualityGovernor (entry-gate contract)', () => {
  test('frames fed while the entry gate waits are never evaluated', () => {
    // Software rendering makes page load slow; if those frames counted, the
    // governor would walk off its starting tier before the scene is presented.
    let state: GovernorState | null = null;
    let now = 0;
    for (let i = 0; i < 100; i += 1) {
      const driven = driveQualityGovernor(state, false, SLOW, (now += 50), CONFIG, 'high');
      state = driven.state;
      expect(driven.verdict).toBeNull();
    }
    expect(state).toBeNull();
  });

  test('the governor begins on the gate-land frame, startup grace starting there', () => {
    const driven = driveQualityGovernor(null, true, STEADY, 10_000, CONFIG, 'mid');
    expect(driven.verdict).toBeNull();
    const begun = driven.state;
    expect(begun).not.toBeNull();
    expect(begun!.tier).toBe('mid');
    expect(begun!.lastChangeAt).toBe(10_000);
    expect(begun!.windowStartAt).toBe(10_000);

    // Two slow windows right after the gate lands: the grace period must hold,
    // so loading-time slowness cannot immediately pull the tier down.
    let state = begun;
    let now = 10_000;
    let sawChange = false;
    for (let f = 0; f < 40; f += 1) {
      now += CONFIG.windowMs / 20;
      const next = driveQualityGovernor(state, true, SLOW, now, CONFIG, 'mid');
      state = next.state;
      if (next.verdict?.kind === 'change') sawChange = true;
    }
    expect(sawChange).toBe(false);
    expect(state!.tier).toBe('mid');
  });

  test('loading slowness leaves no streak behind: steady frames after the gate stay put', () => {
    let state: GovernorState | null = null;
    let now = 0;
    // A long, slow load (every frame past the down threshold)…
    for (let i = 0; i < 60; i += 1) {
      state = driveQualityGovernor(state, false, SLOW, (now += 100), CONFIG, 'high').state;
    }
    // …then the gate opens and the scene runs steady inside the band for a while:
    // nothing may change, because no slow window from the load was counted.
    state = driveQualityGovernor(state, true, STEADY, (now += 100), CONFIG, 'high').state;
    for (let w = 0; w < 6; w += 1) {
      for (let f = 0; f < 20; f += 1) {
        now += CONFIG.windowMs / 20;
        const driven = driveQualityGovernor(state, true, STEADY, now, CONFIG, 'high');
        state = driven.state;
        expect(driven.verdict?.kind ?? 'stable').toBe('stable');
      }
    }
    expect(state!.tier).toBe('high');
  });

  test('once begun, frames evaluate exactly like evaluateQuality', () => {
    // Begin at t=0, then feed two slow windows past the cooldown: a change.
    let state = driveQualityGovernor(null, true, STEADY, 0, CONFIG, 'high').state;
    let now = CONFIG.cooldownMs;
    let change: Extract<GovernorVerdict, { kind: 'change' }> | null = null;
    for (let w = 0; w < 2 && change === null; w += 1) {
      for (let f = 0; f < 20; f += 1) {
        now += CONFIG.windowMs / 20;
        const driven = driveQualityGovernor(state, true, SLOW, now, CONFIG, 'high');
        state = driven.state;
        if (driven.verdict?.kind === 'change') change = driven.verdict;
      }
    }
    expect(change).not.toBeNull();
    expect(change!.from).toBe('high');
    expect(change!.to).toBe('mid');
    expect(state!.tier).toBe('mid');
  });
});

test.describe('resolveGovernorSetup', () => {  const desktopEnv = { qualityQuery: null, innerWidth: 1440, innerHeight: 900 };

  test('an explicit ?quality= pin turns the governor off entirely', () => {
    for (const q of ['low', 'mid', 'high']) {
      const setup = resolveGovernorSetup({ ...desktopEnv, qualityQuery: q });
      expect(setup.enabled).toBe(false);
      expect(setup.reason).toBe('pinned');
    }
  });

  test('an unrecognised quality value is not a pin', () => {
    const setup = resolveGovernorSetup({ ...desktopEnv, qualityQuery: 'ultra' });
    expect(setup.enabled).toBe(true);
  });

  test('desktopOnly keeps phones out of frame-rate governance', () => {
    const phone = { qualityQuery: null, innerWidth: 390, innerHeight: 844 };
    expect(resolveGovernorSetup(phone).enabled).toBe(false);
    expect(resolveGovernorSetup(phone).reason).toBe('mobile');
    expect(resolveGovernorSetup(phone, { ...CONFIG, desktopOnly: false }).enabled).toBe(true);
  });

  test('a landscape phone is still mobile by its short side', () => {
    const setup = resolveGovernorSetup({ qualityQuery: null, innerWidth: 844, innerHeight: 390 });
    expect(setup.enabled).toBe(false);
    expect(setup.reason).toBe('mobile');
  });

  test('a desktop with no pin runs the governor', () => {
    const setup = resolveGovernorSetup(desktopEnv);
    expect(setup.enabled).toBe(true);
    expect(setup.reason).toBe('desktop');
  });

  test('defaults match the SPEC: 60fps hysteresis band, 2s windows, 8s cooldown, desktop only', () => {
    expect(DEFAULT_GOVERNOR_CONFIG.downFrameMs).toBe(19);
    expect(DEFAULT_GOVERNOR_CONFIG.upFrameMs).toBe(13);
    expect(DEFAULT_GOVERNOR_CONFIG.windowMs).toBe(2000);
    expect(DEFAULT_GOVERNOR_CONFIG.cooldownMs).toBe(8000);
    expect(DEFAULT_GOVERNOR_CONFIG.desktopOnly).toBe(true);
    expect(DEFAULT_GOVERNOR_CONFIG.stallFrameMs).toBe(250);
  });
});
