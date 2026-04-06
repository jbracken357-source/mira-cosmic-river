import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars as DreiStars, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useBinaryStar, useParameters } from '../../hooks';
import { COLORS, PHYSICS, calculateOrbitalPosition } from '../../constants';
import MiraA from './MiraA';
import MiraB from './MiraB';
import OrbitRing from './OrbitRing';
import MaterialStream from './MaterialStream';

function SceneContent() {
  const parameters = useParameters();
  const mode = useBinaryStar((state) => state.mode);
  const timeRef = useRef(0);

  // Use state for positions that need to update
  const [positions, setPositions] = useState(() =>
    calculateOrbitalPosition(0, PHYSICS.ORBIT)
  );

  // Update positions on animation frame
  useFrame((_, delta) => {
    timeRef.current += delta * parameters.orbitSpeed;
    const newPositions = calculateOrbitalPosition(timeRef.current, PHYSICS.ORBIT);
    setPositions(newPositions);
  });

  return (
    <>
      {/* Background stars - distant starfield */}
      <DreiStars
        radius={100}
        depth={50}
        count={5000}
        factor={4}
        saturation={0}
        fade
        speed={0.5}
      />

      {/* Mira A - the primary red giant */}
      <MiraA
        position={positions.primary}
        radius={PHYSICS.MIRA_A.radius}
        hue={parameters.primaryColor}
        turbulence={parameters.turbulence}
      />

      {/* Mira B - the white dwarf companion */}
      <MiraB
        position={positions.secondary}
        radius={PHYSICS.MIRA_B.radius}
        hue={parameters.secondaryColor}
      />

      {/* Orbital path visualization */}
      <OrbitRing
        semiMajorAxis={PHYSICS.ORBIT.semiMajorAxis}
        eccentricity={PHYSICS.ORBIT.eccentricity}
        inclination={PHYSICS.ORBIT.inclination}
        mode={mode}
      />

      {/* Material stream between stars */}
      {mode === 'particles' && (
        <MaterialStream
          from={positions.primary}
          to={positions.secondary}
          particleCount={parameters.particleDensity}
          turbulence={parameters.turbulence}
        />
      )}

      {/* Camera controls */}
      <OrbitControls
        enablePan={false}
        minDistance={5}
        maxDistance={20}
        autoRotate
        autoRotateSpeed={0.2}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  );
}

function PostProcessing() {
  const parameters = useParameters();

  return (
    <EffectComposer>
      <Bloom
        intensity={parameters.bloomIntensity}
        luminanceThreshold={0.1}
        luminanceSmoothing={0.9}
        mipmapBlur
      />
    </EffectComposer>
  );
}

export default function Scene() {
  const introComplete = useBinaryStar((state) => state.introComplete);

  return (
    <Canvas
      camera={{
        position: [0, 3, 12],
        fov: 50,
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: COLORS.DEEP_SPACE,
        opacity: introComplete ? 1 : 0,
        transition: 'opacity 800ms ease-out',
      }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      }}
    >
      <color attach="background" args={[COLORS.DEEP_SPACE]} />
      <fog attach="fog" args={[COLORS.DEEP_SPACE, 10, 30]} />

      <SceneContent />
      <PostProcessing />
    </Canvas>
  );
}