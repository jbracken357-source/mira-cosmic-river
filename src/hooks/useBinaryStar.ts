import { create } from 'zustand';
import type { StarSystemState, StarParameters, VisualMode, Language, CinematicPhase } from '../types';
import type { SkyState } from '../lib/starClock';
import { currentSkyState } from '../lib/starClock';
import { captureMode } from '../lib/captureMode';

export const SEEN_OPENING_KEY = 'mira:seen-opening';
export const FOUND_TAIL_KEY = 'mira:found-tail';

interface BinaryStarStore extends StarSystemState {
  parameters: StarParameters;
  sky: SkyState;
  setMode: (mode: VisualMode) => void;
  setLanguage: (language: Language) => void;
  setPlaying: (isPlaying: boolean) => void;
  setIntroComplete: (complete: boolean) => void;
  setCinematicPhase: (phase: CinematicPhase) => void;
  setCinematicTime: (time: number) => void;
  setParameter: (key: keyof StarParameters, value: number) => void;
  setSky: (sky: SkyState) => void;
  epilogueVisible: boolean;
  setEpilogueVisible: (visible: boolean) => void;
}

const defaultParameters: StarParameters = {
  timeSpeed: 1.0,
};

function hasSeenOpening(): boolean {
  try {
    return globalThis.localStorage?.getItem(SEEN_OPENING_KEY) === '1';
  } catch {
    return false;
  }
}

function persistOpeningSeen() {
  try {
    globalThis.localStorage?.setItem(SEEN_OPENING_KEY, '1');
  } catch {
    // Private mode / blocked storage: the session still works, it just won't remember.
  }
}

export function hasFoundTail(): boolean {
  try {
    return globalThis.localStorage?.getItem(FOUND_TAIL_KEY) === '1';
  } catch {
    return false;
  }
}

export function persistFoundTail() {
  try {
    globalThis.localStorage?.setItem(FOUND_TAIL_KEY, '1');
  } catch {
    // Private mode / blocked storage: the session still works, it just won't remember.
  }
}

// The clock is read at load and only carried forward from there, so nothing has to read it
// during a render.
const initialSky = currentSkyState();
// Capture mode skips the full cinematic: a baseline always starts from direct entry, without
// persisting the seen-opening flag.
const startInExplore = captureMode().active || hasSeenOpening();

export const useBinaryStar = create<BinaryStarStore>((set) => ({
  mode: 'explore',
  language: 'ch',
  isPlaying: true,
  introComplete: startInExplore,
  cinematicPhase: startInExplore ? 'explore' : 'dark',
  cinematicTime: 0,
  epilogueVisible: false,
  parameters: defaultParameters,
  sky: initialSky,

  setMode: (mode) => set({ mode }),
  setLanguage: (language) => set({ language }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setIntroComplete: (complete) => {
    if (complete) {
      persistOpeningSeen();
      set({ introComplete: true, cinematicPhase: 'explore' });
      return;
    }
    // Replay: the seen flag stays. Clearing storage is how a first visit is restored.
    set({ introComplete: false, cinematicPhase: 'dark', cinematicTime: 0, epilogueVisible: false });
  },
  setCinematicPhase: (phase) => set({ cinematicPhase: phase }),
  setCinematicTime: (time) => set({ cinematicTime: time }),
  setEpilogueVisible: (epilogueVisible) => set({ epilogueVisible }),
  setParameter: (key, value) => set((state) => ({
    parameters: { ...state.parameters, [key]: value },
  })),
  setSky: (sky) => set({ sky }),
}));

export function useTimeSpeed() {
  return useBinaryStar((state) => state.parameters.timeSpeed);
}

export function useCinematicPhase() {
  return useBinaryStar((state) => state.cinematicPhase);
}

export function useLanguage() {
  return useBinaryStar((state) => state.language);
}
