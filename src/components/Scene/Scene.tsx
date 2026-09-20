import { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls as DreiOrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useReducedMotion } from 'framer-motion';
import { useBinaryStar, ambientSpace, tonightFrame, useEntryReadiness } from '../../hooks';
import { COLORS, PHYSICS, calculateOrbitalPosition, CINEMATIC, CAMERA as LANDSCAPE_CAMERA, TRANSLATIONS, resolveQualityTier, ENTRY_STILL, ENTRY_STILL_BACKDROP } from '../../constants';
import type { QualityTier } from '../../constants';
import { PORTRAIT_CAMERA } from '../../constants/animation';
import { MATERIALS_TIMEOUT_MS, gateAllowsCinematic } from '../../lib/entryReadiness';
import { advanceTime, captureMode, resolveCapturePose } from '../../lib/captureMode';
import { cinematicTimeScale, openingSegment, resolveOpeningPose, TAIL_FULL_OPACITY } from '../../lib/openingTimeline';
import { viewerControlNow, RETURN_SETTLE_MS } from '../../lib/viewerControl';
import { cancelReturnFlight, fittedFov, initialFreeViewState, stepFreeViewCamera } from '../../lib/freeViewCamera';
import type { FlightPose } from '../../lib/freeViewCamera';
import {
  driveQualityGovernor,
  governorProbeFrameMs,
  governorSetup,
  initialGovernorState,
  qualityRecorder,
} from '../../lib/qualityGovernor';
import type { GovernorConfig, GovernorState } from '../../lib/qualityGovernor';
import { qualityBudget } from '../../lib/qualityBudget';
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
  const timeSpeed = useBinaryStar((state) => state.parameters.timeSpeed);
  const cinematicPhase = useBinaryStar((state) => state.cinematicPhase);
  const setCinematicPhase = useBinaryStar((state) => state.setCinematicPhase);
  const setCinematicTime = useBinaryStar((state) => state.setCinematicTime);
  const setIntroComplete = useBinaryStar((state) => state.setIntroComplete);
  const lod = qualityBudget(tier);
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
  // The free-viewing camera (自由观看) state machine — flights, landing, capture
  // pin — lives in lib/freeViewCamera; the frame loop only applies its verdicts.
  const flightRef = useRef(initialFreeViewState());
  const orbitControlsRef = useRef<React.ElementRef<typeof DreiOrbitControls>>(null);
  const tailOpacityRef = useRef(0);
  const miraBGroupRef = useRef<THREE.Group>(null);
  const miraBTargetRef = useRef<THREE.Mesh>(null);
  const previousAspect = useRef(1);
  const miraAScreenRef = useRef(new THREE.Vector3());
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
    secondary: [0, 0, 0] as [number, number, number],
  });

  // Background click to deselect

  // Main loop: cinematic + orbital animation
  useFrame((state, delta) => {
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
      openingFinished: cinematicStartRef.current !== 0 && cinematicElapsedRef.current >= CINEMATIC.EXPLORE_MODE,
      returnToExploreAt: store.returnToExploreAt,
      returnSettleActive:
        store.returnToExploreAt > 0 && Date.now() - store.returnToExploreAt < RETURN_SETTLE_MS,
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
    if (orbitControlsRef.current) {
      // Driven per frame rather than by prop: the 3s ramp is a continuous value, and
      // the epilogue hands rotation off instead of snapping it.
      orbitControlsRef.current.autoRotate = control.autoRotateSpeed > 0;
      orbitControlsRef.current.autoRotateSpeed = control.autoRotateSpeed;
    }
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

    if (introComplete) {
      // Free exploration holds the tail at full reveal — the same value the opening
      // timeline ramps to, so the hand-off never steps.
      tailOpacityRef.current = TAIL_FULL_OPACITY;
    } else if (!gateAllowsCinematic(useEntryReadiness.getState().gate)) {
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
      const elapsed =
        frozen !== null
          ? frozen / 1000
          : ((Date.now() - cinematicStartRef.current) / 1000) * cinematicTimeScale();
      const t = elapsed / timeSpeed;
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

    // Orbital mechanics (always running unless the viewer paused the scene)
    timeRef.current = advanceTime(timeRef.current, delta, {
      reduceMotion,
      scale: timeSpeed * .08,
    });
    const newPositions = calculateOrbitalPosition(timeRef.current, PHYSICS.ORBIT);
    positionsRef.current = {
      primary: newPositions.primary,
      secondary: newPositions.secondary,
    };

    // Mira B moves every frame, so it is positioned imperatively rather than through
    // props: prop values are only re-applied on re-render, which stops once the
    // cinematic ends and would leave the companion frozen in explore mode.
    const secondary = newPositions.secondary;
    miraBGroupRef.current?.position.set(secondary[0], secondary[1], secondary[2]);
    miraBTargetRef.current?.position.set(secondary[0], secondary[1], secondary[2]);

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
        const gateOpen = gateAllowsCinematic(useEntryReadiness.getState().gate);
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
      miraAScreenRef.current.set(0, 0, 0).project(camera);
      const miraA = `${(((miraAScreenRef.current.x + 1) / 2) * 100).toFixed(2)},${(((1 - miraAScreenRef.current.y) / 2) * 100).toFixed(2)}`;
      if (el.dataset.miraAScreen !== miraA) el.dataset.miraAScreen = miraA;
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
      <group rotation-z={portrait ? Math.PI / 3 : 0}>
      {/* Custom twinkling star field */}
      <StarField count={lod.starCount} />

      {/* Mira A - Red Giant */}
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

      {/* The Tail — hero feature, rotated for visibility from default camera angle */}
      <group rotation={[0, Math.PI * 0.12, 0]}>
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
        position={[-8, 2, 6]}
        userData={{ starName: 'tail' }}
        onClick={(e) => {
          e.stopPropagation();
          if (cinematicPhase === 'explore') onSelectStar('tail');
        }}
      >
        <boxGeometry args={[12, 8, 2]} />
        <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Ambient haze around the tail — anchors it against the star field in explore mode. */}
      {cinematicPhase === 'explore' && (
        <group position={[-6, 1, 4]}>
          <GlowShell
            shellRadius={5}
            color={COLORS.STELLAR_ORANGE}
            opacity={0.042}
            falloff={2.4}
          />
        </group>
      )}

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
      {/* Orbit controls (disabled during cinematic). autoRotate is driven per frame by
          the viewer-control rules above; starting a drag is intentional input and
          interrupts the auto camera and the epilogue in the same event. */}
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
  const brightness = useBinaryStar((state) => state.sky.brightness);
  const colorShift = useBinaryStar((state) => state.sky.colorShift);
  // Bloom is a stack of full-screen passes: keep it off the light tier.
  // Low quality has no bloom — StarField carries the same envelope there.
  if (tier === 'low') return null;
  const levels = qualityBudget(tier).bloomLevels;

  return (
    <EffectComposer enableNormalPass={false}>
      <Bloom
        luminanceThreshold={0.9}
        mipmapBlur
        intensity={0.18 + 0.62 * brightness}
        radius={0.28 + 0.44 * colorShift}
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

  // The handoff is explicit: the loading still lifts when the canvas exists, and
  // — for the full cinematic only — when the gate has opened. Direct entry adds
  // no waiting ceremony beyond the canvas itself.
  const veilUp = !canvasReady || (!introComplete && gate === 'waiting');

  return (
    <>
      {veilUp && (
        <div
          data-testid="loading"
          data-still-source={ENTRY_STILL.version}
          className="fixed inset-0 z-[5] flex items-center justify-center pointer-events-none select-none"
          style={ENTRY_STILL_BACKDROP}
        >
          <div className="absolute inset-0 bg-black/60" />
          <p className="relative text-white/35 text-sm font-extralight italic tracking-[0.25em]">
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
      <fog attach="fog" args={[COLORS.VOID_BLACK, 15, 50]} />

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
