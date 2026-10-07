import { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls as DreiOrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useReducedMotion } from 'framer-motion';
import { useBinaryStar, ambientSpace, tonightFrame, useEntryReadiness } from '../../hooks';
import { COLORS, PHYSICS, calculateOrbitalPosition, CINEMATIC, CAMERA as LANDSCAPE_CAMERA, TRANSLATIONS, resolveQualityTier, ENTRY_STILL, ENTRY_STILL_BACKDROP } from '../../constants';
import type { QualityTier } from '../../constants';
import { PORTRAIT_CAMERA } from '../../constants/animation';
import {
  ENTRY_FADE_MS,
  MATERIALS_TIMEOUT_MS,
  VEIL_UNMOUNT_MARGIN_MS,
  gateAllowsCinematic,
  veilHoldsScreen,
} from '../../lib/entryReadiness';
import { advanceTime, captureMode, resolveCapturePose } from '../../lib/captureMode';
import { cinematicTimeScale, openingSegment, resolveOpeningPose, TAIL_FULL_OPACITY } from '../../lib/openingTimeline';
import { returnSettleWindowOpen, viewerControlNow } from '../../lib/viewerControl';
import { cancelReturnFlight, fittedFov, initialFreeViewState, stepFreeViewCamera } from '../../lib/freeViewCamera';
import type { FlightPose } from '../../lib/freeViewCamera';
import { sharedJourney } from '../../lib/sharedJourney';
import { TAIL_OCCUPANCY, tailHeading } from '../../lib/tailPath';
import {
  driveQualityGovernor,
  governorProbeFrameMs,
  governorSetup,
  initialGovernorState,
  qualityRecorder,
} from '../../lib/qualityGovernor';
import type { GovernorConfig, GovernorState } from '../../lib/qualityGovernor';
import { qualityBudget } from '../../lib/qualityBudget';
import { pulsationLighting } from '../../lib/pulsationLighting';
import * as THREE from 'three';
import type { StarName } from '../UI/InfoCards';
import MiraA from './MiraA';
import MiraB from './MiraB';
import MiraTail from './MiraTail';
import MaterialStream from './MaterialStream';
import StarField from './StarField';
import GlowShell from './GlowShell';

interface SceneProps {
  onSelectStar: (star: StarName | null) => void;
}

type OrbitControlsImpl = React.ElementRef<typeof DreiOrbitControls>;

const Z_AXIS = new THREE.Vector3(0, 0, 1);

// Place the camera (and its orbit target) exactly on a pose lib/freeViewCamera has
// already fitted for the current aspect: the explore landing, the reduced-motion
// return, and the capture pin all share this.
function applyPose(camera: THREE.PerspectiveCamera, controls: OrbitControlsImpl | null, pose: FlightPose) {
  camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
  camera.fov = pose.fov;
  camera.updateProjectionMatrix();
  camera.lookAt(pose.lookAt[0], pose.lookAt[1], pose.lookAt[2]);
  if (controls) controls.target.set(pose.lookAt[0], pose.lookAt[1], pose.lookAt[2]);
}

// Dev-only e2e seam: project a world-space anchor to screen percentages, so specs
// click the star or the tail where it actually is — the journey (#86) carries both
// off their home positions. `vec` is caller-owned scratch, same pattern as the refs.
function screenPercent(anchor: THREE.Object3D, camera: THREE.Camera, vec: THREE.Vector3): string {
  anchor.getWorldPosition(vec);
  vec.project(camera);
  return `${(((vec.x + 1) / 2) * 100).toFixed(2)},${(((1 - vec.y) / 2) * 100).toFixed(2)}`;
}

