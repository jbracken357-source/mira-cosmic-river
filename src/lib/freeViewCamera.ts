// Free viewing (自由观看): the camera choreography after the opening lands — who
// holds the camera each frame, as one pure step function.
//
// The frame loop feeds the live camera pose and the store's trigger fields; the
// module answers with the pose to apply (null = the viewer's OrbitControls own the
// camera), whether the controls stay enabled, and whether an armed flight is
// holding the idle clock. Everything time-based that used to live in Scene refs —
// the return-to-main-view flight with its input-sequence interrupt, the closing
// flight that leads the epilogue line, the capture pin, the explore landing, the
// aspect and portrait refits — is decided here, so it is testable without a canvas.
//
// Mirrors lib/openingTimeline (the full cinematic as a pure function of time):
// plain tuples, no three.js. Reduced motion is the caller's flag as everywhere
// else: flights place instantly instead of blending, and the epilogue line can
// still arrive without any camera motion (epilogueCamera is already false then).
import { CAMERA, PORTRAIT_CAMERA, TRANSITIONS } from '../constants/animation';
import { easeInOutCubic } from './openingTimeline';

type Vec3 = [number, number, number];

// A pose the caller can apply as-is: the fov is already fitted for the frame's
// aspect, so the adapter never re-fits.
export interface FlightPose {
  position: Vec3;
  lookAt: Vec3;
  fov: number;
}

interface FlightOrigin {
  pos: Vec3;
  look: Vec3;
  fov: number;
}

// The stored fov names the shared horizontal framing; the on-screen vertical angle
// widens on portrait aspects to preserve it. Moved from Scene.tsx — the opening
// application and the live-camera aspect refit import it from here now.
export function fittedFov(fov: number, aspect: number, fromAspect = 1): number {
  const scale = Math.min(1, fromAspect) / Math.min(1, aspect);
  return (180 / Math.PI) * 2 * Math.atan(Math.tan(((fov * Math.PI) / 180) / 2) * scale);
}

export interface FreeViewState {
  exploreApplied: boolean;
  closingArmed: boolean;
  closingBlend: number;
  closingFrom: FlightOrigin;
  // A flight is cancelled by fresh intentional input, detected by the input
  // sequence: the flight restamps the idle clock every frame, so timestamps alone
  // cannot tell "the viewer acted" apart from "the flight held the clock".
  returnArmed: boolean;
  returnBlend: number;
  returnArmedSeq: number;
  returnHandledAt: number;
  returnFrom: FlightOrigin;
  lastAspect: number;
  lastPortrait: boolean;
}

export function initialFreeViewState(): FreeViewState {
  const zero: FlightOrigin = { pos: [0, 0, 0], look: [0, 0, 0], fov: 0 };
  return {
    exploreApplied: false,
    closingArmed: false,
    closingBlend: 0,
    closingFrom: { pos: [0, 0, 0], look: [0, 0, 0], fov: 0 },
    returnArmed: false,
    returnBlend: 0,
    returnArmedSeq: 0,
    returnHandledAt: 0,
    returnFrom: { pos: [...zero.pos], look: [...zero.look], fov: 0 },
    lastAspect: 1,
    lastPortrait: false,
  };
}

// Drag start needs a synchronous cancel: OrbitControls updates before the frame
// loop runs, so the flight must not fight the viewer's first pointer move for a
// frame while the input-sequence check waits for its turn.
export function cancelReturnFlight(state: FreeViewState): FreeViewState {
  return { ...state, returnArmed: false };
}

export interface FreeViewFrame {
  delta: number;
  aspect: number;
  portrait: boolean;
  introComplete: boolean;
  // True when the opening ran to its natural end: the camera has already settled
  // on the explore framing, so the landing only joins the orbit target to it.
  openingFinished: boolean;
  returnToExploreAt: number;
  inputSeq: number;
  epilogueCamera: boolean;
  reduceMotion: boolean;
  // The capture pin's resolved pose, or null when capture mode is not parking the
  // camera this frame. It overrides every other verdict.
  capturePose: FlightPose | null;
  // The return-settle window is active (a fresh return to the main view, before
  // the first intentional input): the main view is pinned every frame.
  returnSettleActive: boolean;
  // The live camera, for capturing flight origins at arm time.
  camera: {
    position: Vec3;
    target: Vec3;
    fov: number;
  };
}

export interface FreeViewStep {
  state: FreeViewState;
  pose: FlightPose | null;
  controlsEnabled: boolean;
  // An armed flight holds the idle clock (its restamps must not look like input);
  // read from the pre-step state, the way the frame loop used to read the ref.
  holdsClock: boolean;
  landedExplore: boolean;
  // The armed return flight completed this frame (an interrupt is not a landing):
  // a deliberate repositioning settled, so the caller restarts the idle count.
  landedReturn: boolean;
}

