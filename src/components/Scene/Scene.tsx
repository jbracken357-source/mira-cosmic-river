import { useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls as DreiOrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useReducedMotion } from 'framer-motion';
import { useBinaryStar } from '../../hooks';
import { COLORS, PHYSICS, calculateOrbitalPosition, CINEMATIC, CAMERA as LANDSCAPE_CAMERA, TRANSITIONS, TRANSLATIONS, resolveQualityTier } from '../../constants';
import { PORTRAIT_CAMERA } from '../../constants/animation';
import { advanceTime, captureMode, resolveCapturePose } from '../../lib/captureMode';
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

// Level of Detail settings
const LOD = {
  mobile: {
    starCount: 1500,
    sphereSegments: 32,
    bloomLevels: 2,
    tailParticles: 3000,
    streamParticles: 300,
  },
  desktop: {
    starCount: 5000,
    sphereSegments: 64,
    bloomLevels: 4,
    tailParticles: 10000,
    streamParticles: 600,
  },
  // Software-rendered environments (headless CI, very weak devices)
  low: {
    starCount: 300,
    sphereSegments: 16,
    bloomLevels: 1,
    tailParticles: 300,
    streamParticles: 150,
  },
} as const;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// Preserve the horizontal view on portrait screens instead of cropping the stars.
function fittedFov(fov: number, aspect: number, fromAspect = 1) {
  const scale = Math.min(1, fromAspect) / Math.min(1, aspect);
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * scale));
}

