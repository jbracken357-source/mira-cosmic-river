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
  // Phase 2: mid-path waypoint of the pull-back. The path bows through it toward the
  // river (-X side, where the tail streams), so the near edge of the river passes the
  // lens instead of the camera retreating in a straight line (前景经过).
  MID: {
    position: [5, 4.5, 18] as [number, number, number],
    lookAt: [-1, 0, 2] as [number, number, number],
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
  // Idle hold, not explore framing. The look-at biases left so the pair drifts
  // right of the centered epilogue line instead of sitting under it.
  CLOSING: {
    position: [8, 10, 34] as [number, number, number],
    lookAt: [-8, 1, 6] as [number, number, number],
    fov: 48,
  },
  // The pull-back's fov range is CLOSE.fov → FAR.fov; the opening timeline reads it
  // from those poses so the portrait table can diverge without a second source.
} as const;
// The same space is composed diagonally in portrait, giving the river room below
// the pair instead of simply cutting the sides off the desktop composition. The fov
// values intentionally match the landscape ones: fittedFov (Scene.tsx) already
// widens the vertical field to preserve the horizontal composition, so the stored
// fov names the shared horizontal framing, not the on-screen vertical angle.
export const PORTRAIT_CAMERA = {
  ...CAMERA,
  // Portrait keeps its own hold and waypoint: the pair sits in the upper part of the
  // frame (the look-at drops below it) with the river's direction kept below, so the
  // tight framing never hangs on empty black.
  CLOSE: {
    position: [8, 4, 13] as [number, number, number],
    lookAt: [0, -2, 0] as [number, number, number],
    fov: 35,
  },
  MID: {
    position: [5, 5.5, 19] as [number, number, number],
    lookAt: [-1, -2, 3] as [number, number, number],
    fov: 45,
  },
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
    lookAt: [-7, -5, 6] as [number, number, number],
    fov: 48,
  },
} as const;

// Transition durations
export const TRANSITIONS = {
  FADE_IN: 1.5,          // Black → stars fade in
  FINAL_TEXT_FADE: 1.5,  // Final title fade in
  EXPLORE_TRANSITION: 0.5,
  CLOSING_CAMERA: 8,     // idle pull-in; matches the lead before the epilogue line
  RETURN_CAMERA: 1.5,    // deliberate return to the main view; reduced motion places instantly
} as const;

// Info card (#20): snappy enough that the card reads as an answer to the tap, not a
// scene change. Enter 180–240ms, exit 120–180ms; the windows are pinned by
// tests/unit/animationTiming.spec.ts. Under reduced motion the card only fades.
export const INFO_CARD = {
  ENTER: 0.21,
  EXIT: 0.15,
} as const;

// Easing functions
export const EASE = {
  OUT: [0.16, 1, 0.3, 1],
  IN_OUT: [0.65, 0, 0.35, 1],
} as const;