export function stepFreeViewCamera(state: FreeViewState, frame: FreeViewFrame): FreeViewStep {
  const holdsClock = state.returnArmed;
  const s: FreeViewState = {
    ...state,
    closingFrom: { ...state.closingFrom },
    returnFrom: { ...state.returnFrom },
  };

  if (frame.portrait !== s.lastPortrait) {
    s.exploreApplied = false;
    s.closingArmed = false;
    s.returnArmed = false;
    s.lastPortrait = frame.portrait;
  }
  // Stored origin fovs follow aspect changes so a blend in flight stays continuous;
  // the live camera's own refit is the adapter's business.
  if (frame.aspect !== s.lastAspect) {
    if (s.closingArmed) {
      s.closingFrom.fov = fittedFov(s.closingFrom.fov, frame.aspect, s.lastAspect);
    }
    s.lastAspect = frame.aspect;
  }

  const cam = frame.portrait ? PORTRAIT_CAMERA : CAMERA;
  const target = (name: 'EXPLORE' | 'CLOSING') => cam[name];
  const place = (name: 'EXPLORE' | 'CLOSING'): FlightPose => ({
    position: [...target(name).position] as Vec3,
    lookAt: [...target(name).lookAt] as Vec3,
    fov: fittedFov(target(name).fov, frame.aspect),
  });
  const blend = (from: FlightOrigin, name: 'EXPLORE' | 'CLOSING', k: number): FlightPose => {
    const to = target(name);
    const toFov = fittedFov(to.fov, frame.aspect);
    return {
      position: [
        from.pos[0] + (to.position[0] - from.pos[0]) * k,
        from.pos[1] + (to.position[1] - from.pos[1]) * k,
        from.pos[2] + (to.position[2] - from.pos[2]) * k,
      ],
      lookAt: [
        from.look[0] + (to.lookAt[0] - from.look[0]) * k,
        from.look[1] + (to.lookAt[1] - from.look[1]) * k,
        from.look[2] + (to.lookAt[2] - from.look[2]) * k,
      ],
      fov: from.fov + (toFov - from.fov) * k,
    };
  };

  // The opening (and the entry gate that precedes it) owns the camera; the module
  // only keeps its state parked for the landing.
  if (!frame.introComplete) {
    s.exploreApplied = false;
    s.closingArmed = false;
    s.returnArmed = false;
    return { state: s, pose: null, controlsEnabled: false, holdsClock, landedExplore: false, landedReturn: false };
  }

  let pose: FlightPose | null = null;
  let controlsEnabled = true;
  let landedExplore = false;
  let landedReturn = false;

  // The landing: return visits and an early skip take the explore framing; a
  // finished opening keeps its sequence-end camera and only the orbit target
  // joins (the far and explore framings share the look-at, so this cannot jump).
  if (!s.exploreApplied) {
    landedExplore = true;
    pose = frame.openingFinished
      ? { position: [...frame.camera.position], lookAt: [...target('EXPLORE').lookAt] as Vec3, fov: frame.camera.fov }
      : place('EXPLORE');
    s.exploreApplied = true;
  }

  // Return to the main view: a deliberate action, eased back to the explore
  // framing. Reduced motion places the camera instantly — never a forced flight.
  if (frame.returnToExploreAt > s.returnHandledAt) {
    s.returnHandledAt = frame.returnToExploreAt;
    if (frame.reduceMotion) {
      pose = place('EXPLORE');
    } else {
      s.returnFrom = { pos: [...frame.camera.position], look: [...frame.camera.target], fov: frame.camera.fov };
      s.returnBlend = 0;
      s.returnArmedSeq = frame.inputSeq;
      s.returnArmed = true;
    }
  }
  if (s.returnArmed) {
    // The epilogue or a fresh intentional input takes the camera back at once.
    if (frame.epilogueCamera || frame.inputSeq !== s.returnArmedSeq) {
      s.returnArmed = false;
    } else {
      s.returnBlend = Math.min(1, s.returnBlend + frame.delta / TRANSITIONS.RETURN_CAMERA);
      pose = blend(s.returnFrom, 'EXPLORE', easeInOutCubic(s.returnBlend));
      if (s.returnBlend >= 1) {
        s.returnArmed = false;
        landedReturn = true;
      }
    }
  }

  // The closing flight leads the epilogue line by TRANSITIONS.CLOSING_CAMERA.
  if (frame.epilogueCamera) {
    if (!s.closingArmed) {
      s.closingFrom = { pos: [...frame.camera.position], look: [...frame.camera.target], fov: frame.camera.fov };
      s.closingBlend = 0;
      s.closingArmed = true;
    }
    controlsEnabled = false;
    s.closingBlend = Math.min(1, s.closingBlend + frame.delta / TRANSITIONS.CLOSING_CAMERA);
    pose = blend(s.closingFrom, 'CLOSING', easeInOutCubic(s.closingBlend));
  } else if (s.closingArmed) {
    s.closingArmed = false;
    s.closingBlend = 0;
  }

  // The settle window pins the main view: whatever residual perturbs the camera —
  // including a damped drag inertia persisting at low frame rates — it is re-placed
  // every frame, the same parking discipline capture mode uses. The first
  // intentional input (the sequence captured at arm time changing) releases the
  // pin, so the viewer keeps the camera at any moment.
  if (
    frame.returnSettleActive &&
    frame.introComplete &&
    frame.capturePose === null &&
    s.returnArmedSeq === frame.inputSeq
  ) {
    pose = place('EXPLORE');
  }

  // Capture mode parks the camera at the requested pose every frame — after the
  // explore hand-off and after OrbitControls' own update — so nothing can drift
  // between runs.
  if (frame.capturePose !== null) {
    pose = {
      position: [...frame.capturePose.position],
      lookAt: [...frame.capturePose.lookAt],
      fov: fittedFov(frame.capturePose.fov, frame.aspect),
    };
    controlsEnabled = false;
  }

  return { state: s, pose, controlsEnabled, holdsClock, landedExplore, landedReturn };
}
