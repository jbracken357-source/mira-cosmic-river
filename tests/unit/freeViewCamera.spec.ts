import { test, expect } from '@playwright/test';
import { CAMERA, PORTRAIT_CAMERA, TRANSITIONS } from '../../src/constants/animation';
import {
  cancelReturnFlight,
  fittedFov,
  initialFreeViewState,
  stepFreeViewCamera,
} from '../../src/lib/freeViewCamera';
import type { FreeViewFrame, FreeViewState } from '../../src/lib/freeViewCamera';

// Free viewing (自由观看): the camera choreography after the opening lands, as a
// pure step function — the landing, the return flight with its input-sequence
// interrupt, the closing flight that leads the epilogue line, and the capture pin.

const LAND = 16 / 9;
const PORT = 9 / 16;
const DRAGGED = { position: [20, 18, 12] as [number, number, number], target: [4, 2, 1] as [number, number, number], fov: 40 };

function dist(a: readonly number[], b: readonly number[]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function frame(over: Partial<FreeViewFrame> = {}): FreeViewFrame {
  return {
    delta: 1 / 60,
    aspect: LAND,
    portrait: false,
    introComplete: true,
    openingFinished: false,
    returnToExploreAt: 0,
    returnSettleActive: false,
    inputSeq: 0,
    epilogueCamera: false,
    reduceMotion: false,
    capturePose: null,
    camera: {
      position: [...CAMERA.EXPLORE.position] as [number, number, number],
      target: [...CAMERA.EXPLORE.lookAt] as [number, number, number],
      fov: CAMERA.EXPLORE.fov,
    },
    ...over,
  };
}

// Step the machine `frames` times, feeding each applied pose back as the live
// camera the way the frame loop would.
function run(f: FreeViewFrame, frames: number, state: FreeViewState = initialFreeViewState()) {
  let current = state;
  let step = stepFreeViewCamera(current, f);
  for (let i = 1; i < frames; i++) {
    current = step.state;
    const live = step.pose
      ? { position: step.pose.position, target: step.pose.lookAt, fov: step.pose.fov }
      : f.camera;
    step = stepFreeViewCamera(current, { ...f, camera: live });
  }
  return step;
}

test.describe('the landing (explore hand-off)', () => {
  test('a return visit lands exactly on the explore framing, once', () => {
    const first = stepFreeViewCamera(initialFreeViewState(), frame());
    expect(first.landedExplore).toBe(true);
    expect(first.pose!.position).toEqual([...CAMERA.EXPLORE.position]);
    expect(first.pose!.lookAt).toEqual([...CAMERA.EXPLORE.lookAt]);
    expect(first.pose!.fov).toBeCloseTo(CAMERA.EXPLORE.fov, 9);
    expect(first.controlsEnabled).toBe(true);

    const second = stepFreeViewCamera(first.state, frame());
    expect(second.landedExplore).toBe(false);
    expect(second.pose).toBeNull();
  });

  test('a finished opening keeps its camera and only joins the orbit target', () => {
    const f = frame({ openingFinished: true, camera: { position: [1, 2, 3], target: [0, 0, 0], fov: 47 } });
    const step = stepFreeViewCamera(initialFreeViewState(), f);
    expect(step.landedExplore).toBe(true);
    expect(step.pose!.position).toEqual([1, 2, 3]);
    expect(step.pose!.fov).toBe(47);
    expect(step.pose!.lookAt).toEqual([...CAMERA.EXPLORE.lookAt]);
  });

  test('portrait lands on the portrait composition with a widened fov', () => {
    const step = stepFreeViewCamera(initialFreeViewState(), frame({ portrait: true, aspect: PORT }));
    expect(step.pose!.position).toEqual([...PORTRAIT_CAMERA.EXPLORE.position]);
    expect(step.pose!.lookAt).toEqual([...PORTRAIT_CAMERA.EXPLORE.lookAt]);
    expect(step.pose!.fov).toBeGreaterThan(PORTRAIT_CAMERA.EXPLORE.fov);
  });
});

test.describe('return to the main view', () => {
  test('eases from the dragged pose and lands exactly on the explore framing', () => {
    const f = frame({ returnToExploreAt: 1000, camera: DRAGGED });
    const armed = stepFreeViewCamera(initialFreeViewState(), f);
    expect(armed.state.returnArmed).toBe(true);
    // The first blended pose sits on the captured origin.
    expect(dist(armed.pose!.position, DRAGGED.position)).toBeLessThan(0.2);

    // TRANSITIONS.RETURN_CAMERA of frames at 1/60 each, plus one: the blend
    // accumulation is float, so the final frame is what clamps k to exactly 1.
    const landed = run(f, Math.round(TRANSITIONS.RETURN_CAMERA * 60) + 1);
    expect(landed.pose!.position).toEqual([...CAMERA.EXPLORE.position]);
    expect(landed.pose!.lookAt).toEqual([...CAMERA.EXPLORE.lookAt]);
    expect(landed.pose!.fov).toBeCloseTo(CAMERA.EXPLORE.fov, 9);
    expect(landed.state.returnArmed).toBe(false);

    const settled = stepFreeViewCamera(landed.state, f);
    expect(settled.pose).toBeNull();
  });

  test('an armed flight holds the idle clock, and only while armed', () => {
    const f = frame({ returnToExploreAt: 1000, camera: DRAGGED });
    const armed = stepFreeViewCamera(initialFreeViewState(), f);
    expect(stepFreeViewCamera(armed.state, f).holdsClock).toBe(true);
    const landed = run(f, Math.round(TRANSITIONS.RETURN_CAMERA * 60) + 1, armed.state);
    expect(stepFreeViewCamera(landed.state, f).holdsClock).toBe(false);
  });

  test('fresh intentional input cancels the flight at once (sequence, not timestamps)', () => {
    const f = frame({ returnToExploreAt: 1000, camera: DRAGGED });
    const armed = stepFreeViewCamera(initialFreeViewState(), f);
    const interrupted = stepFreeViewCamera(armed.state, { ...f, inputSeq: 1 });
    expect(interrupted.state.returnArmed).toBe(false);
    expect(interrupted.pose).toBeNull();
  });

  test('the drag-start cancel disarms synchronously without mutating its input', () => {
    const f = frame({ returnToExploreAt: 1000, camera: DRAGGED });
    const armed = stepFreeViewCamera(initialFreeViewState(), f);
    expect(cancelReturnFlight(armed.state).returnArmed).toBe(false);
    expect(armed.state.returnArmed).toBe(true);
  });

  test('a completed return settles the idle count; an interrupt does not', () => {
    const f = frame({ returnToExploreAt: 1000, camera: DRAGGED });
    const armed = stepFreeViewCamera(initialFreeViewState(), f);
    expect(armed.landedReturn).toBe(false);
    // Step until the flight completes; landedReturn pulses on that frame only.
    let step = armed;
    for (let i = 0; i < 200 && !step.landedReturn; i++) {
      const live = step.pose
        ? { position: step.pose.position, target: step.pose.lookAt, fov: step.pose.fov }
        : f.camera;
      step = stepFreeViewCamera(step.state, { ...f, camera: live });
    }
    expect(step.landedReturn).toBe(true);
    expect(step.state.returnArmed).toBe(false);
    const settled = stepFreeViewCamera(step.state, f);
    expect(settled.landedReturn).toBe(false);
    const interrupted = stepFreeViewCamera(armed.state, { ...f, inputSeq: 1 });
    expect(interrupted.landedReturn).toBe(false);
  });

  test('the settle window pins the main view until the first input', () => {
    const f = frame({ returnToExploreAt: 1000, returnSettleActive: true, camera: DRAGGED });
    const first = stepFreeViewCamera(initialFreeViewState(), f);
    // The pin overrides even the just-armed flight: the pose is the explore framing.
    expect(first.pose!.position).toEqual([...CAMERA.EXPLORE.position]);
    expect(first.pose!.lookAt).toEqual([...CAMERA.EXPLORE.lookAt]);

    // A perturbation (e.g. damped drag inertia) is re-placed the next frame.
    const disturbed = stepFreeViewCamera(first.state, {
      ...f,
      camera: { position: [3, 9, 26], target: [0, 0, 0], fov: 46 },
    });
    expect(disturbed.pose!.position).toEqual([...CAMERA.EXPLORE.position]);

    // The first intentional input releases the pin.
    const touched = stepFreeViewCamera(first.state, { ...f, inputSeq: 1 });
    expect(touched.pose).toBeNull();

    // Once the window expires the flights own the camera again.
    const expired = stepFreeViewCamera(first.state, { ...f, returnSettleActive: false });
    expect(expired.pose).not.toBeNull();
  });

  test('reduced motion places the camera instantly instead of flying', () => {
    const f = frame({ returnToExploreAt: 1000, reduceMotion: true, camera: DRAGGED });
    const step = stepFreeViewCamera(initialFreeViewState(), f);
    expect(step.pose!.position).toEqual([...CAMERA.EXPLORE.position]);
    expect(step.state.returnArmed).toBe(false);
    expect(step.holdsClock).toBe(false);
  });
});

test.describe('the closing flight (epilogue)', () => {
  test('leads from the explore framing to the closing framing over its duration', () => {
    const f = frame({ epilogueCamera: true });
    const first = stepFreeViewCamera(initialFreeViewState(), f);
    expect(first.controlsEnabled).toBe(false);
    expect(first.state.closingArmed).toBe(true);
    expect(dist(first.pose!.position, CAMERA.EXPLORE.position)).toBeLessThan(0.2);

    const done = run(f, Math.round(TRANSITIONS.CLOSING_CAMERA * 60) + 1);
    expect(done.pose!.position).toEqual([...CAMERA.CLOSING.position]);
    expect(done.pose!.lookAt).toEqual([...CAMERA.CLOSING.lookAt]);
    expect(done.pose!.fov).toBeCloseTo(CAMERA.CLOSING.fov, 9);
  });

  test('the epilogue cancels an armed return flight and takes the camera', () => {
    const f = frame({ returnToExploreAt: 1000, camera: DRAGGED });
    const armed = stepFreeViewCamera(initialFreeViewState(), f);
    const taken = stepFreeViewCamera(armed.state, { ...f, returnToExploreAt: 0, epilogueCamera: true });
    expect(taken.state.returnArmed).toBe(false);
    expect(taken.state.closingArmed).toBe(true);
    expect(taken.controlsEnabled).toBe(false);
  });

  test('the epilogue line alone (reduced motion) never moves the camera', () => {
    // epilogueCamera is the caller's reduced-motion-aware flag: false here, so the
    // line may arrive while the camera never leaves the viewer's framing.
    const f = frame({ reduceMotion: true, camera: { position: [3, 4, 5], target: [0, 0, 0], fov: 44 } });
    const landed = stepFreeViewCamera(initialFreeViewState(), f);
    const idle = stepFreeViewCamera(landed.state, f);
    expect(idle.pose).toBeNull();
    expect(idle.controlsEnabled).toBe(true);
  });

  test('dropping the flag hands the camera back', () => {
    const f = frame({ epilogueCamera: true });
    const armed = stepFreeViewCamera(initialFreeViewState(), f);
    const released = stepFreeViewCamera(armed.state, frame());
    expect(released.state.closingArmed).toBe(false);
    expect(released.controlsEnabled).toBe(true);
    expect(released.pose).toBeNull();
  });
});

test.describe('the capture pin', () => {
  test('parks the camera every frame, overriding flights and the controls', () => {
    const pin = { position: [2, 3, 10] as [number, number, number], lookAt: [0, 0, 0] as [number, number, number], fov: 45 };
    const step = stepFreeViewCamera(initialFreeViewState(), frame({ epilogueCamera: true, capturePose: pin }));
    expect(step.pose!.position).toEqual(pin.position);
    expect(step.pose!.lookAt).toEqual(pin.lookAt);
    expect(step.pose!.fov).toBeCloseTo(fittedFov(45, LAND), 9);
    expect(step.controlsEnabled).toBe(false);
  });
});

test.describe('orientation changes', () => {
  test('a portrait flip cancels armed flights and re-lands on the portrait framing', () => {
    const f = frame({ returnToExploreAt: 1000, camera: DRAGGED });
    const armed = stepFreeViewCamera(initialFreeViewState(), f);
    const flipped = stepFreeViewCamera(armed.state, { ...f, returnToExploreAt: 0, portrait: true, aspect: PORT });
    expect(flipped.state.returnArmed).toBe(false);
    expect(flipped.landedExplore).toBe(true);
    expect(flipped.pose!.position).toEqual([...PORTRAIT_CAMERA.EXPLORE.position]);
  });

  test('an aspect change refits a stored closing origin so the blend stays continuous', () => {
    const f = frame({ epilogueCamera: true });
    const armed = stepFreeViewCamera(initialFreeViewState(), f);
    expect(armed.state.closingFrom.fov).toBe(CAMERA.EXPLORE.fov);
    const rotated = stepFreeViewCamera(armed.state, { ...f, aspect: PORT });
    expect(rotated.state.closingFrom.fov).toBeCloseTo(fittedFov(CAMERA.EXPLORE.fov, PORT, LAND), 9);
    expect(Number.isFinite(rotated.pose!.fov)).toBe(true);
  });
});

test.describe('the opening still owns the camera', () => {
  test('no pose, no controls, and the flight state parks for the landing', () => {
    const f = frame({ returnToExploreAt: 1000, camera: DRAGGED });
    const armed = stepFreeViewCamera(initialFreeViewState(), f);
    const replay = stepFreeViewCamera(armed.state, { ...f, returnToExploreAt: 0, introComplete: false });
    expect(replay.pose).toBeNull();
    expect(replay.controlsEnabled).toBe(false);
    expect(replay.state.returnArmed).toBe(false);
    expect(replay.state.exploreApplied).toBe(false);
  });
});

test.describe('fittedFov (the shared horizontal framing)', () => {
  test('landscape keeps the stored fov; portrait widens it; fromAspect undoes it', () => {
    expect(fittedFov(45, LAND)).toBeCloseTo(45, 9);
    expect(fittedFov(45, PORT)).toBeGreaterThan(50);
    expect(fittedFov(fittedFov(45, PORT), LAND, PORT)).toBeCloseTo(45, 9);
  });
});
