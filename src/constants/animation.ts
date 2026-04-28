// Cinematic sequence timing for Mira Cosmic River
// 15-second opening: dark → stars appear → pull back → tail reveal → explore

export const CINEMATIC = {
  // Phase timing (cumulative seconds from start)
  DARK_START: 0,
  STARS_APPEAR: 2.0,       // Stars materialize
  PULL_BACK_START: 4.0,    // Camera begins pulling back
  PULL_BACK_END: 12.0,     // Pull back completes (8 seconds)
  TAIL_REVEAL_START: 8.0,  // Tail becomes visible during pull-back
  TAIL_FULL: 11.0,         // Tail fully visible
  FINAL_TEXT: 12.5,        // Final title text
  EXPLORE_MODE: 15.0,      // Free exploration begins
} as const;

// Camera positions for each phase
export const CAMERA = {
  // Phase 1: Tight on the binary stars
  CLOSE: {
    position: [6, 2, 8] as [number, number, number],
    lookAt: [0, 0, 0] as [number, number, number],
    fov: 35,
  },
  // Phase 2: Mid-distance, stars small, tail hint
  MID: {
    position: [10, 4, 14] as [number, number, number],
    lookAt: [0, 0, 0] as [number, number, number],
    fov: 45,
  },
  // Phase 3: Far back, tail dominates
  FAR: {
    position: [5, 8, 30] as [number, number, number],
    lookAt: [0, 2, -8] as [number, number, number],
    fov: 55,
  },
  // Exploration: closer angle that keeps tail in frame
  EXPLORE: {
    position: [10, 5, 18] as [number, number, number],
    lookAt: [-2, 1, 2] as [number, number, number],
    fov: 45,
  },
  // FOV range during pull-back
  FOV_START: 35,
  FOV_END: 55,
} as const;

// Transition durations
export const TRANSITIONS = {
  FADE_IN: 1.5,          // Black → stars fade in
  STAR_REVEAL: 2.0,      // Stars fully materialize
  PULL_BACK: 8.0,        // Camera pull-back duration
  TAIL_FADE_IN: 3.0,     // Tail opacity 0 → 1
  FINAL_TEXT_FADE: 1.5,  // Final title fade in
  EXPLORE_TRANSITION: 0.5,
} as const;

// Spring physics for Framer Motion
export const SPRING = {
  gentle: {
    type: 'spring',
    stiffness: 100,
    damping: 15,
  },
  smooth: {
    type: 'spring',
    stiffness: 50,
    damping: 20,
  },
} as const;

// Easing functions
export const EASE = {
  OUT: [0.16, 1, 0.3, 1],
  IN_OUT: [0.65, 0, 0.35, 1],
} as const;
