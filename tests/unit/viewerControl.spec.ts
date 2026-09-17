import { test, expect } from '@playwright/test';
import {
  AUTO_ROTATE_SPEED,
  DEFAULT_IDLE_TIMING,
  idleTiming,
  resolveViewerControl,
} from '../../src/lib/viewerControl';
import type { ViewerHolds } from '../../src/lib/viewerControl';
import { TRANSITIONS } from '../../src/constants/animation';

// No holds: the viewer is freely exploring.
const FREE: ViewerHolds = {
  captureActive: false,
  cinematicActive: false,
  manualPause: false,
  background: false,
  readingCard: false,
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

  test('the epilogue owns the camera: auto rotation stops while it runs', () => {
    const control = resolveViewerControl(55_000, 0, FREE);
    expect(control.epilogueCamera).toBe(true);
    expect(control.autoCamera).toBe('off');
    expect(control.autoRotateSpeed).toBe(0);
    expect(control.reason).toBe('epilogue');
  });
});

test.describe('suppression holds', () => {
  const HOLD_CASES: Array<[string, Partial<ViewerHolds>, string]> = [
    ['manual pause', { manualPause: true }, 'manual-pause'],
    ['background', { background: true }, 'background'],
    ['reading a card', { readingCard: true }, 'reading-card'],
    ['reduced motion', { reduceMotion: true }, 'reduced-motion'],
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
    // Not paused (the viewer resumed) but the system preference still holds.
    const control = resolveViewerControl(600_000, 0, held({ reduceMotion: true, manualPause: false }));
    expect(control.autoCamera).toBe('off');
    expect(control.epilogueCamera).toBe(false);
    expect(control.reason).toBe('reduced-motion');
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
