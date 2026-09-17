import { test, expect } from '@playwright/test';
import {
  TONIGHT_EXPORT_LONG_EDGE,
  fitExportSize,
  formatTonightDate,
  initialTonightSaveState,
  tonightFilename,
  tonightPhrase,
  transition,
} from '../../src/lib/tonightSave';
import type { TonightSaveState } from '../../src/lib/tonightSave';
import { TRANSLATIONS } from '../../src/constants/translations';

// 今晚的 Mira (#23): the pure half of the save flow. No canvas, no DOM — sizing,
// naming, the fixed phrase, and the state machine that guarantees one snapshot per
// save action, retry of the same snapshot, and no task stacking.

function effectTypes(state: TonightSaveState, event: Parameters<typeof transition>[1]) {
  return transition(state, event).effects.map((effect) => effect.type);
}

// Walk the happy path: idle -> capturing -> preview.
function inPreview(): TonightSaveState {
  const capturing = transition(initialTonightSaveState(), 'open').state;
  return transition(capturing, 'captured').state;
}

test.describe('export sizing', () => {
  test('keeps the source size when the long edge is already within the cap', () => {
    expect(fitExportSize(1280, 720)).toEqual({ width: 1280, height: 720 });
    expect(fitExportSize(390, 844)).toEqual({ width: 390, height: 844 });
    // Never upscale, even when far below the cap.
    expect(fitExportSize(300, 150)).toEqual({ width: 300, height: 150 });
  });

  test('caps the long edge and keeps the aspect ratio', () => {
    const landscape = fitExportSize(5120, 2880);
    expect(landscape).toEqual({ width: TONIGHT_EXPORT_LONG_EDGE, height: 1440 });

    const portrait = fitExportSize(1440, 5120);
    expect(portrait.height).toBe(TONIGHT_EXPORT_LONG_EDGE);
    expect(portrait.width / portrait.height).toBeCloseTo(1440 / 5120, 5);

    const square = fitExportSize(4000, 4000);
    expect(square).toEqual({ width: TONIGHT_EXPORT_LONG_EDGE, height: TONIGHT_EXPORT_LONG_EDGE });
  });

  test('rounds to whole pixels and never lets either edge exceed the cap', () => {
    const size = fitExportSize(3333, 1111);
    expect(Number.isInteger(size.width)).toBe(true);
    expect(Number.isInteger(size.height)).toBe(true);
    expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(TONIGHT_EXPORT_LONG_EDGE);
    expect(size.width / size.height).toBeCloseTo(3333 / 1111, 2);
  });

  test('a source exactly at the cap is kept, not resampled', () => {
    expect(fitExportSize(TONIGHT_EXPORT_LONG_EDGE, 1000)).toEqual({
      width: TONIGHT_EXPORT_LONG_EDGE,
      height: 1000,
    });
  });

  test('degenerate sources clamp to one pixel instead of producing zero or NaN', () => {
    expect(fitExportSize(0, 720)).toEqual({ width: 1, height: 720 });
    expect(fitExportSize(1280, 0)).toEqual({ width: 1280, height: 1 });
    expect(fitExportSize(0, 0)).toEqual({ width: 1, height: 1 });
  });

  test('honours a smaller cap for callers that ask', () => {
    expect(fitExportSize(1280, 720, 640)).toEqual({ width: 640, height: 360 });
  });
});

test.describe('filename and date', () => {
  test('the filename is date-stamped from the local save moment', () => {
    const at = new Date(2026, 8, 17, 23, 5, 9); // local 2026-09-17, late evening
    expect(tonightFilename(at)).toBe('mira-tonight-2026-09-17.png');
  });

  test('month and day are zero-padded', () => {
    expect(tonightFilename(new Date(2026, 0, 5))).toBe('mira-tonight-2026-01-05.png');
  });

  test('the overlay date follows the language', () => {
    const at = new Date(2026, 8, 17);
    expect(formatTonightDate(at, 'ch')).toBe('2026年9月17日');
    expect(formatTonightDate(at, 'en')).toBe('September 17, 2026');
  });
});

test.describe('fixed phrase', () => {
  test('one fixed companionship phrase per language, recorded in the translations', () => {
    expect(tonightPhrase('ch')).toBe('彼此牵引，共同前行');
    expect(tonightPhrase('en')).toBe('Drawn to each other, travelling together');
    // The copy lives with the rest of the viewer-facing text, not in a second source.
    expect(TRANSLATIONS.ch.tonightPhrase).toBe(tonightPhrase('ch'));
    expect(TRANSLATIONS.en.tonightPhrase).toBe(tonightPhrase('en'));
  });
});

