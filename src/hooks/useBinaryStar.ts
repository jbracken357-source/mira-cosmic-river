import { create } from 'zustand';
import type { StarSystemState, Language, CinematicPhase } from '../types';
import type { SkyState } from '../lib/starClock';
import { currentSkyState } from '../lib/starClock';
import { captureMode, registerPauseSource } from '../lib/captureMode';
import { closingLineArrival as resolveClosingLineArrival } from '../lib/lowerEdge';
import type { ClosingLineArrival } from '../lib/lowerEdge';
import type { AutoCameraState } from '../lib/viewerControl';
import { rememberFlag, rememberedFlag } from '../lib/rememberedFlag';

export const SEEN_OPENING_KEY = 'mira:seen-opening';

interface BinaryStarStore extends StarSystemState {
  sky: SkyState;
  setLanguage: (language: Language) => void;
  setPlaying: (isPlaying: boolean) => void;
  setIntroComplete: (complete: boolean) => void;
  setCinematicPhase: (phase: CinematicPhase) => void;
  setCinematicTime: (time: number) => void;
  setSky: (sky: SkyState) => void;
  epilogueVisible: boolean;
  setEpilogueVisible: (visible: boolean) => void;
  // The epilogue line's own visibility, published beside epilogueVisible (camera or
  // text): under reduced motion the line arrives without the closing flight.
  epilogueText: boolean;
  setEpilogueText: (visible: boolean) => void;
  // 终幕那句的抵达 (#88): 'present' when the session has not shown the final beat
  // (直达 — the closing line is at the lower edge from the first frame), 'settle'
  // for a landing that passed the final beat (the ≤0.5s 终幕→下缘 transition).
  closingLineArrival: ClosingLineArrival;
  // Shared idle clock: the timestamp of the last intentional input. Drag, wheel,
  // touch, keys and control presses restamp it; mousemove and the auto camera do not.
  // inputSeq counts intentional inputs only (never the silent restamps), so a camera
  // flight can tell "the viewer interrupted" apart from "the clock moved".
  lastIntentionalInputAt: number;
  inputSeq: number;
  noteIntentionalInput: () => void;
  restampIdleClock: () => void;
  cardOpen: boolean;
  setCardOpen: (open: boolean) => void;
  // 今晚的 Mira (#23): the save flow holds the idle takeover while open, the same
  // way reading a card does — the auto camera must never reframe a locked snapshot.
  tonightSaveOpen: boolean;
  setTonightSaveOpen: (open: boolean) => void;
  autoCamera: AutoCameraState;
  setAutoCamera: (state: AutoCameraState) => void;
  returnToExploreAt: number;
  requestReturnToExplore: () => void;
  // 顶栏 (#90): the first drag or zoom of the visit graduates the quiet bar (暂停
  // and 今晚的 Mira appear). Per visit — every landing starts quiet again; the
  // remembered graduation belongs to the gesture hint alone (学会后不留「?」).
  exploreManipulated: boolean;
  noteExploreManipulation: () => void;
  // 镜头离开主视角 (#90): the frame loop publishes whether the camera sits off the
  // explore framing, write-on-change (the same discipline as setAutoCamera).
  awayFromMainView: boolean;
  setAwayFromMainView: (away: boolean) => void;
}

function hasSeenOpening(): boolean {
  return rememberedFlag(SEEN_OPENING_KEY);
}

function persistOpeningSeen() {
  rememberFlag(SEEN_OPENING_KEY);
}

// The clock is read at load and only carried forward from there, so nothing has to read it
// during a render.
const initialSky = currentSkyState();
// Capture mode enters via direct entry: a baseline always starts in the explore state,
// without persisting the seen-opening flag — except `?cinematic-t=`, which pins the
// full cinematic at one instant instead (opening phase captures, #28).
const capture = captureMode();
const startInExplore = (capture.active && capture.cinematicT === null) || hasSeenOpening();

