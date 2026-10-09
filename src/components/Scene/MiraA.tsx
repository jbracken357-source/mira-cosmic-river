import { useRef, useMemo, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MiraA_Shader } from '../../shaders/miraA';
import { MIRA_A_ATMOSPHERE, MIRA_A_PULSE_AMPLITUDE } from '../../lib/binaryLighting';
import { COLORS } from '../../constants';
import { useBinaryStar, useEntryReadiness } from '../../hooks';
import { advanceTime, parkedFade } from '../../lib/captureMode';
import { materialFade } from '../../lib/entryReadiness';
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
  const timeRef = useRef(0);
  // When the surface map bound, for the arrival fade (#62). Null until then; the
  // frame loop ramps uSurfaceReady from the stamp.
  const surfaceBoundAtRef = useRef<number | null>(null);
  const reduceMotion = Boolean(useReducedMotion());
  const uniforms = useMemo(() => THREE.UniformsUtils.clone(MiraA_Shader.uniforms), []);

  useEffect(() => {
    let active = true;
    const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}materials/surface-density-v2.webp`, loaded => {
      if (!active || !materialRef.current) return;
      loaded.colorSpace = THREE.NoColorSpace;
      materialRef.current.uniforms.uSurfaceMap.value = loaded;
      // The arrival fade (#62): stamp the bind; the frame loop ramps uSurfaceReady.
      surfaceBoundAtRef.current = performance.now();
      useEntryReadiness.getState().noteMaterial('surface', 'ready');
    }, undefined, () => {
      // Procedural convection remains visible without the map — the live
      // instance reports it so the entry gate can start on the fallback path.
      if (!active) return;
      useEntryReadiness.getState().noteMaterial('surface', 'failed');
    });
    return () => {
      active = false;
      surfaceBoundAtRef.current = null;
      texture.dispose();
    };
  }, []);

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

  useFrame((_, delta) => {
    // Capture mode parks the phase at CAPTURE_TIME; the same value also freezes the
    // surface rotation below. A manual pause holds the phase where it is.
    timeRef.current = advanceTime(timeRef.current, delta, { reduceMotion });
    const time = timeRef.current;

    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = time;
      materialRef.current.uniforms.uTurbulence.value = turbulence;
      // Pass computed colors to shader (overrides hardcoded defaults)
      materialRef.current.uniforms.uColorCore.value = colors.colorCore;
      materialRef.current.uniforms.uColorSurface.value = colors.colorSurface;
      materialRef.current.uniforms.uBrightness.value = brightness;
      materialRef.current.uniforms.uColorShift.value = colorShift;
      // Rises to exactly 1 over ENTRY_FADE_MS once the map binds (#62); capture mode
      // parks the fade at its endpoint — the registered policy lives in captureMode.
      materialRef.current.uniforms.uSurfaceReady.value = parkedFade(
        materialFade(surfaceBoundAtRef.current, performance.now()),
      );
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
        <sphereGeometry args={[radius, Math.max(24, segments), Math.max(24, segments)]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={MiraA_Shader.vertexShader}
          fragmentShader={MiraA_Shader.fragmentShader}
          uniforms={uniforms}
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