function SceneContent({
  onSelectStar,
  reduceMotion,
}: {
  onSelectStar: (star: StarName | null) => void;
  reduceMotion: boolean;
}) {
  const portrait = useThree(state => state.size.height > state.size.width);
  const CAMERA = portrait ? PORTRAIT_CAMERA : LANDSCAPE_CAMERA;
  const timeSpeed = useBinaryStar((state) => state.parameters.timeSpeed);
  const cinematicPhase = useBinaryStar((state) => state.cinematicPhase);
  const epilogueVisible = useBinaryStar((state) => state.epilogueVisible);
  const setCinematicPhase = useBinaryStar((state) => state.setCinematicPhase);
  const setCinematicTime = useBinaryStar((state) => state.setCinematicTime);
  const setIntroComplete = useBinaryStar((state) => state.setIntroComplete);
  const tier = resolveQualityTier();
  const lod = tier === 'low' ? LOD.low : tier === 'mid' ? LOD.mobile : LOD.desktop;
  const capture = captureMode();

  const timeRef = useRef(0);
  const cinematicStartRef = useRef(0);
  const cinematicElapsedRef = useRef(0);
  const exploreAppliedRef = useRef(false);
  const orbitControlsRef = useRef<React.ElementRef<typeof DreiOrbitControls>>(null);
  const tailOpacityRef = useRef(0);
  const miraBGroupRef = useRef<THREE.Group>(null);
  const miraBTargetRef = useRef<THREE.Mesh>(null);
  const closingFromPos = useRef(new THREE.Vector3());
  const closingFromLook = useRef(new THREE.Vector3());
  const closingFromFov = useRef<number>(CAMERA.EXPLORE.fov);
  const closingBlend = useRef(0);
  const closingArmed = useRef(false);
  const closingLook = useRef(new THREE.Vector3());
  const previousAspect = useRef(1);
  const previousPortrait = useRef(portrait);

  const positionsRef = useRef({
    primary: [0, 0, 0] as [number, number, number],
    secondary: [0, 0, 0] as [number, number, number],
  });

  // Background click to deselect

  // Main loop: cinematic + orbital animation
  useFrame((state, delta) => {
    const camera = state.camera as THREE.PerspectiveCamera;
    if (previousPortrait.current !== portrait) {
      exploreAppliedRef.current = false;
      closingArmed.current = false;
      previousPortrait.current = portrait;
    }
    if (camera.aspect !== previousAspect.current) {
      // Undo the old portrait expansion, then apply the new aspect (including rotation).
      camera.fov = fittedFov(camera.fov, camera.aspect, previousAspect.current);
      if (closingArmed.current) closingFromFov.current = fittedFov(closingFromFov.current, camera.aspect, previousAspect.current);
      camera.updateProjectionMatrix();
      previousAspect.current = camera.aspect;
    }
    const { introComplete, cinematicPhase } = useBinaryStar.getState();

    if (introComplete) {
      const { epilogueVisible } = useBinaryStar.getState();
      if (!exploreAppliedRef.current) {
        // Return visits and early skip share the explore framing. A finished opening
        // keeps the sequence-end camera.
        const landExplore =
          cinematicStartRef.current === 0 ||
          cinematicElapsedRef.current < CINEMATIC.EXPLORE_MODE;
        if (landExplore) {
          camera.position.set(
            CAMERA.EXPLORE.position[0],
            CAMERA.EXPLORE.position[1],
            CAMERA.EXPLORE.position[2],
          );
          camera.fov = fittedFov(CAMERA.EXPLORE.fov, camera.aspect);
          camera.updateProjectionMatrix();
          camera.lookAt(
            CAMERA.EXPLORE.lookAt[0],
            CAMERA.EXPLORE.lookAt[1],
            CAMERA.EXPLORE.lookAt[2],
          );
        }
        if (orbitControlsRef.current) {
          if (landExplore) {
            orbitControlsRef.current.target.set(
              CAMERA.EXPLORE.lookAt[0],
              CAMERA.EXPLORE.lookAt[1],
              CAMERA.EXPLORE.lookAt[2],
            );
          } else {
            const lookAt = reduceMotion ? CAMERA.EXPLORE.lookAt : CAMERA.FAR.lookAt;
            orbitControlsRef.current.target.set(...lookAt);
          }
          orbitControlsRef.current.enabled = true;
          cinematicStartRef.current = 0;
          exploreAppliedRef.current = true;
        }
      }
      if (epilogueVisible && !reduceMotion) {
        const controls = orbitControlsRef.current;
        if (!closingArmed.current) {
          closingFromPos.current.copy(camera.position);
          if (controls) closingFromLook.current.copy(controls.target);
          else {
            closingFromLook.current.set(
              CAMERA.EXPLORE.lookAt[0],
              CAMERA.EXPLORE.lookAt[1],
              CAMERA.EXPLORE.lookAt[2],
            );
          }
          closingFromFov.current = camera.fov;
          closingBlend.current = 0;
          closingArmed.current = true;
        }
        if (controls) controls.enabled = false;
        closingBlend.current = Math.min(1, closingBlend.current + delta / TRANSITIONS.CLOSING_CAMERA);
        const k = easeInOutCubic(closingBlend.current);
        camera.position.set(
          THREE.MathUtils.lerp(closingFromPos.current.x, CAMERA.CLOSING.position[0], k),
          THREE.MathUtils.lerp(closingFromPos.current.y, CAMERA.CLOSING.position[1], k),
          THREE.MathUtils.lerp(closingFromPos.current.z, CAMERA.CLOSING.position[2], k),
        );
        camera.fov = THREE.MathUtils.lerp(closingFromFov.current, fittedFov(CAMERA.CLOSING.fov, camera.aspect), k);
        camera.updateProjectionMatrix();
        closingLook.current.set(
          THREE.MathUtils.lerp(closingFromLook.current.x, CAMERA.CLOSING.lookAt[0], k),
          THREE.MathUtils.lerp(closingFromLook.current.y, CAMERA.CLOSING.lookAt[1], k),
          THREE.MathUtils.lerp(closingFromLook.current.z, CAMERA.CLOSING.lookAt[2], k),
        );
        camera.lookAt(closingLook.current);
        if (controls) controls.target.copy(closingLook.current);
      } else if (closingArmed.current) {
        closingArmed.current = false;
        closingBlend.current = 0;
        if (orbitControlsRef.current) orbitControlsRef.current.enabled = true;
      }
      tailOpacityRef.current = 0.85;
    } else {
      exploreAppliedRef.current = false;
      closingArmed.current = false;
      if (orbitControlsRef.current) {
        orbitControlsRef.current.enabled = false;
      }
      // Replay has to re-anchor here; keeping the old start time would skip the opening.
      if (cinematicStartRef.current === 0) cinematicStartRef.current = Date.now();
      const elapsed = (Date.now() - cinematicStartRef.current) / 1000;
      const t = elapsed / timeSpeed;
      cinematicElapsedRef.current = t;

      if (t < CINEMATIC.EXPLORE_MODE) {
        setCinematicTime(t);
        if (t >= CINEMATIC.STARS_APPEAR && cinematicPhase === 'dark') {
          setCinematicPhase('stars-appear');
        }
        if (t >= CINEMATIC.PULL_BACK_START && cinematicPhase !== 'pull-back' && cinematicPhase !== 'tail-reveal') {
          setCinematicPhase('pull-back');
        }
        if (t >= CINEMATIC.TAIL_REVEAL_START && cinematicPhase === 'pull-back') {
          setCinematicPhase('tail-reveal');
        }

        if (reduceMotion) {
          camera.position.set(
            CAMERA.EXPLORE.position[0],
            CAMERA.EXPLORE.position[1],
            CAMERA.EXPLORE.position[2],
          );
          camera.fov = fittedFov(CAMERA.EXPLORE.fov, camera.aspect);
          camera.updateProjectionMatrix();
          camera.lookAt(
            CAMERA.EXPLORE.lookAt[0],
            CAMERA.EXPLORE.lookAt[1],
            CAMERA.EXPLORE.lookAt[2],
          );
        } else {
          let camPos: [number, number, number];
          let camFov: number;

          if (t < CINEMATIC.STARS_APPEAR) {
            camPos = CAMERA.CLOSE.position;
            camFov = CAMERA.CLOSE.fov;
          } else if (t < CINEMATIC.PULL_BACK_START) {
            camPos = CAMERA.CLOSE.position;
            camFov = CAMERA.CLOSE.fov;
          } else if (t < CINEMATIC.PULL_BACK_END) {
            const pullT = clamp01((t - CINEMATIC.PULL_BACK_START) / (CINEMATIC.PULL_BACK_END - CINEMATIC.PULL_BACK_START));
            const eased = easeInOutCubic(pullT);
            camPos = [
              THREE.MathUtils.lerp(CAMERA.CLOSE.position[0], CAMERA.FAR.position[0], eased),
              THREE.MathUtils.lerp(CAMERA.CLOSE.position[1], CAMERA.FAR.position[1], eased),
              THREE.MathUtils.lerp(CAMERA.CLOSE.position[2], CAMERA.FAR.position[2], eased),
            ];
            camFov = THREE.MathUtils.lerp(CAMERA.FOV_START, CAMERA.FOV_END, eased);
          } else {
            camPos = CAMERA.FAR.position;
            camFov = CAMERA.FOV_END;
          }

          camera.position.set(camPos[0], camPos[1], camPos[2]);
          camera.fov = fittedFov(camFov, camera.aspect);
          camera.updateProjectionMatrix();

          if (t >= CINEMATIC.TAIL_REVEAL_START) {
            const lookT = clamp01((t - CINEMATIC.TAIL_REVEAL_START) / (CINEMATIC.TAIL_FULL - CINEMATIC.TAIL_REVEAL_START));
            camera.lookAt(
              THREE.MathUtils.lerp(0, CAMERA.FAR.lookAt[0], easeInOutCubic(lookT)),
              THREE.MathUtils.lerp(0, CAMERA.FAR.lookAt[1], easeInOutCubic(lookT)),
              THREE.MathUtils.lerp(0, CAMERA.FAR.lookAt[2], easeInOutCubic(lookT)),
            );
          } else {
            camera.lookAt(0, 0, 0);
          }
        }
      } else if (cinematicPhase !== 'explore') {
        // The opening finished: hand over to free exploration. This has to live outside
        // the `t < EXPLORE_MODE` branch above, or the sequence never ends on its own and
        // the viewer is stranded on the last cinematic frame until they press Skip.
        setCinematicPhase('explore');
        setIntroComplete(true);
      }

      const cp = cinematicPhase;
      const ct = t;
      if (cp === 'dark' || cp === 'stars-appear') {
        tailOpacityRef.current = 0;
      } else if (cp === 'pull-back' && ct < CINEMATIC.TAIL_REVEAL_START) {
        const ot = clamp01((ct - CINEMATIC.PULL_BACK_START) / (CINEMATIC.TAIL_REVEAL_START - CINEMATIC.PULL_BACK_START));
        tailOpacityRef.current = ot * 0.15;
      } else if (cp === 'pull-back' || cp === 'tail-reveal') {
        const ot = clamp01((ct - CINEMATIC.TAIL_REVEAL_START) / (CINEMATIC.TAIL_FULL - CINEMATIC.TAIL_REVEAL_START));
        tailOpacityRef.current = easeInOutCubic(ot) * 0.85;
      } else {
        tailOpacityRef.current = 0.85;
      }
    }

    // Capture mode parks the camera at the requested pose every frame — after the explore
    // hand-off above and after OrbitControls' own update — so nothing can drift between runs.
    if (capture.active && introComplete) {
      const pose = resolveCapturePose(capture.camera, CAMERA.EXPLORE);
      camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
      camera.fov = fittedFov(pose.fov, camera.aspect);
      camera.updateProjectionMatrix();
      camera.lookAt(pose.lookAt[0], pose.lookAt[1], pose.lookAt[2]);
      if (orbitControlsRef.current) {
        orbitControlsRef.current.target.set(pose.lookAt[0], pose.lookAt[1], pose.lookAt[2]);
        orbitControlsRef.current.enabled = false;
      }
    }

    // Orbital mechanics (always running)
    timeRef.current = advanceTime(timeRef.current, delta, { reduceMotion, scale: timeSpeed * .08 });
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
      {/* Orbit controls (disabled during cinematic) */}
      <DreiOrbitControls
        ref={orbitControlsRef}
        enablePan={false}
        enableRotate
        enableZoom
        minDistance={5}
        maxDistance={40}
        autoRotate={!capture.active && !epilogueVisible && !reduceMotion}
        autoRotateSpeed={0.3}
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

function PostProcessing() {
  const tier = resolveQualityTier();
  const brightness = useBinaryStar((state) => state.sky.brightness);
  const colorShift = useBinaryStar((state) => state.sky.colorShift);
  // Bloom is a stack of full-screen passes: keep it off the light tier.
  // Low quality has no bloom — StarField carries the same envelope there.
  if (tier === 'low') return null;
  const levels = tier === 'mid' ? LOD.mobile.bloomLevels : LOD.desktop.bloomLevels;

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

export default function Scene({ onSelectStar }: SceneProps) {
  const CAMERA = window.innerHeight > window.innerWidth ? PORTRAIT_CAMERA : LANDSCAPE_CAMERA;
  const tier = resolveQualityTier();
  const lowQuality = tier === 'low';
  const reduceMotion = Boolean(useReducedMotion());
  const startInExplore = useBinaryStar.getState().introComplete;
  const [canvasReady, setCanvasReady] = useState(false);
  const language = useBinaryStar((state) => state.language);

  return (
    <>
      {!canvasReady && (
        <div
          data-testid="loading"
          className="fixed inset-0 z-[5] flex items-center justify-center pointer-events-none select-none"
          style={{ background: COLORS.DEEP_SPACE }}
        >
          <p className="text-white/35 text-sm font-extralight italic tracking-[0.25em]">
            {TRANSLATIONS[language].loading}
          </p>
        </div>
      )}
    <Canvas
      onCreated={() => setCanvasReady(true)}
      camera={{
        position: startInExplore ? CAMERA.EXPLORE.position : CAMERA.CLOSE.position,
        fov: startInExplore ? CAMERA.EXPLORE.fov : CAMERA.CLOSE.fov,
      }}
      gl={{
        antialias: !lowQuality,
        alpha: false,
        stencil: false,
        depth: true,
      }}
      dpr={tier === 'high' ? [1, 1.5] : 1}
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

      <SceneContent onSelectStar={onSelectStar} reduceMotion={reduceMotion} />
      <PostProcessing />
    </Canvas>
    </>
  );
}