function SceneContent({
  onSelectStar,
  reduceMotion,
  tier,
  governor,
  onTierChange,
}: {
  onSelectStar: (star: StarName | null) => void;
  reduceMotion: boolean;
  tier: QualityTier;
  governor: { enabled: boolean; config: GovernorConfig };
  onTierChange: (from: QualityTier, to: QualityTier, reason: 'sustained-slow' | 'sustained-fast') => void;
}) {
  const portrait = useThree(state => state.size.height > state.size.width);
  const CAMERA = portrait ? PORTRAIT_CAMERA : LANDSCAPE_CAMERA;
  const cinematicPhase = useBinaryStar((state) => state.cinematicPhase);
  const setCinematicPhase = useBinaryStar((state) => state.setCinematicPhase);
  const setCinematicTime = useBinaryStar((state) => state.setCinematicTime);
  const setIntroComplete = useBinaryStar((state) => state.setIntroComplete);
  const lod = qualityBudget(tier);
  const occupancy = TAIL_OCCUPANCY;
  const capture = captureMode();

  // 今晚的 Mira (#23) bridge: the save flow presses capture synchronously inside
  // the viewer's click. preserveDrawingBuffer stays off, so the read must happen in
  // the same task as a forced render — advance() runs one real frame (the composer's
  // bloom included) and toDataURL reads it back immediately. A lost context is
  // reported honestly instead of returning a blank or stale frame.
  const gl = useThree((state) => state.gl);
  const advance = useThree((state) => state.advance);
  useEffect(() => {
    tonightFrame.capture = () => {
      if (gl.getContext().isContextLost()) return 'context-lost';
      advance(performance.now());
      return {
        dataUrl: gl.domElement.toDataURL('image/png'),
        width: gl.domElement.width,
        height: gl.domElement.height,
      };
    };
    return () => {
      tonightFrame.capture = null;
    };
  }, [gl, advance]);

  const timeRef = useRef(0);
  const cinematicStartRef = useRef(0);
  const cinematicElapsedRef = useRef(0);
  const captionMarkRef = useRef(0);
  // 共同前行 (#86): the pair's shared ride along the tail's heading. The phase is
  // a scene clock like the orbit's — it only runs in free viewing, pauses with the
  // scene, resumes from the held phase, and parks under reduced motion / capture.
  const journeyPhaseRef = useRef(0);
  const journeyGroupRef = useRef<THREE.Group>(null);
  const miraAAnchorRef = useRef<THREE.Group>(null);
  // 去向: derived from the existing tail path (the tail itself is not redone). The
  // camera advance rides the same world-space heading the pair journeys along —
  // under portrait the whole scene carries the diagonal tilt, so the heading does
  // (the tilt is applied where the vector is consumed, in the frame loop).
  const heading = tailHeading(PHYSICS.TAIL.length);
  const advanceVecRef = useRef(new THREE.Vector3());
  // The free-viewing camera (自由观看) state machine — flights, landing, capture
  // pin — lives in lib/freeViewCamera; the frame loop only applies its verdicts.
  const flightRef = useRef(initialFreeViewState());
  const orbitControlsRef = useRef<React.ElementRef<typeof DreiOrbitControls>>(null);
  const tailOpacityRef = useRef(0);
  const miraBGroupRef = useRef<THREE.Group>(null);
  const miraBTargetRef = useRef<THREE.Mesh>(null);
  const tailTargetRef = useRef<THREE.Mesh>(null);
  const previousAspect = useRef(1);
  const miraAScreenRef = useRef(new THREE.Vector3());
  const tailScreenRef = useRef(new THREE.Vector3());
  const ambientLookRef = useRef(new THREE.Vector3());
  const firstFrameMarkedRef = useRef(false);
  // Quality governor (#26): the state lives outside React — it is fed every frame
  // and only its rare "change" verdicts surface, through onTierChange. It begins
  // when the entry gate opens, not at first frame (driveQualityGovernor owns that
  // contract), and resets on return from the background.
  const governorRef = useRef<GovernorState | null>(null);
  const frameCountRef = useRef(0);
  const lastResourceSampleAtRef = useRef(0);
  // Returning from the background: the first frame's delta spans the whole hidden
  // interval and the pipeline may re-warm, so neither the window nor the streaks
  // may carry over. Treat the return like initialisation — same tier, fresh
  // window, fresh cooldown grace.
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden && governorRef.current !== null) {
        governorRef.current = initialGovernorState(governorRef.current.tier, performance.now());
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const positionsRef = useRef({
    primary: [0, 0, 0] as [number, number, number],
    companion: [0, 0, 0] as [number, number, number],
  });

  // Background click to deselect

  // Main loop. Stage order is the invariant: 门 (gate) → 控制 (control) → 飞行
  // (flight) → 开场 (opening) → 治理 (governor) → 标记 (marking), with one camera
  // prelude (aspect refit) ahead of 控制 and the always-running world (orbital
  // tick, companion position, ambient distance) between 开场 and 治理 — the world
  // belongs to no stage and runs regardless of the 门. The 入场门 is read exactly
  // once per frame, before any consumer: the 开场 clock and the 治理 evidence rule
  // share one verdict, so a frame can never disagree with itself about whether
  // loading is over. Invariants carried by the order: while the 门 is closed the
  // 开场 clock does not advance, and the frame is not admitted as 治理 evidence.
  useFrame((state, delta) => {
    // 门: the one read both consumers below share.
    const gateOpen = gateAllowsCinematic(useEntryReadiness.getState().gate);
    const camera = state.camera as THREE.PerspectiveCamera;
    if (camera.aspect !== previousAspect.current) {
      // Undo the old portrait expansion, then apply the new aspect (including
      // rotation). The flights' stored origin fovs refit inside the state machine.
      camera.fov = fittedFov(camera.fov, camera.aspect, previousAspect.current);
      camera.updateProjectionMatrix();
      previousAspect.current = camera.aspect;
    }
    const store = useBinaryStar.getState();

    // Viewer control, decided once per frame from the shared intentional-input clock.
    // While a hold is active the clock keeps restarting, so its release starts the
    // 30s/60s count from zero instead of cashing in time spent reading or away. An
    // armed return flight holds the clock too — it is the camera's own business, and
    // this way it cannot land in an already-expired idle count.
    const control = viewerControlNow(store, reduceMotion);
    // One step of the free-viewing camera: the live pose is fed in so flights can
    // capture their origins, and the verdicts come back as a pose to apply, the
    // controls enable state, and whether an armed flight holds the idle clock.
    const orbit = orbitControlsRef.current;
    const flight = stepFreeViewCamera(flightRef.current, {
      delta,
      aspect: camera.aspect,
      portrait,
      introComplete: store.introComplete,
      openingRanToEnd: cinematicStartRef.current !== 0 && cinematicElapsedRef.current >= CINEMATIC.EXPLORE_MODE,
      returnToExploreAt: store.returnToExploreAt,
      returnSettleActive: returnSettleWindowOpen(store),
      inputSeq: store.inputSeq,
      epilogueCamera: control.epilogueCamera,
      reduceMotion,
      capturePose: capture.active && store.introComplete ? resolveCapturePose(capture.camera, CAMERA.EXPLORE) : null,
      camera: {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: orbit
          ? [orbit.target.x, orbit.target.y, orbit.target.z]
          : [...CAMERA.EXPLORE.lookAt],
        fov: camera.fov,
      },
    });
    flightRef.current = flight.state;
    if (control.holdsIdle || flight.holdsClock) store.restampIdleClock();
    store.setAutoCamera(control.autoCamera);
    // The frame loop is the epilogue's only clock-driven writer (the closing text
    // only renders): the verdict is applied write-on-change, exactly like the auto
    // camera above. epilogueVisible keeps its camera-or-text meaning for the closing
    // flight and e2e; epilogueText is the line's own visibility.
    store.setEpilogueVisible(control.epilogueCamera || control.epilogueText);
    store.setEpilogueText(control.epilogueText);
    const { introComplete, cinematicPhase } = store;

    // Apply the free-viewing verdicts: the pose (already fitted for the current
    // aspect), the controls enable state, and the landing's one-shot bookkeeping —
    // idle counts from the moment exploration starts, and the opening's start mark
    // retires so a later re-landing takes the full explore framing again.
    if (flight.pose) applyPose(camera, orbitControlsRef.current, flight.pose);
    if (orbitControlsRef.current && orbitControlsRef.current.enabled !== flight.controlsEnabled) {
      orbitControlsRef.current.enabled = flight.controlsEnabled;
    }
    if (flight.landedExplore) {
      store.restampIdleClock();
      cinematicStartRef.current = 0;
    }
    if (flight.landedReturn) {
      // A completed return is a deliberate repositioning: the idle count restarts
      // from the landing, so the closing takeover never chases a viewer who just
      // asked for the main view (the click-time restamp alone leaves the flight's
      // duration counted against the idle run).
      store.restampIdleClock();
    }

    // The idle camera (#86): a very slow advance along the tail's heading, never an
    // orbit around the pair. Only while the viewer owns the camera (no flight pose
    // this frame); the verdict already zeroes the speed for pause, reduced motion,
    // holds and the epilogue hand-off, and intentional input cancels it upstream.
    // The raw delta is honest here: the speed is tiny enough that even a stalled
    // software frame cannot lurch the scene. The orbit target translates with the
    // camera, so a drag still pivots the pair instead of chasing it.
    if (flight.pose === null && flight.controlsEnabled && control.autoAdvanceSpeed > 0 && orbit) {
      advanceVecRef.current.set(heading[0], heading[1], heading[2]);
      if (portrait) advanceVecRef.current.applyAxisAngle(Z_AXIS, Math.PI / 3);
      const step = control.autoAdvanceSpeed * delta;
      camera.position.addScaledVector(advanceVecRef.current, step);
      orbit.target.addScaledVector(advanceVecRef.current, step);
    }

    if (introComplete) {
      // Free exploration holds the tail at full reveal — the same value the opening
      // timeline ramps to, so the hand-off never steps.
      tailOpacityRef.current = TAIL_FULL_OPACITY;
    } else if (!gateOpen) {
      // The full cinematic waits until the main materials — or the procedural
      // fallback — can actually be presented (#24). The clock stays at zero and
      // the loading still holds the screen; a hung load is bounded by the gate
      // timeout, never by the network's good will.
      tailOpacityRef.current = 0;
    } else {
      // Replay has to re-anchor here; keeping the old start time would skip the opening.
      if (cinematicStartRef.current === 0) cinematicStartRef.current = Date.now();
      // Two dev-only clock overrides: `?cinematic-t=` (with capture mode) freezes the
      // opening at one instant for phase evidence; `?cinematic-scale=` multiplies the
      // wall clock so e2e reaches the natural ending in seconds.
      const frozen = capture.active ? capture.cinematicT : null;
      const t =
        frozen !== null
          ? frozen / 1000
          : ((Date.now() - cinematicStartRef.current) / 1000) * cinematicTimeScale();
      cinematicElapsedRef.current = t;

      const segment = openingSegment(t);
      if (segment.phase !== 'explore') {
        // The overlay only reacts at its caption boundaries, so publish the
        // quantized mark instead of the raw clock: the store updates on segment
        // changes only, never per frame (SPEC 界面订阅离散阶段).
        if (segment.mark !== captionMarkRef.current) {
          captionMarkRef.current = segment.mark;
          setCinematicTime(segment.mark);
        }
        if (segment.phase !== cinematicPhase) {
          setCinematicPhase(segment.phase);
        }
      } else if (cinematicPhase !== 'explore') {
        // The opening finished: hand over to free exploration. This has to live
        // outside the in-opening branch above, or the sequence never ends on its
        // own and the viewer is stranded on the last cinematic frame.
        setCinematicPhase('explore');
        setIntroComplete(true);
      }

      // The whole opening — hold, river pass, settle, and the reduced-motion pin — is
      // resolved by the pure timeline so the frame loop only applies the pose.
      const pose = resolveOpeningPose(t, { reduceMotion, portrait });
      camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
      camera.fov = fittedFov(pose.fov, camera.aspect);
      camera.updateProjectionMatrix();
      camera.lookAt(pose.lookAt[0], pose.lookAt[1], pose.lookAt[2]);
      tailOpacityRef.current = pose.tailOpacity;
    }

    // Orbital mechanics (always running unless the viewer paused the scene). The
    // orbit speed is fixed — the time-speed control is gone (#89); what was its
    // default (1.0x) is now simply the speed.
    timeRef.current = advanceTime(timeRef.current, delta, {
      reduceMotion,
      scale: 0.08,
    });
    // 共同前行 (#86): the shared ride along the heading runs on its own scene
    // clock, and only in free viewing — the full cinematic owns the framing and
    // expects the pair at home. The ride carries the journey group (stars, tail,
    // haze, click targets); on top of it the red giant answers the tow and the
    // white dwarf rides its lag plus the visible orbit.
    if (introComplete) {
      journeyPhaseRef.current = advanceTime(journeyPhaseRef.current, delta, {
        reduceMotion,
      });
    } else {
      // The journey belongs to free viewing: the opening always finds the pair at
      // home, and every hand-off starts the ride from phase zero.
      journeyPhaseRef.current = 0;
    }
    const journey = sharedJourney(journeyPhaseRef.current, heading);
    journeyGroupRef.current?.position.set(journey.base[0], journey.base[1], journey.base[2]);
    const newPositions = calculateOrbitalPosition(timeRef.current, PHYSICS.ORBIT);
    const primary: [number, number, number] = [
      journey.primary[0] + newPositions.primary[0],
      journey.primary[1] + newPositions.primary[1],
      journey.primary[2] + newPositions.primary[2],
    ];
    const companion: [number, number, number] = [
      journey.companion[0] + newPositions.companion[0],
      journey.companion[1] + newPositions.companion[1],
      journey.companion[2] + newPositions.companion[2],
    ];
    positionsRef.current = { primary, companion };

    // Both stars move every frame now, so they are positioned imperatively rather
    // than through props: prop values are only re-applied on re-render, which stops
    // once the cinematic ends and would leave the pair frozen in explore mode.
    miraAAnchorRef.current?.position.set(primary[0], primary[1], primary[2]);
    miraBGroupRef.current?.position.set(companion[0], companion[1], companion[2]);
    miraBTargetRef.current?.position.set(companion[0], companion[1], companion[2]);

    // Ambient sound (#22): the distance to the orbit target (pan is disabled, so
    // the target is the fixed look-at) feeds the barely-there tone shift. A plain
    // write, never a store update — the sound shell polls it a few times a second,
    // so this never re-renders React.
    ambientSpace.distance = camera.position.distanceTo(
      orbitControlsRef.current?.target ?? ambientLookRef.current.set(...CAMERA.EXPLORE.lookAt),
    );

    // Quality governor (#26): feed the frame time and act on change verdicts only.
    // Capture mode parks every clock at a fixed phase, so its frames say nothing
    // about the viewer's machine — recording and governing both stand down. While
    // the tab is hidden the loop is stopped (frameloop="never" on the Canvas); the
    // document.hidden guard covers the frames before React applies that switch.
    // While the entry gate waits, driveQualityGovernor holds the governor off:
    // loading frames are not evidence.
    const recorder = qualityRecorder();
    if (!capture.active) {
      const frameMs = (governor.enabled ? governorProbeFrameMs() : null) ?? delta * 1000;
      const now = performance.now();
      recorder.noteFrame(frameMs);
      if (now - lastResourceSampleAtRef.current >= 5000) {
        lastResourceSampleAtRef.current = now;
        recorder.noteResources({
          at: now,
          tier,
          dpr: state.gl.getPixelRatio(),
          width: state.gl.domElement.width,
          height: state.gl.domElement.height,
          geometries: state.gl.info.memory.geometries,
          textures: state.gl.info.memory.textures,
          heapBytes:
            (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null,
        });
      }
      if (governor.enabled && !document.hidden) {
        const driven = driveQualityGovernor(governorRef.current, gateOpen, frameMs, now, governor.config, tier);
        governorRef.current = driven.state;
        const verdict = driven.verdict;
        if (verdict !== null && verdict.kind === 'change') {
          recorder.noteChange({ at: now, from: verdict.from, to: verdict.to, reason: verdict.reason });
          onTierChange(verdict.from, verdict.to, verdict.reason);
        }
      }
    }

    // Dev-only e2e observability (same gate as ?epoch=): the camera pose as a coarse
    // attribute, written imperatively so it never re-renders React. Rounded to a
    // tenth of a unit — enough to tell a drag apart from the main view. Mira A's
    // projected screen position lets specs click the star where it actually is
    // instead of a hardcoded canvas fraction. data-frame-count is the frame-loop
    // heartbeat: a hidden tab must stop it, a visible one must keep it moving.
    if (!import.meta.env.PROD) {
      const el = state.gl.domElement;
      const pose = `${camera.position.x.toFixed(1)},${camera.position.y.toFixed(1)},${camera.position.z.toFixed(1)}`;
      if (el.dataset.cameraPose !== pose) el.dataset.cameraPose = pose;
      frameCountRef.current += 1;
      el.dataset.frameCount = String(frameCountRef.current);
      // Mira A and the tail's click target, projected to screen percentages through
      // one seam: the click probes read where each anchor actually is this frame.
      if (miraAAnchorRef.current) {
        const miraA = screenPercent(miraAAnchorRef.current, camera, miraAScreenRef.current);
        if (el.dataset.miraAScreen !== miraA) el.dataset.miraAScreen = miraA;
      }
      // The tail's click target, projected the same way (#88): with the treasure-hunt
      // hint gone from the lower edge, the scene itself is the tail's entry and specs
      // click it where it actually is.
      if (tailTargetRef.current) {
        const tail = screenPercent(tailTargetRef.current, camera, tailScreenRef.current);
        if (el.dataset.tailScreen !== tail) el.dataset.tailScreen = tail;
      }
    }

    // The cold-start probe fires at the first COMPLETED frame — not at context
    // creation — so the number means "first presentable picture" (#24, SPEC 真实
    // 时间、加载与运行).
    if (!firstFrameMarkedRef.current) {
      firstFrameMarkedRef.current = true;
      noteEntryMark(state.gl.domElement, 'firstFrameMs');
    }
  });

  // Tail opacity is computed in useFrame and stored in tailOpacityRef
  return (
    <>
      {/* Portrait stands farther down the tail, so the haze has to reach that far
          or the river fades out just as the scale of it should read. */}
      <fog attach="fog" args={[COLORS.VOID_BLACK, portrait ? 20 : 15, portrait ? 80 : 50]} />
      <group rotation-z={portrait ? Math.PI / 3 : 0}>
      {/* The sky stays home: the star field is what the journey moves against. */}
      <StarField count={lod.starCount} />

      {/* 共同前行 (#86): everything that belongs to the pair — stars, stream,
          tail, haze, click targets — rides this one offset along the heading. */}
      <group ref={journeyGroupRef}>
      {/* Mira A - Red Giant. The anchor carries the giant's own answer to the tow
          (回应), set imperatively every frame. */}
      <group ref={miraAAnchorRef}>
      <group ref={(g) => { if (g) g.userData.starName = 'miraA'; }}>
        <MiraA
          position={[0, 0, 0]}
          radius={PHYSICS.MIRA_A.radius}
          turbulence={0.3}
          segments={lod.sphereSegments}
        />
        {/* Invisible click target — inner atmosphere, so a click on the halo selects the star. */}
        <mesh
          userData={{ starName: 'miraA' }}
          onClick={(e) => {
            e.stopPropagation();
            if (cinematicPhase === 'explore') onSelectStar('miraA');
          }}
        >
          <sphereGeometry args={[PHYSICS.MIRA_A.radius * 1.4, 16, 16]} />
          <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
      </group>

      {/* Mira B - White Dwarf */}
      <group ref={miraBGroupRef}>
        <MiraB
          position={[0, 0, 0]}
          radius={PHYSICS.MIRA_B.radius}
          segments={lod.sphereSegments}
          positionsRef={positionsRef}
        />
      </group>
      {/* Invisible click target for Mira B */}
      <mesh
        ref={miraBTargetRef}
        userData={{ starName: 'miraB' }}
        onClick={(e) => {
          e.stopPropagation();
          if (cinematicPhase === 'explore') onSelectStar('miraB');
        }}
      >
        <sphereGeometry args={[PHYSICS.MIRA_B.radius * 2, 16, 16]} />
        <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Always-visible material stream */}
      <MaterialStream
        positionsRef={positionsRef}
        particleCount={lod.streamParticles}
        turbulence={0.3}
      />

      {/* The Tail — hero feature. Occupancy (yaw, click, haze) lives in lib/tailPath. */}
      <group rotation={[0, occupancy.yaw, 0]}>
        <MiraTail
          opacityRef={tailOpacityRef}
          particleCount={lod.tailParticles}
          tailLength={PHYSICS.TAIL.length}
          miraBRef={miraBGroupRef}
          tier={tier}
        />
      </group>
      {/* Invisible click target for tail card */}
      <mesh
        ref={tailTargetRef}
        position={occupancy.click.position}
        userData={{ starName: 'tail' }}
        onClick={(e) => {
          e.stopPropagation();
          if (cinematicPhase === 'explore') onSelectStar('tail');
        }}
      >
        <boxGeometry args={occupancy.click.size} />
        <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Ambient haze around the tail — anchors it against the star field in explore mode. */}
      {cinematicPhase === 'explore' && (
        <group position={occupancy.haze.position}>
          <GlowShell
            shellRadius={occupancy.haze.radius}
            color={COLORS.STELLAR_ORANGE}
            opacity={0.042}
            falloff={2.4}
          />
        </group>
      )}

      </group>

      {/* Background click to deselect */}
      <mesh
        renderOrder={-1}
        onClick={() => {
          if (cinematicPhase === 'explore') onSelectStar(null);
        }}
      >
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      </group>
      {/* Orbit controls (disabled during cinematic). The idle advance is driven per
          frame by the viewer-control rules above; starting a drag is intentional
          input and interrupts the auto camera and the epilogue in the same event. */}
      <DreiOrbitControls
        ref={orbitControlsRef}
        onStart={() => {
          // OrbitControls updates before the frame loop runs, so the cancel has to
          // be synchronous — the input-sequence check alone would let the flight
          // fight the viewer's first pointer move for one frame.
          flightRef.current = cancelReturnFlight(flightRef.current);
          useBinaryStar.getState().noteIntentionalInput();
        }}
        enablePan={false}
        enableRotate
        enableZoom
        minDistance={5}
        maxDistance={40}
        enableDamping={!capture.active}
        dampingFactor={0.05}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
      />
    </>
  );
}

