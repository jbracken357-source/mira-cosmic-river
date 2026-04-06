// Animation timing constants
// Slow, elegant transitions with spring physics

export const ANIMATION = {
  // Duration constants
  DURATIONS: {
    FAST: 150,      // Quick micro-interactions
    NORMAL: 300,    // Standard transitions
    SLOW: 500,      // Elegant reveals
    CINEMATIC: 800, // Dramatic moments
    INTRO_TOTAL: 2500, // Full intro sequence
  },

  // Stagger delays for intro sequence
  INTRO_STAGGER: {
    SCENE_FADE: 0,         // Scene starts immediately
    STARS_REVEAL: 300,     // Stars emerge after fade
    ORBIT_REVEAL: 600,     // Orbit ring appears
    STREAM_REVEAL: 900,    // Material stream
    UI_PANEL: 1200,        // Control panel slides in
    TITLE: 1500,           // Title fades in
    SUBTITLE: 1800,        // Subtitle follows
    MODE_BUTTONS: 2100,    // Mode buttons stagger
    COMPLETE: 2500,        // All done
  },

  // Spring physics for Framer Motion
  SPRING: {
    gentle: {
      type: 'spring',
      stiffness: 100,
      damping: 15,
    },
    bounce: {
      type: 'spring',
      stiffness: 200,
      damping: 10,
    },
    smooth: {
      type: 'spring',
      stiffness: 50,
      damping: 20,
    },
  },

  // Easing functions
  EASE: {
    OUT: [0.16, 1, 0.3, 1],     // Smooth deceleration
    IN_OUT: [0.65, 0, 0.35, 1], // Smooth in and out
    OUT_BACK: [0.34, 1.56, 0.64, 1], // Slight overshoot
  },

  // Pulsation timing for stars
  STAR_PULSE: {
    MIRA_A: {
      period: 1.5,   // Slower, grander pulse
      amplitude: 0.1,
    },
    MIRA_B: {
      period: 0.8,   // Faster, tighter pulse
      amplitude: 0.05,
    },
  },

  // Camera animation
  CAMERA: {
    INITIAL_DISTANCE: 15,
    INITIAL_ANGLE: 0.5, // Viewing angle
    ZOOM_SPEED: 0.5,
    ROTATION_SPEED: 0.002,
  },
} as const;