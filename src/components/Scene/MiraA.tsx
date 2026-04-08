import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MiraA_Shader, Atmosphere_Shader } from '../../shaders/miraA';

interface MiraAProps {
  position: [number, number, number];
  radius: number;
  hue: number;
  turbulence: number;
  segments?: number;
}

export default function MiraA({ position, radius, hue, turbulence, segments = 64 }: MiraAProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const atmosphereRef = useRef<THREE.ShaderMaterial>(null);

  // Convert hue to color
  const colors = useMemo(() => {
    const baseColor = new THREE.Color();
    baseColor.setHSL(hue / 360, 0.9, 0.5);

    // Core is hotter/brighter, surface is cooler/darker
    const colorCore = baseColor.clone().offsetHSL(0.05, 0.1, 0.1);
    const colorSurface = baseColor.clone().offsetHSL(-0.02, 0.05, -0.1);

    return { colorCore, colorSurface, atmosphere: baseColor.clone().offsetHSL(0.02, 0, 0.2) };
  }, [hue]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = time;
      materialRef.current.uniforms.uColorCore.value = colors.colorCore;
      materialRef.current.uniforms.uColorSurface.value = colors.colorSurface;
      materialRef.current.uniforms.uTurbulence.value = turbulence;
    }

    if (atmosphereRef.current) {
      atmosphereRef.current.uniforms.uColor.value = colors.atmosphere;
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
          {...MiraA_Shader}
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
        />
      </mesh>

      {/* Outer glow sphere */}
      <mesh scale={1.3}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={colors.atmosphere}
          transparent
          opacity={0.08 + turbulence * 0.05}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Point light for scene illumination */}
      <pointLight
        color={colors.colorCore}
        intensity={80 + turbulence * 30}
        distance={20}
        decay={2}
      />
    </group>
  );
}
