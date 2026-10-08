import { test, expect } from '@playwright/test';
import { advanceTime, parkedFade } from '../../src/lib/captureMode';
import { ENTRY_FADE_MS, materialFade } from '../../src/lib/entryReadiness';

// The capture parking invariants (#66): a capture is the settled scene, so every
// 入场 (arrival) presence value parks at its endpoint while capture is active, and
// the non-capture path is the untouched fade — same endpoints, same half-second
// ramp. The expectations are hand-written per row, not recomputed from the helpers.

test.describe('parkedFade', () => {
  test('capture active parks every fade at 1, including a material that never bound', () => {
    expect(parkedFade(0, true)).toBe(1);
    expect(parkedFade(0.5, true)).toBe(1);
    expect(parkedFade(1, true)).toBe(1);
    // The never-bound case as the components compute it: materialFade(null, ·) is 0.
    expect(parkedFade(materialFade(null, 10_000), true)).toBe(1);
  });

  test('capture inactive leaves the fade exactly as materialFade produced it', () => {
    const boundAt = 10_000;
    expect(parkedFade(materialFade(null, boundAt), false)).toBe(0);
    expect(parkedFade(materialFade(boundAt, boundAt), false)).toBe(0);
    expect(parkedFade(materialFade(boundAt, boundAt + ENTRY_FADE_MS / 2), false)).toBeCloseTo(0.5);
    expect(parkedFade(materialFade(boundAt, boundAt + ENTRY_FADE_MS), false)).toBe(1);
    // Clamped past the deadline, never beyond one.
    expect(parkedFade(materialFade(boundAt, boundAt + ENTRY_FADE_MS * 10), false)).toBe(1);
  });

  // The call-site path: components pass no flag, so the default reads the ambient
  // cached mode. This unit environment has no window and no ?capture=1 — the
  // default must agree with the explicit inactive flag point for point.
  test('the defaulted flag reads the ambient mode and matches explicit inactive', () => {
    const boundAt = 10_000;
    const samples = [boundAt, boundAt + ENTRY_FADE_MS / 2, boundAt + ENTRY_FADE_MS, boundAt + 5_000];
    for (const now of samples) {
      expect(parkedFade(materialFade(boundAt, now))).toBe(
        parkedFade(materialFade(boundAt, now), false),
      );
    }
    expect(parkedFade(materialFade(null, 10_000))).toBe(0);
  });
});

// advanceTime is the pause contract for every scene clock — the orbit, the
// opening, and the shared journey (共同前行) all freeze through this one seam.
// These pins are the hold half of that contract (the deleted sharedJourney.spec
// tautology claimed it without testing anything); the scene wiring is covered by
// the pause e2e, which reads the pair's screen probe while paused.
test.describe('advanceTime', () => {
  test('paused and reduced-motion clocks hold their value exactly', () => {
    expect(advanceTime(10, 0.016, { reduceMotion: true })).toBe(10);
    expect(advanceTime(10, 0.016, { reduceMotion: false, paused: true })).toBe(10);
    expect(advanceTime(10, 5, { reduceMotion: true })).toBe(10);
  });

  test('the running clock advances by the clamped delta, scaled; a hidden tab holds', () => {
    // The happy path reads document.hidden; this unit environment has no DOM, so
    // the probe installs a minimal stand-in and always restores what was there.
    const globals = globalThis as { document?: { hidden: boolean } };
    const original = globals.document;
    globals.document = { hidden: false };
    try {
      expect(advanceTime(10, 0.016, { reduceMotion: false })).toBeCloseTo(10.016, 12);
      expect(advanceTime(10, 0.016, { reduceMotion: false, scale: 0.08 })).toBeCloseTo(
        10 + 0.016 * 0.08,
        12,
      );
      // The delta clamps at 50 ms: one stalled frame cannot lurch the scene.
      expect(advanceTime(10, 0.5, { reduceMotion: false })).toBeCloseTo(10.05, 12);
      // A hidden tab holds the clock, so coming back cannot fast-forward the sky.
      globals.document = { hidden: true };
      expect(advanceTime(10, 0.016, { reduceMotion: false })).toBe(10);
    } finally {
      if (original === undefined) delete globals.document;
      else globals.document = original;
    }
  });
});
