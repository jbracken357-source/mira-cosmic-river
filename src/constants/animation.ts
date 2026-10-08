// Cinematic sequence timing for Mira Cosmic River
// 15-second opening: dark → stars appear → pull back → tail reveal → explore

export const CINEMATIC = {
  // Phase timing (cumulative seconds from start)
  DARK_START: 0,
  STARS_APPEAR: 2.0,       // Stars materialize
  PULL_BACK_START: 4.0,    // Camera begins pulling back
  PULL_BACK_END: 12.0,     // Pull back completes (8 seconds)
  // #91: the road's rise begins inside the FIRST caption's window, so when the
  // second caption 「彼此牵引，一起走向更远。」 appears at PULL_BACK_START the tail
  // is already past the base glow — 「出现时…已经…不再只是底光」. Not a caption
  // mark: openingSegment never quantizes to this.
  TAIL_FORMING_START: 3.0, // Tail begins gathering mid-first-caption
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
// The same space is composed as a long scroll in portrait (竖屏长卷, #92): the pair
// sits high on the right, the 根 between them, and the road runs down the screen's
// long axis into the lower half — its own composition, never the desktop one with
// the sides cut off. The stored fov names the shared horizontal framing: fittedFov
// (lib/freeViewCamera) widens the on-screen vertical angle to preserve it. EXPLORE
// is the calibrated composition at the reference aspect (390×844); at any other
// portrait aspect lib/portraitFraming re-aims it so the 根 holds its screen point.
export const PORTRAIT_CAMERA = {
  ...CAMERA,
  // Portrait keeps its own hold and waypoint: the pair stays the subject and the
  // river keeps its direction below it, so the tight framing never hangs on empty
  // black.
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
  // The reveal stands on the river's side, high: the pair reads small in the upper
  // frame while the road gathers below it, and the pair's discs stay above the
  // 终幕标题's band (the title lives here, FINAL_TEXT → EXPLORE_MODE).
  FAR: {
    position: [-4.5, 17.5, 27] as [number, number, number],
    lookAt: [-3.2, -17, 8] as [number, number, number],
    fov: 50,
  },
  // 竖屏长卷 home: the pair above the title band and clear of the 顶栏, the road
  // running down the long axis — its strong-alpha body past the midline, its far
  // end two thirds down the frame (the review round on #92 pushed the visible
  // reach deeper: the camera stands closer to the road's far side and higher over
  // it, so the river fills more of the tall frame instead of dissolving at the
  // midline). The fov narrows against the landscape 45 — standing this close is
  // what lets the road fill the tall frame. Distance to the orbit target stays
  // inside the explore zoom limit, so the landing is a place the viewer can keep.
  EXPLORE: {
    position: [-8.6, 22.6, 25] as [number, number, number],
    // The root fix (#91 review) moved 根 a unit sunward along the A→B axis; the
    // aim dips a touch lower so the pair's discs keep their clearance above the
    // 终幕标题 band on the shortest portrait (320×568) — the pin follows the root,
    // the stored composition re-centers the pair by that last margin.
    lookAt: [-5.6, -2.92, 11.4] as [number, number, number],
    fov: 36,
  },
  // The epilogue hold: farther along the same composition, the pair pushed right
  // of the centered line, the road still running down the frame.
  CLOSING: {
    position: [-4, 22, 27] as [number, number, number],
    lookAt: [-6.5, -10, 10] as [number, number, number],
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
  // 终幕那句 (#88): the closing line's settle from the final beat to the lower edge —
  // 不超过半秒, never a two-second fade, and never the controls' all-caps styling.
  // The budget belongs to the 终幕→下缘 transition only; 直达 finds the line already
  // present from the first frame (lib/lowerEdge's closingLineArrival).
  CLOSING_LINE_SETTLE: 0.5,
  // The closing line's own way out — shorter than its settle, so a swap at the
  // lower edge (milestone hint or epilogue) reads as a hand-over, not a fade-out
  // of the line itself.
  CLOSING_LINE_EXIT: 0.25,
  // 结语 (#88): the epilogue line enters in about 0.8s; when the viewer interrupts,
  // it leaves faster than it came.
  EPILOGUE_ENTER: 0.8,
  EPILOGUE_EXIT: 0.3,
  // 顶栏的结语退场与归来 (#90): the top bar lets go of the screen in 0.3–0.5s
  // when the epilogue appears; the slower 1.2s belongs to its return after the
  // interrupt, never to the exit. The exit window is pinned by
  // tests/unit/animationTiming.spec.ts.
  TOP_BAR_EPILOGUE_EXIT: 0.4,
  TOP_BAR_EPILOGUE_RETURN: 1.2,
  // The milestone hint's own enter/exit fade while it borrows the lower edge.
  MILESTONE_HINT_FADE: 0.4,
  // Opening captions (the cinematic's three lines) leave faster than they arrive,
  // so one line never sits half-faded under the next.
  CAPTION_EXIT: 0.25,
  // The interaction hint's farewell once the viewer has learned the gesture.
  INTERACTION_HINT_EXIT: 0.3,
} as const;

// 下缘 (#88): how long the milestone hint (本周期最亮/最暗) holds the lower edge once
// per cycle before the closing line returns — 约 8 秒. Milliseconds: it drives a
// timer, not a motion duration, so it lives beside TRANSITIONS rather than in it.
export const MILESTONE_HINT_MS = 8000;

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
