import { test, expect } from '@playwright/test';
import {
  ENTRY_FADE_MS,
  MATERIALS_TIMEOUT_MS,
  VEIL_UNMOUNT_MARGIN_MS,
  materialFade,
  initialMaterials,
  noteMaterial,
  timeoutMaterials,
  resolveEntryGate,
  gateAllowsCinematic,
  probeWebGLSupport,
  reduceSceneAccess,
  veilHoldsScreen,
} from '../../src/lib/entryReadiness';
import type { EntryGate } from '../../src/lib/entryReadiness';

// The entry readiness gate (#24): the full cinematic starts only once the main
// materials — or a meaningful procedural fallback — can actually be presented.
// Pending loads are bounded by MATERIALS_TIMEOUT_MS; slow networks and 404s
// must never hold the opening forever.

test.describe('material readiness', () => {
  test('starts with every material pending and the gate waiting', () => {
    const materials = initialMaterials();
    expect(materials.river).toBe('pending');
    expect(materials.surface).toBe('pending');
    expect(resolveEntryGate(materials)).toBe('waiting');
    expect(gateAllowsCinematic(resolveEntryGate(materials))).toBe(false);
  });

  test('all materials ready opens the gate on the textured path', () => {
    let materials = initialMaterials();
    materials = noteMaterial(materials, 'river', 'ready');
    expect(resolveEntryGate(materials)).toBe('waiting');
    materials = noteMaterial(materials, 'surface', 'ready');
    expect(resolveEntryGate(materials)).toBe('materials');
    expect(gateAllowsCinematic('materials')).toBe(true);
  });

  test('a failed material settles the gate on the procedural fallback path', () => {
    let materials = initialMaterials();
    materials = noteMaterial(materials, 'river', 'failed');
    // The other material still gets its chance within the budget.
    expect(resolveEntryGate(materials)).toBe('waiting');
    materials = noteMaterial(materials, 'surface', 'ready');
    expect(resolveEntryGate(materials)).toBe('fallback');
    expect(gateAllowsCinematic('fallback')).toBe(true);
  });

  test('every material failing still opens the gate — fallback, never a stall', () => {
    let materials = initialMaterials();
    materials = noteMaterial(materials, 'river', 'failed');
    materials = noteMaterial(materials, 'surface', 'failed');
    expect(resolveEntryGate(materials)).toBe('fallback');
  });

  test('a material that never answers is bounded by the timeout', () => {
    let materials = initialMaterials();
    materials = noteMaterial(materials, 'surface', 'ready');
    // river hangs: the gate stays waiting until the budget is spent.
    expect(resolveEntryGate(materials)).toBe('waiting');
    materials = timeoutMaterials(materials);
    expect(materials.river).toBe('timed-out');
    expect(materials.surface).toBe('ready');
    expect(resolveEntryGate(materials)).toBe('fallback');
  });

  test('a timeout with nothing settled still opens the gate', () => {
    const materials = timeoutMaterials(initialMaterials());
    expect(resolveEntryGate(materials)).toBe('fallback');
  });

  test('settled states are sticky — a late answer never rewrites history', () => {
    let materials = initialMaterials();
    materials = noteMaterial(materials, 'river', 'failed');
    // The texture arriving after the failure was declared must not flip the
    // recorded state: the opening already started on the fallback.
    materials = noteMaterial(materials, 'river', 'ready');
    expect(materials.river).toBe('failed');
    materials = timeoutMaterials(materials);
    materials = noteMaterial(materials, 'surface', 'ready');
    expect(materials.surface).toBe('timed-out');
  });

  test('noteMaterial and timeoutMaterials are pure — inputs are not mutated', () => {
    const materials = initialMaterials();
    const after = noteMaterial(materials, 'river', 'ready');
    expect(materials.river).toBe('pending');
    expect(after.river).toBe('ready');
    const timedOut = timeoutMaterials(materials);
    expect(materials.surface).toBe('pending');
    expect(timedOut.surface).toBe('timed-out');
  });

  test('the timeout is a real bound, not a token constant', () => {
    expect(MATERIALS_TIMEOUT_MS).toBeGreaterThanOrEqual(1000);
    expect(MATERIALS_TIMEOUT_MS).toBeLessThanOrEqual(10000);
  });
});

test.describe('WebGL availability', () => {
  test('a working context probe means available', () => {
    expect(probeWebGLSupport(() => ({}) )).toBe('available');
  });

  test('a null context means unavailable', () => {
    expect(probeWebGLSupport(() => null)).toBe('unavailable');
  });

  test('a throwing probe means unavailable, never an exception to the caller', () => {
    expect(probeWebGLSupport(() => {
      throw new Error('blocked');
    })).toBe('unavailable');
  });
});

test.describe('scene access transitions', () => {
  test('a live scene can lose its context and be restored exactly once per loss', () => {
    expect(reduceSceneAccess('available', 'context-lost')).toBe('lost');
    expect(reduceSceneAccess('lost', 'context-restored')).toBe('available');
  });

  test('restore without a loss is a no-op, so recovery cannot double-register', () => {
    expect(reduceSceneAccess('available', 'context-restored')).toBe('available');
    expect(reduceSceneAccess('unavailable', 'context-restored')).toBe('unavailable');
  });

  test('unavailable is terminal for this page load — only retry (reload) leaves it', () => {
    expect(reduceSceneAccess('unavailable', 'context-lost')).toBe('unavailable');
    expect(reduceSceneAccess('lost', 'context-lost')).toBe('lost');
  });

  test('a failed canvas creation lands in unavailable from any state', () => {
    expect(reduceSceneAccess('available', 'create-failed')).toBe('unavailable');
    expect(reduceSceneAccess('lost', 'create-failed')).toBe('unavailable');
  });
});

