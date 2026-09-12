import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  MiraA_Shader,
  MIRA_A_ATMOSPHERE,
  MIRA_A_PULSE_AMPLITUDE,
} from '../../shaders/miraA';
import { COLORS } from '../../constants';
import { useBinaryStar } from '../../hooks';
import GlowShell from './GlowShell';

interface MiraAProps {
  position: [number, number, number];
  radius: number;
  turbulence: number;
  segments?: number;
}

export default function MiraA({ position, radius, turbulence, segments = 64 }: MiraAProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const innerAtmosphereRef = useRef<THREE.ShaderMaterial>(null);
  const outerAtmosphereRef = useRef<THREE.ShaderMaterial>(null);

  // Where the real clock has Mira A in its ~332 day pulsation cycle: how bright it is, and
  // how far its colour has already shifted toward its hottest.
  const brightness = useBinaryStar((state) => state.sky.brightness);
  const colorShift = useBinaryStar((state) => state.sky.colorShift);

  // Deep red giant tones, per the palette: core #ff3d00, surface #ff8a50.
  const colors = useMemo(() => {
    const colorCore = new THREE.Color(COLORS.MIRA_A_CORE);
    const colorSurface = new THREE.Color(COLORS.MIRA_A_SURFACE);

    return { colorCore, colorSurface };
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

    for (const ref of [innerAtmosphereRef, outerAtmosphereRef]) {
      if (ref.current) {
        ref.current.uniforms.uTime.value = time;
        ref.current.uniforms.uBrightness.value = brightness;
      }
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

      {/* Atmosphere, as two shells a viewer reads as one volume: a dense layer hugging the
          photosphere and a wide thin haze that gives the star its reach on screen. Both breathe
          with the star's own radius pulse, so the halo never detaches from the limb. */}
      <GlowShell
        materialRef={innerAtmosphereRef}
        shellRadius={radius * MIRA_A_ATMOSPHERE.mid.scale}
        coreRadius={radius}
        color={MIRA_A_ATMOSPHERE.mid.color}
        opacity={MIRA_A_ATMOSPHERE.mid.opacity}
        falloff={MIRA_A_ATMOSPHERE.mid.falloff}
        pulseAmp={MIRA_A_PULSE_AMPLITUDE}
      />
      <GlowShell
        materialRef={outerAtmosphereRef}
        shellRadius={radius * MIRA_A_ATMOSPHERE.outer.scale}
        coreRadius={radius}
        color={MIRA_A_ATMOSPHERE.outer.color}
        opacity={MIRA_A_ATMOSPHERE.outer.opacity}
        falloff={MIRA_A_ATMOSPHERE.outer.falloff}
        pulseAmp={MIRA_A_PULSE_AMPLITUDE}
      />

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
