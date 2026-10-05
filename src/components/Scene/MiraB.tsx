import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AccretionDisk_Shader, makeDiskUniforms } from '../../shaders/accretionDisk';
import { MIRA_B_CORONA, HIGHLIGHT_SHOULDER_GLSL } from '../../shaders/miraA';
import { COLORS } from '../../constants';
import type { OrbitPositions } from '../../types';
import GlowShell from './GlowShell';
import type { MutableRefObject } from 'react';
import { useReducedMotion } from 'framer-motion';
import { advanceTime, parkedFade } from '../../lib/captureMode';
import { materialFade } from '../../lib/entryReadiness';

interface MiraBProps {
  position: [number, number, number];
  radius: number;
  segments?: number;
  /** Live orbital positions, so the hot spot can sit where the stream actually lands. */
  positionsRef?: MutableRefObject<OrbitPositions>;
}

// Custom shader for Mira B - White Dwarf with intense core glow
const miraBShaderMaterial = {
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform vec3 color;
    uniform float intensity;
    uniform sampler2D uSurfaceMap;
    uniform float uSurfaceReady;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;

    // Mirrors highlightShoulder in src/lib/binaryLighting.ts: the white dwarf stays a hot
    // blue-white point instead of clipping into a flat white bead.
    ${HIGHLIGHT_SHOULDER_GLSL}

    void main() {
      // Strong Fresnel effect for intense edge glow
      float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 4.0);

      // Intense core brightness - white dwarf is extremely hot
      float coreBright = pow(1.0 - length(vPosition) * 2.0, 3.0);

      // Subtle rapid pulsation (white dwarfs can pulsate quickly)
      float pulse = 0.98 + 0.02 * sin(time * 4.0);

      // The companion's own density. The grayscale is mild — most texels sit near
      // mid-grey — so a small multiply after the shoulder vanishes into the hot
      // core and the bloom, and a zoomed-in star still reads as a flat white bead.
      // Stretch that body onto a swing centred at 1 and apply it before the
      // shoulder: dark grains fall out of the bloom, a mid texel leaves the hot
      // point alone. Weight zero is today's procedural photosphere, including a
      // late or missing map. The seam and the poles stay on that flat read so a
      // wrap line cannot ring the star.
      float seam = smoothstep(0.0, 0.06, vUv.x) * (1.0 - smoothstep(0.94, 1.0, vUv.x));
      seam *= smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.92, 1.0, vUv.y));
      float density = texture2D(uSurfaceMap, vUv).r;
      float opened = clamp((density - 0.50) / 0.17, -1.0, 1.0);
      float grain = 1.0 + opened * 0.46;
      float weight = seam * uSurfaceReady;

      // Combine effects. The core lamp eases off once the map is showing, or it
      // paints the middle white and the grains never surface.
      vec3 finalColor = color * intensity * pulse;
      finalColor += vec3(1.0, 1.0, 1.0) * coreBright * mix(0.35, 0.16, weight);
      finalColor += vec3(0.8, 0.9, 1.0) * fresnel * 0.3;

      // Slight blue tint for hot star
      finalColor = mix(finalColor, vec3(0.7, 0.85, 1.0), 0.15);
      finalColor *= mix(1.0, grain, weight);
      finalColor = highlightShoulder(finalColor);

      gl_FragColor = vec4(finalColor, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

// The disk plane is tilted towards the viewer rather than lying in the 30-degree-inclined
// orbital plane. Those are the same plane as far as the physics is concerned, but the explore
// camera sits within a few degrees of the orbital plane, where a coplanar disk is edge-on and
// collapses to a smear. A ninth of a pi keeps the ring an unmistakable ellipse from the
// angles the camera actually reaches.
const DISK_TILT = Math.PI / 9;
// Outer radius of the disk, in white dwarf radii. Far enough out that the arcs clear the
// star's own bloom — a disk you cannot see past the star is not a disk.
const DISK_SCALE = 4.8;
// The disk is a puff, not a mathematical plane: the camera's azimuth is unrestricted, and a
// flat band is exactly edge-on at two points of every revolution, where it degenerates into a
// one-pixel bar. About a sixth of the radius as vertical thickness means the worst case is still
// a lens with a readable height to it. Real disks flared like this are just as thin.
const DISK_THICKNESS = 0.16;

export default function MiraB({ position, radius, segments = 64, positionsRef }: MiraBProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const coronaRef = useRef<THREE.ShaderMaterial>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const diskMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const timeRef = useRef(0);
  // When the companion density bound. The frame loop ramps uSurfaceReady from the
  // stamp. Null keeps the procedural photosphere, and this map never joins the
  // entry gate — a late or missing companion texture must not hold the opening.
  const surfaceBoundAtRef = useRef<number | null>(null);
  const reduceMotion = Boolean(useReducedMotion());

  // White dwarf: hot blue-white (#e0e7ff per product direction)
  const color = useMemo(() => new THREE.Color(COLORS.MIRA_B_CORE), []);
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    color: { value: color.clone() },
    intensity: { value: 0.8 },
    uSurfaceMap: { value: null as THREE.Texture | null },
    uSurfaceReady: { value: 0 },
  }), [color]);

  useEffect(() => {
    let active = true;
    const material = materialRef.current;
    const texture = new THREE.TextureLoader().load(
      `${import.meta.env.BASE_URL}materials/companion-surface-density-v1.webp`,
      (loaded) => {
        if (!active || !material) return;
        loaded.colorSpace = THREE.NoColorSpace;
        // Stamp when the image is on the GPU, not when the file has decoded.
        // The fade (and a capture's parked 1) would otherwise multiply a texture
        // that has not uploaded yet, and two captures of one URL stop matching.
        loaded.onUpdate = () => {
          if (!active || surfaceBoundAtRef.current != null) return;
          surfaceBoundAtRef.current = performance.now();
        };
        material.uniforms.uSurfaceMap.value = loaded;
      },
      undefined,
      () => {
        if (!active) return;
        surfaceBoundAtRef.current = null;
      },
    );
    return () => {
      active = false;
      surfaceBoundAtRef.current = null;
      if (material) material.uniforms.uSurfaceReady.value = 0;
      texture.dispose();
    };
  }, []);

  const diskRadius = radius * DISK_SCALE;

  useFrame((_, delta) => {
    timeRef.current = advanceTime(timeRef.current, delta, { reduceMotion });
    const time = timeRef.current;

    if (materialRef.current) {
      materialRef.current.uniforms.time.value = time;
      materialRef.current.uniforms.color.value = color;
      // Stay on the procedural photosphere until the map has actually bound.
      // Capture parks the fade at 1, and an unbound sampler at that weight is not
      // a flat white dwarf: the stretch reads it as grain, so two captures of the
      // same URL stop matching.
      const boundAt = surfaceBoundAtRef.current;
      materialRef.current.uniforms.uSurfaceReady.value = boundAt == null
        ? 0
        : parkedFade(materialFade(boundAt, performance.now()));
    }

    if (coronaRef.current) {
      coronaRef.current.uniforms.uTime.value = time;
    }

    if (diskMaterialRef.current) {
      diskMaterialRef.current.uniforms.uTime.value = time;

      // Aim the hot spot at Mira A. The stream arrives from that direction; the disk only ever
      // carries a rotation about X, so the world-space A→B vector rotates into the disk's own
      // tilted plane by hand: local X is world X, and local Z is the plane's second basis
      // vector (0, -sin t, cos t).
      const live = positionsRef?.current;
      if (live) {
        const wx = live.primary[0] - live.secondary[0];
        const wy = live.primary[1] - live.secondary[1];
        const wz = live.primary[2] - live.secondary[2];
        const localZ = -wy * Math.sin(DISK_TILT) + wz * Math.cos(DISK_TILT);
        diskMaterialRef.current.uniforms.uImpactAngle.value = Math.atan2(localZ, wx);
      }
    }

    // Subtle rotation
    if (meshRef.current) {
      meshRef.current.rotation.y = time * 0.05;
      const pulse = 1 + 0.015 * Math.sin(time * 4.0);
      meshRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={position}>
      {/* Core white dwarf with shader */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[radius, segments, segments]} />
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={miraBShaderMaterial.vertexShader}
          fragmentShader={miraBShaderMaterial.fragmentShader}
        />
      </mesh>

      {/* Tight corona — a broad halo would bury the accretion disk. */}
      <GlowShell
        materialRef={coronaRef}
        shellRadius={radius * MIRA_B_CORONA.scale}
        coreRadius={radius}
        color={MIRA_B_CORONA.color}
        opacity={MIRA_B_CORONA.opacity}
        falloff={MIRA_B_CORONA.falloff}
        pulseAmp={MIRA_B_CORONA.pulseAmp}
      />

      {/* Point light - white dwarfs are bright but small */}
      <pointLight
        color={color}
        intensity={30}
        distance={12}
        decay={2}
      />

      {/* Accretion disk: a unit sphere flattened into the disk's shape, so the shader can work
          in normalised radius and the mesh scale is the disk's outer radius and half-thickness. */}
      <mesh rotation-x={DISK_TILT} scale={[diskRadius, diskRadius * DISK_THICKNESS, diskRadius]}>
        <sphereGeometry args={[1, 96, 24]} />
        <shaderMaterial
          ref={diskMaterialRef}
          vertexShader={AccretionDisk_Shader.vertexShader}
          fragmentShader={AccretionDisk_Shader.fragmentShader}
          uniforms={makeDiskUniforms()}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
