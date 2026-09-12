import { create } from 'zustand';
import type { StarSystemState, StarParameters, VisualMode, Language, CinematicPhase } from '../types';
import type { SkyState } from '../lib/starClock';
import { currentSkyState } from '../lib/starClock';

export const SEEN_OPENING_KEY = 'mira:seen-opening';

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

// The clock is read at load and only carried forward from there, so nothing has to read it
// during a render.
const initialSky = currentSkyState();
const seenOpening = hasSeenOpening();

export const useBinaryStar = create<BinaryStarStore>((set) => ({
  mode: 'explore',
  language: 'en',
  isPlaying: true,
  introComplete: seenOpening,
  cinematicPhase: seenOpening ? 'explore' : 'dark',
  cinematicTime: 0,
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
    set({ introComplete: false, cinematicPhase: 'dark', cinematicTime: 0 });
  },
  setCinematicPhase: (phase) => set({ cinematicPhase: phase }),
  setCinematicTime: (time) => set({ cinematicTime: time }),
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