test.describe('save flow state machine', () => {
  test('opening from idle captures immediately and starts with a clean slate', () => {
    const { state, effects } = transition(initialTonightSaveState(), 'open');
    expect(state.phase).toBe('capturing');
    expect(state.snapshot).toBeNull();
    expect(state.failure).toBeNull();
    // Default is the pure frame: date and phrase are opt-in.
    expect(state.overlays).toEqual({ date: false, phrase: false });
    expect(effects).toEqual([{ type: 'capture' }]);
  });

  test('a successful capture lands in preview with the snapshot locked', () => {
    const capturing = transition(initialTonightSaveState(), 'open').state;
    const { state, effects } = transition(capturing, 'captured');
    expect(state.phase).toBe('preview');
    expect(state.snapshot).not.toBeNull();
    expect(effects).toEqual([]);
  });

  test('reopening while the flow is live never stacks a second capture', () => {
    const open = transition(initialTonightSaveState(), 'open');
    expect(effectTypes(open.state, 'open')).toEqual([]);
    const preview = inPreview();
    expect(effectTypes(preview, 'open')).toEqual([]);
    const exporting = transition(preview, 'export').state;
    expect(effectTypes(exporting, 'open')).toEqual([]);
    expect(transition(exporting, 'open').state.phase).toBe('exporting');
  });

  test('overlay toggles re-compose the same snapshot, never a fresh capture', () => {
    const preview = inPreview();
    const withDate = transition(preview, 'toggle-date');
    expect(withDate.state.overlays).toEqual({ date: true, phrase: false });
    expect(withDate.state.snapshot).toBe(preview.snapshot);
    expect(withDate.effects).toEqual([]);
    const withBoth = transition(withDate.state, 'toggle-phrase');
    expect(withBoth.state.overlays).toEqual({ date: true, phrase: true });
    // Toggles are toggles.
    expect(transition(withBoth.state, 'toggle-date').state.overlays.date).toBe(false);
  });

  test('export runs once per press and success settles', () => {
    const preview = inPreview();
    const { state, effects } = transition(preview, 'export');
    expect(state.phase).toBe('exporting');
    expect(effects).toEqual([{ type: 'export' }]);
    // Rapid repeated presses mid-export are no-ops.
    expect(effectTypes(state, 'export')).toEqual([]);
    const done = transition(state, 'exported');
    expect(done.state.phase).toBe('success');
    expect(done.effects).toEqual([]);
  });

  test('an export failure keeps the snapshot and retries the SAME snapshot', () => {
    const exporting = transition(inPreview(), 'export').state;
    const locked = exporting.snapshot;
    const failed = transition(exporting, 'export-failed');
    expect(failed.state.phase).toBe('failed');
    expect(failed.state.failure).toBe('export');
    expect(failed.state.snapshot).toBe(locked);

    const retry = transition(failed.state, 'retry');
    expect(retry.state.phase).toBe('exporting');
    // Re-export, never re-capture: the frame stays the one the viewer pressed.
    expect(retry.effects).toEqual([{ type: 'export' }]);
    expect(retry.state.snapshot).toBe(locked);
  });

  test('a capture failure retries with a fresh capture (there is no snapshot to reuse)', () => {
    const capturing = transition(initialTonightSaveState(), 'open').state;
    const failed = transition(capturing, 'capture-failed');
    expect(failed.state.phase).toBe('failed');
    expect(failed.state.failure).toBe('capture');
    expect(failed.state.snapshot).toBeNull();
    const retry = transition(failed.state, 'retry');
    expect(retry.state.phase).toBe('capturing');
    expect(retry.effects).toEqual([{ type: 'capture' }]);
  });

  test('a lost WebGL context is its own honest failure', () => {
    const capturing = transition(initialTonightSaveState(), 'open').state;
    const { state } = transition(capturing, 'context-lost');
    expect(state.phase).toBe('failed');
    expect(state.failure).toBe('context-lost');
    expect(state.snapshot).toBeNull();
  });

  test('closing discards the snapshot; reopening captures a fresh one', () => {
    const preview = inPreview();
    const first = preview.snapshot;
    const closed = transition(preview, 'close');
    expect(closed.state.phase).toBe('idle');
    expect(closed.state.snapshot).toBeNull();
    expect(closed.effects).toEqual([{ type: 'discard' }]);

    const reopened = transition(closed.state, 'open');
    expect(reopened.effects).toEqual([{ type: 'capture' }]);
    const second = transition(reopened.state, 'captured');
    // A new save action, a new snapshot.
    expect(second.state.snapshot).not.toBe(first);
    expect(second.state.snapshot).not.toBeNull();
  });

  test('closing mid-export discards and never reports success afterwards', () => {
    const exporting = transition(inPreview(), 'export').state;
    const closed = transition(exporting, 'close');
    expect(closed.state.phase).toBe('idle');
    expect(closed.effects).toEqual([{ type: 'discard' }]);
    // A late export result lands nowhere.
    expect(transition(closed.state, 'exported').state.phase).toBe('idle');
    expect(transition(closed.state, 'export-failed').state.phase).toBe('idle');
  });

  test('events that make no sense in a phase are silent no-ops', () => {
    const idle = initialTonightSaveState();
    for (const event of ['captured', 'exported', 'export-failed', 'retry', 'export'] as const) {
      const { state, effects } = transition(idle, event);
      expect(state).toEqual(idle);
      expect(effects).toEqual([]);
    }
    // Close in idle stays idle and discards nothing.
    expect(transition(idle, 'close').effects).toEqual([]);
    // Toggles do nothing before a snapshot exists.
    expect(effectTypes(idle, 'toggle-date')).toEqual([]);
  });
});