test.describe('arrival fade', () => {
  test('is zero until the texture binds, then rises linearly to exactly one', () => {
    expect(materialFade(null, 10_000)).toBe(0);
    const boundAt = 10_000;
    expect(materialFade(boundAt, boundAt)).toBe(0);
    expect(materialFade(boundAt, boundAt + ENTRY_FADE_MS / 2)).toBeCloseTo(0.5);
    expect(materialFade(boundAt, boundAt + ENTRY_FADE_MS)).toBe(1);
    // Clamped, never past one — the baseline harness reads exactly 1 as ready.
    expect(materialFade(boundAt, boundAt + ENTRY_FADE_MS * 10)).toBe(1);
  });

  test('the fade is a real duration, not a token constant', () => {
    expect(ENTRY_FADE_MS).toBeGreaterThanOrEqual(150);
    expect(ENTRY_FADE_MS).toBeLessThanOrEqual(1500);
  });
});

// The veil's hold on the screen (#65): one pure verdict for the loading still.
// Three inputs — the canvas exists, the opening is already behind the viewer,
// and the entry gate — decide whether the veil still covers everything. The
// expectations below are hand-written per row, not recomputed from the
// implementation.
const VEIL_TRUTH_TABLE: {
  canvasReady: boolean;
  openingPassed: boolean;
  gate: EntryGate;
  holds: boolean;
}[] = [
  // No canvas yet: there is nothing to hand off to, whatever the gate says.
  { canvasReady: false, openingPassed: false, gate: 'waiting', holds: true },
  { canvasReady: false, openingPassed: false, gate: 'materials', holds: true },
  { canvasReady: false, openingPassed: false, gate: 'fallback', holds: true },
  { canvasReady: false, openingPassed: true, gate: 'waiting', holds: true },
  { canvasReady: false, openingPassed: true, gate: 'materials', holds: true },
  { canvasReady: false, openingPassed: true, gate: 'fallback', holds: true },
  // Canvas up, opening still ahead, gate waiting: the full cinematic waits.
  { canvasReady: true, openingPassed: false, gate: 'waiting', holds: true },
  // Gate settled on either path: the dissolve may begin.
  { canvasReady: true, openingPassed: false, gate: 'materials', holds: false },
  { canvasReady: true, openingPassed: false, gate: 'fallback', holds: false },
  // Canvas up, opening behind: direct entry waits on the canvas alone
  // (ADR-0001) — even a still-waiting gate adds no ceremony to a return visit.
  { canvasReady: true, openingPassed: true, gate: 'waiting', holds: false },
  { canvasReady: true, openingPassed: true, gate: 'materials', holds: false },
  { canvasReady: true, openingPassed: true, gate: 'fallback', holds: false },
];

test.describe('veil hold on screen', () => {
  for (const row of VEIL_TRUTH_TABLE) {
    test(`canvasReady=${row.canvasReady} openingPassed=${row.openingPassed} gate=${row.gate} — ${row.holds ? 'holds' : 'lifts'}`, () => {
      expect(
        veilHoldsScreen({
          canvasReady: row.canvasReady,
          openingPassed: row.openingPassed,
          gate: row.gate,
        }),
      ).toBe(row.holds);
    });
  }

  test('full opening: the veil waits for the canvas, then the gate, then never returns', () => {
    // A first visit, as the inputs actually move: nothing ready, then the
    // canvas exists while materials still load, then the gate settles, then
    // the opening completes. The fall is one-way in practice — canvasReady and
    // openingPassed never revert within a visit, and the gate's settled states
    // are sticky — so no later event can re-cover the screen.
    expect(veilHoldsScreen({ canvasReady: false, openingPassed: false, gate: 'waiting' })).toBe(true);
    expect(veilHoldsScreen({ canvasReady: true, openingPassed: false, gate: 'waiting' })).toBe(true);
    expect(veilHoldsScreen({ canvasReady: true, openingPassed: false, gate: 'materials' })).toBe(false);
    expect(veilHoldsScreen({ canvasReady: true, openingPassed: false, gate: 'fallback' })).toBe(false);
    expect(veilHoldsScreen({ canvasReady: true, openingPassed: true, gate: 'materials' })).toBe(false);
  });

  test('direct entry: the veil waits on the canvas alone, the gate never enters the path', () => {
    // ADR-0001: a return visit skips the opening, so the veil lifts the moment
    // the canvas exists — even while the materials are still loading.
    expect(veilHoldsScreen({ canvasReady: false, openingPassed: true, gate: 'waiting' })).toBe(true);
    expect(veilHoldsScreen({ canvasReady: true, openingPassed: true, gate: 'waiting' })).toBe(false);
  });

  test('the unmount margin is a real allowance, not a token constant', () => {
    // Enough to cover one lagging unmount commit under software GL, small
    // enough that teardown never reads as a second wait.
    expect(VEIL_UNMOUNT_MARGIN_MS).toBeGreaterThanOrEqual(50);
    expect(VEIL_UNMOUNT_MARGIN_MS).toBeLessThanOrEqual(1000);
  });
});
