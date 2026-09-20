// Language options
export type Language = 'en' | 'ch';

// Cinematic phases for the opening sequence
export type CinematicPhase = 'dark' | 'stars-appear' | 'pull-back' | 'tail-reveal' | 'explore';

// Main state interface for the star system
export interface StarSystemState {
  language: Language;
  isPlaying: boolean;
  introComplete: boolean;
  cinematicPhase: CinematicPhase;
  cinematicTime: number; // 0-15 seconds
}

// Adjustable parameters for the visualization
export interface StarParameters {
  timeSpeed: number;       // 0.1-5.0x (only control in new design)
}

// Translation dictionary (simplified for new design)
export interface TranslationDict {
  title: string;
  subtitle: string;
  cinematic1: string;
  cinematic2: string;
  cinematic3: string;
  miraA: string;
  miraADesc: string;
  miraB: string;
  miraBDesc: string;
  tailLabel: string;
  tailDesc: string;
  timeSpeed: string;
  interactionHint: string;
  replayOpening: string;
  pause: string;
  resume: string;
  returnToView: string;
  tailHint: string;
  tailFound: string;
  loading: string;
  closingMessage: string;
}

// Where the two stars are right now, in world space. Scene.tsx updates it every frame and the
// components that need to point at a star (the stream, the disk's hot spot) read it.
export interface OrbitPositions {
  primary: [number, number, number];
  secondary: [number, number, number];
}