export const useBinaryStar = create<BinaryStarStore>((set, get) => ({
  language: 'ch',
  isPlaying: true,
  introComplete: startInExplore,
  cinematicPhase: startInExplore ? 'explore' : 'dark',
  cinematicTime: 0,
  epilogueVisible: false,
  epilogueText: false,
  // 直达 starts here: no final beat ever shown, so the closing line is present from
  // the first frame. Each landing recomputes it from the opening's quantized mark.
  closingLineArrival: 'present',
  lastIntentionalInputAt: Date.now(),
  inputSeq: 0,
  cardOpen: false,
  tonightSaveOpen: false,
  autoCamera: 'off',
  returnToExploreAt: 0,
  exploreManipulated: false,
  awayFromMainView: false,
  sky: initialSky,

  setLanguage: (language) => set({ language }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setIntroComplete: (complete) => {
    if (complete) {
      persistOpeningSeen();
      // The arrival is decided at the landing: the published mark has landed on
      // FINAL_TEXT exactly when the final beat was shown (终幕→下缘 settle);
      // anything earlier cut the opening short, and the line is simply present.
      set({ introComplete: true, cinematicPhase: 'explore', closingLineArrival: resolveClosingLineArrival(get().cinematicTime) });
      return;
    }
    // Replay: the seen flag stays. Clearing storage is how a first visit is restored.
    // The quiet bar resets with the ritual (#90): the next landing is a fresh first
    // look — 暂停 and 今晚的 Mira wait for the visit's first drag or zoom again.
    set({ introComplete: false, cinematicPhase: 'dark', cinematicTime: 0, epilogueVisible: false, epilogueText: false, cardOpen: false, exploreManipulated: false, awayFromMainView: false });
  },
  setCinematicPhase: (phase) => set({ cinematicPhase: phase }),
  setCinematicTime: (time) => set({ cinematicTime: time }),
  // Written every frame by the scene's verdict application, so both setters are
  // write-on-change (same as setAutoCamera): the per-frame writes stay free.
  setEpilogueVisible: (epilogueVisible) => {
    if (get().epilogueVisible !== epilogueVisible) set({ epilogueVisible });
  },
  setEpilogueText: (epilogueText) => {
    if (get().epilogueText !== epilogueText) set({ epilogueText });
  },
  // Intentional input restamps the clock and dismisses the epilogue in the same
  // event, so the interrupt never waits for a poll tick.
  noteIntentionalInput: () =>
    set((state) => ({
      lastIntentionalInputAt: Date.now(),
      epilogueVisible: false,
      epilogueText: false,
      inputSeq: state.inputSeq + 1,
    })),
  // Hold bookkeeping: the clock restarts from zero when the hold ends, without
  // dismissing anything.
  restampIdleClock: () => set({ lastIntentionalInputAt: Date.now() }),
  setCardOpen: (cardOpen) => set({ cardOpen }),
  setTonightSaveOpen: (tonightSaveOpen) => set({ tonightSaveOpen }),
  setAutoCamera: (autoCamera) => {
    if (get().autoCamera !== autoCamera) set({ autoCamera });
  },
  requestReturnToExplore: () =>
    set({ returnToExploreAt: Date.now(), epilogueVisible: false, epilogueText: false, lastIntentionalInputAt: Date.now() }),
  // Idempotent graduation: only the first manipulation of the visit is a write.
  noteExploreManipulation: () => {
    if (!get().exploreManipulated) set({ exploreManipulated: true });
  },
  setAwayFromMainView: (awayFromMainView) => {
    if (get().awayFromMainView !== awayFromMainView) set({ awayFromMainView });
  },
  setSky: (sky) => set({ sky }),
}));

// The scene clocks pause when the viewer pauses; the predicate lives in one place
// (lib/captureMode) instead of being spelled out at every advanceTime call site.
registerPauseSource(() => !useBinaryStar.getState().isPlaying);
