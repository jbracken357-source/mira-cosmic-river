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
    position: [8, 3, 13] as [number, number, number],
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
    position: [8, 8, 30] as [number, number, number],
    lookAt: [-3, 1, 5] as [number, number, number],
    fov: 50,
  },
  // Exploration: closer angle that keeps tail in frame
  EXPLORE: {
    position: [8, 7, 28] as [number, number, number],
    lookAt: [-3, 1, 5] as [number, number, number],
    fov: 45,
  },
  // Idle hold, not explore framing
  CLOSING: {
    position: [8, 10, 34] as [number, number, number],
    lookAt: [-4, 0, 6] as [number, number, number],
    fov: 48,
  },
  // FOV range during pull-back
  FOV_START: 35,
  FOV_END: 50,
} as const;

// The same space is composed diagonally in portrait, giving the river room below
// the pair instead of simply cutting the sides off the desktop composition.
export const PORTRAIT_CAMERA = {
  ...CAMERA,
  EXPLORE: {
    position: [8, 9, 28] as [number, number, number],
    lookAt: [-2, -3, 6] as [number, number, number],
    fov: 45,
  },
  FAR: {
    position: [8, 9, 32] as [number, number, number],
    lookAt: [-2, -3, 6] as [number, number, number],
    fov: 50,
  },
  CLOSING: {
    position: [8, 11, 34] as [number, number, number],
    lookAt: [-2, -4, 6] as [number, number, number],
    fov: 48,
  },
} as const;

// Transition durations
export const TRANSITIONS = {
  FADE_IN: 1.5,          // Black → stars fade in
  STAR_REVEAL: 2.0,      // Stars fully materialize
  PULL_BACK: 8.0,        // Camera pull-back duration
  TAIL_FADE_IN: 3.0,     // Tail opacity 0 → 1
  FINAL_TEXT_FADE: 1.5,  // Final title fade in
  EXPLORE_TRANSITION: 0.5,
  CLOSING_CAMERA: 8,     // idle pull-in; matches the lead before the epilogue line
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
