import { create } from 'zustand';
import type { StarSystemState, StarParameters, VisualMode, Language } from '../types';

interface BinaryStarStore extends StarSystemState {
  parameters: StarParameters;
  setMode: (mode: VisualMode) => void;
  setLanguage: (language: Language) => void;
  setPlaying: (isPlaying: boolean) => void;
  setIntroComplete: (complete: boolean) => void;
  setParameter: (key: keyof StarParameters, value: number) => void;
  resetParameters: () => void;
}

// Default parameters
const defaultParameters: StarParameters = {
  primaryColor: 30,      // Orange-ish hue
  secondaryColor: 270,   // Violet-ish hue
  turbulence: 0.3,
  orbitSpeed: 1.0,
  bloomIntensity: 1.5,
  particleDensity: 3000,
};

export const useBinaryStar = create<BinaryStarStore>((set) => ({
  // Initial state
  mode: 'glow',
  language: 'en',
  isPlaying: true,
  introComplete: false,
  parameters: defaultParameters,

  // Actions
  setMode: (mode) => set({ mode }),
  setLanguage: (language) => set({ language }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setIntroComplete: (complete) => set({ introComplete: complete }),
  setParameter: (key, value) => set((state) => ({
    parameters: { ...state.parameters, [key]: value },
  })),
  resetParameters: () => set({ parameters: defaultParameters }),
}));

// Hook for accessing parameters only (optimized for components that don't need state)
export function useParameters() {
  return useBinaryStar((state) => state.parameters);
}

// Hook for accessing mode only
export function useVisualMode() {
  return useBinaryStar((state) => state.mode);
}

// Hook for accessing language only
export function useLanguage() {
  return useBinaryStar((state) => state.language);
}