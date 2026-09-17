import { test, expect } from '@playwright/test';
import {
  MATERIALS_TIMEOUT_MS,
  initialMaterials,
  noteMaterial,
  timeoutMaterials,
  resolveEntryGate,
  gateAllowsCinematic,
  probeWebGLSupport,
  reduceSceneAccess,
} from '../../src/lib/entryReadiness';

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
