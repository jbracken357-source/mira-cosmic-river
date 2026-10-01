import { test, expect } from '@playwright/test';
import { parkedFade } from '../../src/lib/captureMode';
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
