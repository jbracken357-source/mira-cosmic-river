import { test, expect } from '@playwright/test';
import {
  AUTO_ROTATE_SPEED,
  DEFAULT_IDLE_TIMING,
  idleTiming,
  resolveViewerControl,
  viewerControlNow,
} from '../../src/lib/viewerControl';
import type { ViewerControlSnapshot, ViewerHolds } from '../../src/lib/viewerControl';
import { TRANSITIONS } from '../../src/constants/animation';
import { useBinaryStar } from '../../src/hooks/useBinaryStar';

// No holds: the viewer is freely exploring.
const FREE: ViewerHolds = {
  captureActive: false,
  cinematicActive: false,
  manualPause: false,
  background: false,
  readingCard: false,
  saving: false,
  reduceMotion: false,
};

function held(partial: Partial<ViewerHolds>): ViewerHolds {
  return { ...FREE, ...partial };
}

test.describe('idle timing', () => {
  test('defaults to 30s resume, 3s ramp, 60s epilogue with the closing-camera lead', () => {
    expect(DEFAULT_IDLE_TIMING.resumeMs).toBe(30_000);
    expect(DEFAULT_IDLE_TIMING.rampMs).toBe(3_000);
    expect(DEFAULT_IDLE_TIMING.epilogueMs).toBe(60_000);
    expect(DEFAULT_IDLE_TIMING.epilogueLeadMs).toBe(TRANSITIONS.CLOSING_CAMERA * 1000);
    // No window and no query params under the node runner: the override drops out.
    expect(idleTiming()).toEqual(DEFAULT_IDLE_TIMING);
  });
});

test.describe('auto camera resume', () => {
  test('stays off while the viewer is active', () => {
    for (const idleMs of [0, 10_000, 29_999]) {
      const control = resolveViewerControl(idleMs, 0, FREE);
      expect(control.autoCamera).toBe('off');
      expect(control.autoRotateSpeed).toBe(0);
      expect(control.rampProgress).toBe(0);
      expect(control.epilogueCamera).toBe(false);
      expect(control.epilogueText).toBe(false);
      expect(control.holdsIdle).toBe(false);
      expect(control.reason).toBe('idle');
    }
  });

  test('ramps over ~3s from the 30s mark instead of snapping', () => {
    const atStart = resolveViewerControl(30_000, 0, FREE);
    expect(atStart.autoCamera).toBe('ramping');
    expect(atStart.rampProgress).toBe(0);
    expect(atStart.autoRotateSpeed).toBe(0);

    const mid = resolveViewerControl(31_500, 0, FREE);
    expect(mid.autoCamera).toBe('ramping');
    expect(mid.rampProgress).toBeCloseTo(0.5, 6);
    expect(mid.autoRotateSpeed).toBeGreaterThan(0);
    expect(mid.autoRotateSpeed).toBeLessThan(AUTO_ROTATE_SPEED);

    const done = resolveViewerControl(33_000, 0, FREE);
    expect(done.autoCamera).toBe('on');
    expect(done.rampProgress).toBe(1);
    expect(done.autoRotateSpeed).toBeCloseTo(AUTO_ROTATE_SPEED, 6);
  });

  test('moves monotonically through the ramp with no jump', () => {
    let previous = 0;
    for (let idleMs = 30_000; idleMs <= 33_000; idleMs += 250) {
      const { autoRotateSpeed } = resolveViewerControl(idleMs, 0, FREE);
      expect(autoRotateSpeed).toBeGreaterThanOrEqual(previous);
      // A snap would show a step near the full speed; the ramp keeps steps small.
      expect(autoRotateSpeed - previous).toBeLessThan(AUTO_ROTATE_SPEED / 3);
      previous = autoRotateSpeed;
    }
    expect(previous).toBeCloseTo(AUTO_ROTATE_SPEED, 6);
  });

  test('auto camera motion does not restamp the clock: later idle measures from the same origin', () => {
    const origin = 5_000;
    expect(resolveViewerControl(origin + 34_000, origin, FREE).autoCamera).toBe('on');
    expect(resolveViewerControl(origin + 29_000, origin, FREE).autoCamera).toBe('off');
  });
});

