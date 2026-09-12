import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MiraA_Shader, Atmosphere_Shader } from '../../shaders/miraA';
import { useBinaryStar } from '../../hooks';

interface MiraAProps {
  position: [number, number, number];
  radius: number;
  turbulence: number;
  segments?: number;
}

export default function MiraA({ position, radius, turbulence, segments = 64 }: MiraAProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const atmosphereRef = useRef<THREE.ShaderMaterial>(null);

  // Where the real clock has Mira A in its ~332 day pulsation cycle: how bright it is, and
  // how far its colour has already shifted toward its hottest.
  const brightness = useBinaryStar((state) => state.sky.brightness);
  const colorShift = useBinaryStar((state) => state.sky.colorShift);

  // Convert hue to color — deep red giant tones
  // Product direction: core #ff3d00, surface #ff8a50
  const colors = useMemo(() => {
    const colorCore = new THREE.Color('#ff3d00');
    const colorSurface = new THREE.Color('#ff8a50');
    const atmosphere = new THREE.Color('#331100');

    return { colorCore, colorSurface, atmosphere };
  }, []);

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = time;
      materialRef.current.uniforms.uTurbulence.value = turbulence;
      // Pass computed colors to shader (overrides hardcoded defaults)
      materialRef.current.uniforms.uColorCore.value = colors.colorCore;
      materialRef.current.uniforms.uColorSurface.value = colors.colorSurface;
      materialRef.current.uniforms.uBrightness.value = brightness;
      materialRef.current.uniforms.uColorShift.value = colorShift;
    }

    if (atmosphereRef.current) {
      atmosphereRef.current.uniforms.uBrightness.value = brightness;
    }

    // Subtle rotation for surface animation
    if (meshRef.current) {
      meshRef.current.rotation.y = time * 0.02;
      meshRef.current.rotation.z = time * 0.01;
    }
  });

  return (
    <group position={position}>
      {/* Core star mesh with custom shader */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[radius, segments, segments]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={MiraA_Shader.vertexShader}
          fragmentShader={MiraA_Shader.fragmentShader}
          uniforms={MiraA_Shader.uniforms}
        />
      </mesh>

      {/* Atmospheric halo */}
      <mesh scale={1.15}>
        <sphereGeometry args={[radius, Math.max(32, Math.floor(segments * 0.75)), Math.max(32, Math.floor(segments * 0.75))]} />
        <shaderMaterial
          ref={atmosphereRef}
          {...Atmosphere_Shader}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          transparent={true}
          depthWrite={false}
          opacity={0.5}
        />
      </mesh>

      {/* Outer glow sphere */}
      <mesh scale={1.3}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={colors.atmosphere}
          transparent
          opacity={(0.04 + turbulence * 0.03) * (0.5 + brightness)}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Point light for scene illumination */}
      <pointLight
        color={colors.colorCore}
        intensity={10 + turbulence * 5}
        distance={15}
        decay={2}
      />
    </group>
  );
}