function PostProcessing({ tier }: { tier: QualityTier }) {
  const sky = useBinaryStar((state) => state.sky);
  const light = pulsationLighting(sky);
  // Bloom is a stack of full-screen passes: keep it off the light tier.
  // Low quality has no bloom — StarField carries the same envelope there.
  if (tier === 'low') return null;
  const levels = qualityBudget(tier).bloomLevels;

  return (
    <EffectComposer enableNormalPass={false}>
      <Bloom
        luminanceThreshold={0.9}
        mipmapBlur
        intensity={light.bloomIntensity}
        radius={light.bloomRadius}
        levels={levels}
      />
    </EffectComposer>
  );
}

// Cold-start record (#24), two measurement points from navigation start:
// contextCreatedMs (the canvas context exists) and firstFrameMs (the first
// completed frame — the same moment data-camera-pose lands, i.e. the first
// presentable picture). A window probe and data attributes keep both readable
// from e2e and the devtools; the console line stays dev-only.
function noteEntryMark(canvas: HTMLCanvasElement, key: 'contextCreatedMs' | 'firstFrameMs') {
  const ms = Math.round(performance.now());
  (window as unknown as Record<string, unknown>).__miraEntry = {
    ...((window as unknown as Record<string, unknown>).__miraEntry as object | undefined),
    [key]: ms,
  };
  canvas.dataset[key === 'firstFrameMs' ? 'entryFirstFrameMs' : 'entryContextMs'] = String(ms);
  if (key === 'firstFrameMs' && !import.meta.env.PROD) {
    console.info(`[mira] first presentable frame ${ms}ms after navigation start`);
  }
}

