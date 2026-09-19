import { create } from 'zustand';
import type { StarSystemState, StarParameters, Language, CinematicPhase } from '../types';
import type { SkyState } from '../lib/starClock';
import { currentSkyState } from '../lib/starClock';
import { captureMode, registerPauseSource } from '../lib/captureMode';
import type { AutoCameraState } from '../lib/viewerControl';

export const SEEN_OPENING_KEY = 'mira:seen-opening';
export const FOUND_TAIL_KEY = 'mira:found-tail';

interface BinaryStarStore extends StarSystemState {
  parameters: StarParameters;
  sky: SkyState;
  setLanguage: (language: Language) => void;
  setPlaying: (isPlaying: boolean) => void;
  setIntroComplete: (complete: boolean) => void;
  setCinematicPhase: (phase: CinematicPhase) => void;
  setCinematicTime: (time: number) => void;
  setParameter: (key: keyof StarParameters, value: number) => void;
  setSky: (sky: SkyState) => void;
  epilogueVisible: boolean;
  setEpilogueVisible: (visible: boolean) => void;
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

export function hasFoundTail(): boolean {
  try {
    return globalThis.localStorage?.getItem(FOUND_TAIL_KEY) === '1';
  } catch {
    return false;
  }
}

export function persistFoundTail() {
  try {
    globalThis.localStorage?.setItem(FOUND_TAIL_KEY, '1');
  } catch {
    // Private mode / blocked storage: the session still works, it just won't remember.
  }
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
  lastIntentionalInputAt: Date.now(),
  inputSeq: 0,
  cardOpen: false,
  tonightSaveOpen: false,
  autoCamera: 'off',
  returnToExploreAt: 0,
  parameters: defaultParameters,
  sky: initialSky,

  setLanguage: (language) => set({ language }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setIntroComplete: (complete) => {
    if (complete) {
      persistOpeningSeen();
      set({ introComplete: true, cinematicPhase: 'explore' });
      return;
    }
    // Replay: the seen flag stays. Clearing storage is how a first visit is restored.
    set({ introComplete: false, cinematicPhase: 'dark', cinematicTime: 0, epilogueVisible: false, cardOpen: false });
  },
  setCinematicPhase: (phase) => set({ cinematicPhase: phase }),
  setCinematicTime: (time) => set({ cinematicTime: time }),
  setEpilogueVisible: (epilogueVisible) => set({ epilogueVisible }),
  // Intentional input restamps the clock and dismisses the epilogue in the same
  // event, so the interrupt never waits for a poll tick.
  noteIntentionalInput: () =>
    set((state) => ({
      lastIntentionalInputAt: Date.now(),
      epilogueVisible: false,
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
    set({ returnToExploreAt: Date.now(), epilogueVisible: false, lastIntentionalInputAt: Date.now() }),
  setParameter: (key, value) => set((state) => ({
    parameters: { ...state.parameters, [key]: value },
  })),
  setSky: (sky) => set({ sky }),
}));

// The scene clocks pause when the viewer pauses; the predicate lives in one place
// (lib/captureMode) instead of being spelled out at every advanceTime call site.
registerPauseSource(() => !useBinaryStar.getState().isPlaying);
