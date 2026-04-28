import { create } from 'zustand';
import type { StarSystemState, StarParameters, VisualMode, Language, CinematicPhase } from '../types';

interface BinaryStarStore extends StarSystemState {
  parameters: StarParameters;
  setMode: (mode: VisualMode) => void;
  setLanguage: (language: Language) => void;
  setPlaying: (isPlaying: boolean) => void;
  setIntroComplete: (complete: boolean) => void;
  setCinematicPhase: (phase: CinematicPhase) => void;
  setCinematicTime: (time: number) => void;
  setParameter: (key: keyof StarParameters, value: number) => void;
}

const defaultParameters: StarParameters = {
  timeSpeed: 1.0,
};

export const useBinaryStar = create<BinaryStarStore>((set) => ({
  mode: 'explore',
  language: 'en',
  isPlaying: true,
  introComplete: false,
  cinematicPhase: 'dark',
  cinematicTime: 0,
  parameters: defaultParameters,

  setMode: (mode) => set({ mode }),
  setLanguage: (language) => set({ language }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setIntroComplete: (_complete) => set({ introComplete: true, cinematicPhase: 'explore' }),
  setCinematicPhase: (phase) => set({ cinematicPhase: phase }),
  setCinematicTime: (time) => set({ cinematicTime: time }),
  setParameter: (key, value) => set((state) => ({
    parameters: { ...state.parameters, [key]: value },
  })),
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