test.describe('epilogue', () => {
  test('camera leads the text by the closing-camera duration, both from the same origin', () => {
    const origin = 2_000;
    const cameraAt = origin + 60_000 - TRANSITIONS.CLOSING_CAMERA * 1000;

    const before = resolveViewerControl(cameraAt - 1, origin, FREE);
    expect(before.epilogueCamera).toBe(false);

    const camera = resolveViewerControl(cameraAt, origin, FREE);
    expect(camera.epilogueCamera).toBe(true);
    expect(camera.epilogueText).toBe(false);

    const text = resolveViewerControl(origin + 60_000, origin, FREE);
    expect(text.epilogueCamera).toBe(true);
    expect(text.epilogueText).toBe(true);
  });

  test('the epilogue eases the drift out instead of snapping it off', () => {
    const cameraAt = 60_000 - TRANSITIONS.CLOSING_CAMERA * 1000; // 52s

    // Arming the closing camera does not cut the drift: full speed at the arm point.
    const atArm = resolveViewerControl(cameraAt, 0, FREE);
    expect(atArm.epilogueCamera).toBe(true);
    expect(atArm.autoCamera).toBe('ramping');
    expect(atArm.autoRotateSpeed).toBeCloseTo(AUTO_ROTATE_SPEED, 6);

    // Symmetric to the 3s ease-in: the drift eases to zero over one ramp window.
    let previous = atArm.autoRotateSpeed;
    for (let idleMs = cameraAt + 250; idleMs <= cameraAt + 3_000; idleMs += 250) {
      const { autoRotateSpeed } = resolveViewerControl(idleMs, 0, FREE);
      expect(autoRotateSpeed).toBeLessThanOrEqual(previous);
      expect(previous - autoRotateSpeed).toBeLessThan(AUTO_ROTATE_SPEED / 3);
      previous = autoRotateSpeed;
    }
    expect(previous).toBe(0);
    expect(resolveViewerControl(cameraAt + 3_000, 0, FREE).autoCamera).toBe('off');
  });
});

test.describe('suppression holds', () => {
  const HOLD_CASES: Array<[string, Partial<ViewerHolds>, string]> = [
    ['manual pause', { manualPause: true }, 'manual-pause'],
    ['background', { background: true }, 'background'],
    ['reading a card', { readingCard: true }, 'reading-card'],
    ['saving tonight\'s frame', { saving: true }, 'saving'],
  ];

  for (const [name, hold, reason] of HOLD_CASES) {
    test(`${name} suppresses the idle takeover no matter how long the idle run`, () => {
      for (const idleMs of [0, 45_000, 90_000, 600_000]) {
        const control = resolveViewerControl(idleMs, 0, held(hold));
        expect(control.autoCamera).toBe('off');
        expect(control.autoRotateSpeed).toBe(0);
        expect(control.epilogueCamera).toBe(false);
        expect(control.epilogueText).toBe(false);
        expect(control.holdsIdle).toBe(true);
        expect(control.reason).toBe(reason);
      }
    });
  }

  test('capture outranks everything, including the cinematic and manual pause', () => {
    const control = resolveViewerControl(600_000, 0, {
      captureActive: true,
      cinematicActive: true,
      manualPause: true,
      background: true,
      readingCard: true,
      saving: true,
      reduceMotion: true,
    });
    expect(control.reason).toBe('capture');
    expect(control.autoCamera).toBe('off');
    expect(control.epilogueCamera).toBe(false);
    expect(control.holdsIdle).toBe(true);
  });

  test('the full cinematic outranks the idle holds', () => {
    const control = resolveViewerControl(600_000, 0, held({ cinematicActive: true, manualPause: true }));
    expect(control.reason).toBe('cinematic');
    expect(control.holdsIdle).toBe(true);
  });

  test('manual pause outranks background and reading', () => {
    expect(resolveViewerControl(600_000, 0, held({ manualPause: true, background: true })).reason).toBe('manual-pause');
    expect(resolveViewerControl(600_000, 0, held({ manualPause: true, readingCard: true })).reason).toBe('manual-pause');
  });

  test('resuming cannot bypass reduced motion', () => {
    // Not paused (the viewer resumed) but the system preference still holds the camera.
    const control = resolveViewerControl(600_000, 0, held({ reduceMotion: true, manualPause: false }));
    expect(control.autoCamera).toBe('off');
    expect(control.epilogueCamera).toBe(false);
    expect(control.reason).toBe('reduced-motion');
  });
});

test.describe('reduced motion', () => {
  test('never lets the idle loop take the camera, no matter how long the idle run', () => {
    for (const idleMs of [0, 34_000, 51_999, 60_000, 600_000]) {
      const control = resolveViewerControl(idleMs, 0, held({ reduceMotion: true }));
      expect(control.autoCamera).toBe('off');
      expect(control.autoRotateSpeed).toBe(0);
      // No closing camera flight — the preference forbids forced motion.
      expect(control.epilogueCamera).toBe(false);
      expect(control.reason).toBe('reduced-motion');
    }
  });

  test('still allows the epilogue text at the 60s mark, without holding the clock', () => {
    const reduce = held({ reduceMotion: true });
    // Not a hold: idle time accumulates so the text can arrive…
    expect(resolveViewerControl(59_999, 0, reduce).holdsIdle).toBe(false);
    expect(resolveViewerControl(59_999, 0, reduce).epilogueText).toBe(false);
    const atText = resolveViewerControl(60_000, 0, reduce);
    expect(atText.epilogueText).toBe(true);
    expect(atText.epilogueCamera).toBe(false);
    expect(atText.holdsIdle).toBe(false);
  });
});

