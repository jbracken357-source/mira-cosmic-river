import { create } from 'zustand';
import {
  detectWebGLSupport,
  initialMaterials,
  noteMaterial,
  reduceSceneAccess,
  resolveEntryGate,
  timeoutMaterials,
} from '../lib/entryReadiness';
import type { EntryGate, MaterialName, MaterialSet, SceneAccess, SceneAccessEvent } from '../lib/entryReadiness';

// The live counterpart to lib/entryReadiness (#24): real load results and
// canvas events land here, the pure module decides. The gate opens exactly
// once per visit (settled states are sticky), so a late texture can fade in
// without re-litigating the decision the opening already started on.
interface EntryReadinessStore {
  materials: MaterialSet;
  gate: EntryGate;
  sceneAccess: SceneAccess;
  noteMaterial: (name: MaterialName, outcome: 'ready' | 'failed') => void;
  noteMaterialsTimedOut: () => void;
  noteSceneAccess: (event: SceneAccessEvent) => void;
}

// WebGL is probed once, at module load: if no context can be created at all,
// App never mounts the canvas and goes straight to the static fallback.
const initialAccess: SceneAccess = detectWebGLSupport();

export const useEntryReadiness = create<EntryReadinessStore>((set) => ({
  materials: initialMaterials(),
  gate: 'waiting',
  sceneAccess: initialAccess,
  noteMaterial: (name, outcome) =>
    set((state) => {
      const materials = noteMaterial(state.materials, name, outcome);
      return { materials, gate: resolveEntryGate(materials) };
    }),
  noteMaterialsTimedOut: () =>
    set((state) => {
      const materials = timeoutMaterials(state.materials);
      return { materials, gate: resolveEntryGate(materials) };
    }),
  noteSceneAccess: (event) =>
    set((state) => ({ sceneAccess: reduceSceneAccess(state.sceneAccess, event) })),
}));
