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

  // Convert hue to color - deep red giant tones
  const colors = useMemo(() => {
    const baseColor = new THREE.Color();
    baseColor.setHSL(hue / 360, 0.85, 0.35); // Darker luminosity

    // Core is slightly hotter/brighter, surface is cooler/darker
    const colorCore = baseColor.clone().offsetHSL(0.03, 0.1, 0.05);
    const colorSurface = baseColor.clone().offsetHSL(-0.02, 0.05, -0.08);

    return { colorCore, colorSurface, atmosphere: baseColor.clone().offsetHSL(0.02, 0, 0.15) };
  }, [hue]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = time;
      materialRef.current.uniforms.uTurbulence.value = turbulence;
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
          opacity={0.04 + turbulence * 0.03}
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