test.describe('custom timing (dev override shape)', () => {
  const scaled = { resumeMs: 1_000, rampMs: 500, epilogueMs: 2_000, epilogueLeadMs: 400 };

  test('all thresholds follow the supplied timing', () => {
    expect(resolveViewerControl(999, 0, FREE, scaled).autoCamera).toBe('off');
    expect(resolveViewerControl(1_250, 0, FREE, scaled).autoCamera).toBe('ramping');
    expect(resolveViewerControl(1_500, 0, FREE, scaled).autoCamera).toBe('on');
    expect(resolveViewerControl(1_599, 0, FREE, scaled).epilogueCamera).toBe(false);
    expect(resolveViewerControl(1_600, 0, FREE, scaled).epilogueCamera).toBe(true);
    expect(resolveViewerControl(2_000, 0, FREE, scaled).epilogueText).toBe(true);
  });

  test('an epilogue threshold shorter than the lead never goes negative', () => {
    const tight = { resumeMs: 1_000, rampMs: 500, epilogueMs: 2_000, epilogueLeadMs: 8_000 };
    // The camera lead clamps at the origin instead of arming before any idle time.
    expect(resolveViewerControl(0, 0, FREE, tight).epilogueCamera).toBe(false);
    expect(resolveViewerControl(1_999, 0, FREE, tight).epilogueCamera).toBe(false);
    expect(resolveViewerControl(2_000, 0, FREE, tight).epilogueCamera).toBe(true);
  });
});

// The assembled entry the frame loop actually calls: one snapshot in, one verdict
// out. These pin the assembly (clock, holds, reduced motion), not the rules — the
// rules are covered above through resolveViewerControl directly.
test.describe('viewerControlNow (store snapshot assembly)', () => {
  const snapshot = (over: Partial<ViewerControlSnapshot> = {}): ViewerControlSnapshot => ({
    introComplete: true,
    isPlaying: true,
    cardOpen: false,
    tonightSaveOpen: false,
    lastIntentionalInputAt: Date.now(),
    ...over,
  });

  test('a fresh snapshot leaves the camera with the viewer', () => {
    const control = viewerControlNow(snapshot());
    expect(control.autoCamera).toBe('off');
    expect(control.epilogueCamera).toBe(false);
    expect(control.epilogueText).toBe(false);
    expect(control.holdsIdle).toBe(false);
  });

  test('idle thresholds are measured against the snapshot clock', () => {
    // Comfortable margins so the assertions cannot race Date.now(): 35s is past the
    // 30s+3s ramp but well before the 52s closing-camera arm; 61s is past the 60s line.
    const rested = viewerControlNow(snapshot({ lastIntentionalInputAt: Date.now() - 35_000 }));
    expect(rested.autoCamera).toBe('on');
    const epilogue = viewerControlNow(snapshot({ lastIntentionalInputAt: Date.now() - 61_000 }));
    expect(epilogue.epilogueCamera).toBe(true);
    expect(epilogue.epilogueText).toBe(true);
  });

  test('store holds map to their reasons in priority order', () => {
    expect(viewerControlNow(snapshot({ isPlaying: false }), false).reason).toBe('manual-pause');
    expect(viewerControlNow(snapshot({ cardOpen: true }), false).reason).toBe('reading-card');
    expect(viewerControlNow(snapshot({ tonightSaveOpen: true }), false).reason).toBe('saving');
    expect(viewerControlNow(snapshot({ introComplete: false }), false).reason).toBe('cinematic');
  });

  test('reduced motion holds the camera but not the epilogue line', () => {
    const reduce = viewerControlNow(snapshot({ lastIntentionalInputAt: Date.now() - 61_000 }), true);
    expect(reduce.reason).toBe('reduced-motion');
    expect(reduce.epilogueCamera).toBe(false);
    expect(reduce.epilogueText).toBe(true);
  });
});

// The store-level contract a camera flight relies on: while a flight is armed the
// scene restamps the idle clock every frame (an armed flight holds the idle count),
// and interruption is detected by the input sequence, not by comparing timestamps —
// a silent restamp must not look like an interrupt.
test.describe('intentional input bookkeeping', () => {
  test('intentional input bumps the sequence; a silent restamp does not', () => {
    const store = () => useBinaryStar.getState();
    const before = store().inputSeq;

    store().restampIdleClock();
    expect(store().inputSeq).toBe(before);

    store().noteIntentionalInput();
    expect(store().inputSeq).toBe(before + 1);
  });

  test('intentional input dismisses the epilogue in the same event', () => {
    const store = () => useBinaryStar.getState();
    store().setEpilogueVisible(true);
    store().setEpilogueText(true);
    store().noteIntentionalInput();
    expect(store().epilogueVisible).toBe(false);
    expect(store().epilogueText).toBe(false);
    store().setEpilogueVisible(false);
    store().setEpilogueText(false);
  });

  test('replaying the opening clears both epilogue flags for the next landing', () => {
    const store = () => useBinaryStar.getState();
    store().setEpilogueVisible(true);
    store().setEpilogueText(true);
    store().setIntroComplete(false);
    expect(store().epilogueVisible).toBe(false);
    expect(store().epilogueText).toBe(false);
    store().setIntroComplete(true);
  });
});
