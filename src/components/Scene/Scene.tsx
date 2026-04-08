import { useRef } from 'react';
import React from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars as DreiStars, OrbitControls as DreiOrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useBinaryStar, useParameters, useMobile } from '../../hooks';
import { COLORS, PHYSICS, calculateOrbitalPosition } from '../../constants';
import * as THREE from 'three';
import MiraA from './MiraA';
import MiraB from './MiraB';
import OrbitRing from './OrbitRing';
import MaterialStream from './MaterialStream';

// Level of Detail settings based on device
const LOD = {
  mobile: {
    starCount: 1500,
    sphereSegments: 32,
    bloomLevels: 2,
  },
  desktop: {
    starCount: 5000,
    sphereSegments: 64,
    bloomLevels: 4,
  },
};

function SceneContent() {
  const parameters = useParameters();
  const mode = useBinaryStar((state) => state.mode);
  const isMobile = useMobile();
  const timeRef = useRef(0);
  const orbitControlsRef = useRef<React.ElementRef<typeof DreiOrbitControls>>(null);
  const introStartTimeRef = useRef(Date.now());
  const primaryGroupRef = useRef<THREE.Group>(null);
  const secondaryGroupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  const lod = isMobile ? LOD.mobile : LOD.desktop;

  const positionsRef = useRef({
    primary: [0, 0, 0] as [number, number, number],
    secondary: [0, 0, 0] as [number, number, number],
  });

  // Camera choreography: 2.5s orchestrated intro
  useFrame(() => {
    const elapsed = (Date.now() - introStartTimeRef.current) / 1000;

    if (elapsed < 2.5) {
      if (orbitControlsRef.current) {
        orbitControlsRef.current.enabled = false;
      }

      if (elapsed < 1.0) {
        const t = elapsed;
        camera.position.lerpVectors(
          new THREE.Vector3(15, 5, 20),
          new THREE.Vector3(10, 3, 14),
          t
        );
        camera.lookAt(0, 0, 0);
      } else {
        const t = (elapsed - 1.0) / 1.5;
        camera.position.lerpVectors(
          new THREE.Vector3(10, 3, 14),
          new THREE.Vector3(8, 2, 12),
          t
        );
        camera.lookAt(0, 0, 0);
      }
    } else if (orbitControlsRef.current && !orbitControlsRef.current.enabled) {
      orbitControlsRef.current.enabled = true;
    }
  });

  useFrame((_, delta) => {
    timeRef.current += delta * parameters.orbitSpeed;
    const newPositions = calculateOrbitalPosition(timeRef.current, PHYSICS.ORBIT);
    positionsRef.current = {
      primary: newPositions.primary,
      secondary: newPositions.secondary,
    };
    primaryGroupRef.current?.position.set(...newPositions.primary);
    secondaryGroupRef.current?.position.set(...newPositions.secondary);
  });

  return (
    <>
      <DreiStars
        radius={100}
        depth={50}
        count={lod.starCount}
        factor={4}
        saturation={0}
        fade
        speed={0.5}
      />

      <group ref={primaryGroupRef}>
        <MiraA
          position={[0, 0, 0]}
          radius={PHYSICS.MIRA_A.radius}
          hue={parameters.primaryColor}
          turbulence={parameters.turbulence}
          segments={lod.sphereSegments}
        />
      </group>

      <group ref={secondaryGroupRef}>
        <MiraB
          position={[0, 0, 0]}
          radius={PHYSICS.MIRA_B.radius}
          hue={parameters.secondaryColor}
          segments={lod.sphereSegments}
        />
      </group>

      <OrbitRing
        semiMajorAxis={PHYSICS.ORBIT.semiMajorAxis}
        eccentricity={PHYSICS.ORBIT.eccentricity}
        inclination={PHYSICS.ORBIT.inclination}
        mode={mode}
      />

      {mode === 'particles' && (
        <MaterialStream
          positionsRef={positionsRef}
          particleCount={parameters.particleDensity}
          turbulence={parameters.turbulence}
        />
      )}

      <DreiOrbitControls
        ref={orbitControlsRef}
        enablePan={false}
        minDistance={5}
        maxDistance={20}
        autoRotate
        autoRotateSpeed={0.5}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  );
}

function PostProcessing() {
  const parameters = useParameters();
  const isMobile = useMobile();
  const lod = isMobile ? LOD.mobile : LOD.desktop;

  return (
    <EffectComposer enableNormalPass={false}>
      <Bloom
        luminanceThreshold={0.25}
        mipmapBlur
        intensity={parameters.bloomIntensity}
        radius={0.4}
        levels={lod.bloomLevels}
      />
    </EffectComposer>
  );
}

export default function Scene() {
  const setIntroComplete = useBinaryStar((state) => state.setIntroComplete);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIntroComplete(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [setIntroComplete]);

  return (
    <Canvas
      camera={{
        position: [8, 2, 12],
        fov: 35,
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
      <color attach="background" args={[COLORS.DEEP_SPACE]} />
      <fog attach="fog" args={[COLORS.DEEP_SPACE, 10, 30]} />

      <SceneContent />
      <PostProcessing />
    </Canvas>
  );
}
