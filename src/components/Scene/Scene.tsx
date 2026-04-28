import { useRef, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls as DreiOrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useBinaryStar, useMobile } from '../../hooks';
import { COLORS, PHYSICS, calculateOrbitalPosition, CINEMATIC, CAMERA } from '../../constants';
import * as THREE from 'three';
import type { StarName } from '../UI/InfoCards';
import MiraA from './MiraA';
import MiraB from './MiraB';
import MiraTail from './MiraTail';
import OrbitRing from './OrbitRing';
import MaterialStream from './MaterialStream';
import StarField from './StarField';

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
  },
  desktop: {
    starCount: 5000,
    sphereSegments: 64,
    bloomLevels: 4,
    tailParticles: 10000,
  },
};

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function SceneContent({ onSelectStar }: { onSelectStar: (star: StarName | null) => void }) {
  const timeSpeed = useBinaryStar((state) => state.parameters.timeSpeed);
  const cinematicPhase = useBinaryStar((state) => state.cinematicPhase);
  const setCinematicPhase = useBinaryStar((state) => state.setCinematicPhase);
  const setCinematicTime = useBinaryStar((state) => state.setCinematicTime);
  const setIntroComplete = useBinaryStar((state) => state.setIntroComplete);
  const isMobile = useMobile();
  const lod = isMobile ? LOD.mobile : LOD.desktop;

  const timeRef = useRef(0);
  const cinematicStartRef = useRef(Date.now());
  const orbitControlsRef = useRef<React.ElementRef<typeof DreiOrbitControls>>(null);
  const { camera } = useThree() as { camera: THREE.PerspectiveCamera };

  const positionsRef = useRef({
    primary: [0, 0, 0] as [number, number, number],
    secondary: [0, 0, 0] as [number, number, number],
  });

  // Background click to deselect

  // Main loop: cinematic + orbital animation
  useFrame((_, delta) => {
    const elapsed = (Date.now() - cinematicStartRef.current) / 1000;
    const t = elapsed / timeSpeed;

    // Track cinematic time
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
      if (t >= CINEMATIC.EXPLORE_MODE) {
        setCinematicPhase('explore');
        setIntroComplete(true);
      }
    }

    // Camera animation during cinematic
    if (t < CINEMATIC.EXPLORE_MODE) {
      if (orbitControlsRef.current) {
        orbitControlsRef.current.enabled = false;
      }

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
      camera.fov = camFov;
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
    } else {
      if (orbitControlsRef.current && !orbitControlsRef.current.enabled) {
        orbitControlsRef.current.enabled = true;
      }
    }

    // Orbital mechanics (always running)
    timeRef.current += delta * timeSpeed;
    const newPositions = calculateOrbitalPosition(timeRef.current, PHYSICS.ORBIT);
    positionsRef.current = {
      primary: newPositions.primary,
      secondary: newPositions.secondary,
    };
  });

  // Tail opacity
  const tailOpacity = useTailOpacity();

  // Invisible clickable planes for stars (raycasting targets)
  return (
    <>
      {/* Custom twinkling star field */}
      <StarField count={lod.starCount} />

      {/* Mira A - Red Giant */}
      <group ref={(g) => { if (g) g.userData.starName = 'miraA'; }}>
        <MiraA
          position={[0, 0, 0]}
          radius={PHYSICS.MIRA_A.radius}
          hue={30}
          turbulence={0.3}
          segments={lod.sphereSegments}
        />
        {/* Invisible click target */}
        <mesh
          userData={{ starName: 'miraA' }}
          onClick={(e) => {
            e.stopPropagation();
            if (cinematicPhase === 'explore') onSelectStar('miraA');
          }}
        >
          <sphereGeometry args={[PHYSICS.MIRA_A.radius * 1.2, 16, 16]} />
          <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Mira B - White Dwarf */}
      <MiraB
        position={positionsRef.current.secondary}
        radius={PHYSICS.MIRA_B.radius}
        hue={270}
        segments={lod.sphereSegments}
      />
      {/* Invisible click target for Mira B */}
      <mesh
        position={positionsRef.current.secondary}
        userData={{ starName: 'miraB' }}
        onClick={(e) => {
          e.stopPropagation();
          if (cinematicPhase === 'explore') onSelectStar('miraB');
        }}
      >
        <sphereGeometry args={[PHYSICS.MIRA_B.radius * 2, 16, 16]} />
        <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Orbit ring */}
      <OrbitRing
        semiMajorAxis={PHYSICS.ORBIT.semiMajorAxis}
        eccentricity={PHYSICS.ORBIT.eccentricity}
        inclination={PHYSICS.ORBIT.inclination}
      />

      {/* Always-visible material stream */}
      <MaterialStream
        positionsRef={positionsRef}
        particleCount={PHYSICS.STREAM.particleCount}
        turbulence={0.3}
      />

      {/* The Tail — hero feature */}
      <MiraTail
        opacity={tailOpacity}
        particleCount={lod.tailParticles}
        tailLength={PHYSICS.TAIL.length}
      />

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

      {/* Orbit controls (disabled during cinematic) */}
      <DreiOrbitControls
        ref={orbitControlsRef}
        enablePan={false}
        minDistance={5}
        maxDistance={40}
        autoRotate
        autoRotateSpeed={0.3}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  );
}

// Hook to compute tail opacity from cinematic time
function useTailOpacity(): number {
  const cinematicTime = useBinaryStar((state) => state.cinematicTime);
  const cinematicPhase = useBinaryStar((state) => state.cinematicPhase);

  if (cinematicPhase === 'dark' || cinematicPhase === 'stars-appear') return 0;
  if (cinematicPhase === 'pull-back' && cinematicTime < CINEMATIC.TAIL_REVEAL_START) {
    const t = clamp01((cinematicTime - CINEMATIC.PULL_BACK_START) / (CINEMATIC.TAIL_REVEAL_START - CINEMATIC.PULL_BACK_START));
    return t * 0.15;
  }
  if (cinematicPhase === 'pull-back' || cinematicPhase === 'tail-reveal') {
    const t = clamp01((cinematicTime - CINEMATIC.TAIL_REVEAL_START) / (CINEMATIC.TAIL_FULL - CINEMATIC.TAIL_REVEAL_START));
    return easeInOutCubic(t) * 0.85;
  }
  return 0.85;
}

function PostProcessing() {
  const isMobile = useMobile();
  const lod = isMobile ? LOD.mobile : LOD.desktop;

  return (
    <EffectComposer enableNormalPass={false}>
      <Bloom
        luminanceThreshold={0.9}
        mipmapBlur
        intensity={0.5}
        radius={0.5}
        levels={lod.bloomLevels}
      />
    </EffectComposer>
  );
}

export default function Scene({ onSelectStar }: SceneProps) {
  return (
    <Canvas
      camera={{
        position: CAMERA.CLOSE.position,
        fov: CAMERA.CLOSE.fov,
      }}
      gl={{
        antialias: true,
        alpha: false,
        stencil: false,
        depth: true,
      }}
      dpr={[1, 1.5]}
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

      <SceneContent onSelectStar={onSelectStar} />
      <PostProcessing />
    </Canvas>
  );
}