export default function Scene({ onSelectStar }: SceneProps) {
  const CAMERA = window.innerHeight > window.innerWidth ? PORTRAIT_CAMERA : LANDSCAPE_CAMERA;
  // The governor's opening tier is the detected one, unless a dev ?quality-start=
  // asks otherwise; an explicit ?quality= pin keeps the governor off, so the tier
  // state below never moves away from the pin.
  const setup = governorSetup();
  const [tier, setTier] = useState<QualityTier>(() => setup.startTier ?? resolveQualityTier());
  const [lastQualityChange, setLastQualityChange] = useState<{
    from: QualityTier;
    to: QualityTier;
    reason: 'sustained-slow' | 'sustained-fast';
  } | null>(null);
  // Antialias is a context-creation flag: a runtime downgrade cannot re-create the
  // context, so it follows the opening tier, not the governed one.
  const [antialias] = useState(() => tier !== 'low');
  const reduceMotion = Boolean(useReducedMotion());
  const startInExplore = useBinaryStar.getState().introComplete;
  const introComplete = useBinaryStar((state) => state.introComplete);
  const [canvasReady, setCanvasReady] = useState(false);
  const [glCanvas, setGlCanvas] = useState<HTMLCanvasElement | null>(null);
  const language = useBinaryStar((state) => state.language);
  const gate = useEntryReadiness((state) => state.gate);
  // Background draw control (#26): a hidden tab stops the render loop entirely.
  // r3f owns the loop, so switching frameloop never stacks a second one, and the
  // 0.05s delta clamp in advanceTime keeps the first frame back from lurching.
  const [background, setBackground] = useState(() => document.hidden);
  useEffect(() => {
    const onVisibility = () => setBackground(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const handleTierChange = useCallback(
    (from: QualityTier, to: QualityTier, reason: 'sustained-slow' | 'sustained-fast') => {
      setTier(to);
      setLastQualityChange({ from, to, reason });
    },
    [],
  );

  // Quality observability (#26): always on, unlike the dev-only probes — the SPEC
  // asks the shipped experience to record tier changes, not just the test build.
  // Written on change only, so there is no per-frame DOM work.
  useEffect(() => {
    if (!glCanvas) return;
    glCanvas.dataset.qualityTier = tier;
    if (lastQualityChange !== null) {
      glCanvas.dataset.qualityLastChange =
        `${lastQualityChange.from}>${lastQualityChange.to}:${lastQualityChange.reason}`;
    }
  }, [glCanvas, tier, lastQualityChange]);

  // The gate's hard bound: materials that never answer are declared timed-out
  // and the opening proceeds on the procedural fallback.
  useEffect(() => {
    if (gate !== 'waiting') return;
    const id = window.setTimeout(() => useEntryReadiness.getState().noteMaterialsTimedOut(), MATERIALS_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [gate]);

  // Context lost/restored (#24): one listener pair per canvas element, torn down
  // with it — a restore re-uses the live tree, so nothing re-registers.
  useEffect(() => {
    if (!glCanvas) return;
    const onLost = (event: Event) => {
      // preventDefault opts in to restoration; without it no restored event fires.
      event.preventDefault();
      useEntryReadiness.getState().noteSceneAccess('context-lost');
    };
    const onRestored = () => useEntryReadiness.getState().noteSceneAccess('context-restored');
    glCanvas.addEventListener('webglcontextlost', onLost);
    glCanvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      glCanvas.removeEventListener('webglcontextlost', onLost);
      glCanvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [glCanvas]);

  // The handoff is decided in lib/entryReadiness (#65): the loading still lifts
  // when the canvas exists and — for the full cinematic only — when the gate has
  // opened; direct entry adds no waiting ceremony beyond the canvas itself. The
  // lift is a dissolve over ENTRY_FADE_MS (#62) — CSS opacity, which the
  // compositor drives even under a starved main thread — and the element's
  // removal is on a wall-clock timer, never on an animation callback: CI renders
  // in software at seconds per frame, and no frame-loop condition may keep a
  // loading screen on screen (#63).
  const veilUp = veilHoldsScreen({ canvasReady, openingPassed: introComplete, gate });
  const [veilMounted, setVeilMounted] = useState(true);
  useEffect(() => {
    if (veilUp) {
      // One-way in practice (canvasReady and introComplete never revert); the
      // reset only keeps an impossible resurrection honest.
      setVeilMounted(true);
      return;
    }
    const id = window.setTimeout(() => setVeilMounted(false), ENTRY_FADE_MS + VEIL_UNMOUNT_MARGIN_MS);
    return () => window.clearTimeout(id);
  }, [veilUp]);

  return (
    <>
      {veilMounted && (
        <div
          data-testid="loading"
          data-still-source={ENTRY_STILL.version}
          className="fixed inset-0 z-[5] flex items-center justify-center pointer-events-none select-none"
          style={{
            ...ENTRY_STILL_BACKDROP,
            opacity: veilUp ? 1 : 0,
            transition: `opacity ${ENTRY_FADE_MS}ms ease-out`,
          }}
        >
          <div className="absolute inset-0 bg-black/60" />
          <p className="relative text-white/45 text-sm font-extralight tracking-[0.25em]">
            {TRANSLATIONS[language].loading}
          </p>
        </div>
      )}
    <Canvas
      frameloop={background ? 'never' : 'always'}
      onCreated={(state) => {
        setCanvasReady(true);
        setGlCanvas(state.gl.domElement);
        noteEntryMark(state.gl.domElement, 'contextCreatedMs');
      }}
      camera={{
        position: startInExplore ? CAMERA.EXPLORE.position : CAMERA.CLOSE.position,
        fov: startInExplore ? CAMERA.EXPLORE.fov : CAMERA.CLOSE.fov,
      }}
      gl={{
        antialias,
        alpha: false,
        stencil: false,
        depth: true,
      }}
      dpr={qualityBudget(tier).dpr}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: COLORS.DEEP_SPACE,
        opacity: 1,
        zIndex: 0,
      }}
    >
      <color attach="background" args={[COLORS.VOID_BLACK]} />

      <SceneContent
        onSelectStar={onSelectStar}
        reduceMotion={reduceMotion}
        tier={tier}
        governor={{ enabled: setup.enabled, config: setup.config }}
        onTierChange={handleTierChange}
      />
      <PostProcessing tier={tier} />
    </Canvas>
    </>
  );
}
