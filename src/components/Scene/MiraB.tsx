import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AccretionDisk_Shader, makeDiskUniforms } from '../../shaders/accretionDisk';
import { MIRA_B_CORONA } from '../../shaders/miraA';
import { COLORS } from '../../constants';
import type { OrbitPositions } from '../../types';
import GlowShell from './GlowShell';
import type { MutableRefObject } from 'react';
import { useReducedMotion } from 'framer-motion';
import { CAPTURE_TIME, captureMode } from '../../lib/captureMode';

interface MiraBProps {
  position: [number, number, number];
  radius: number;
  segments?: number;
  /** Live orbital positions, so the hot spot can sit where the stream actually lands. */
  positionsRef?: MutableRefObject<OrbitPositions>;
}

// Custom shader for Mira B - White Dwarf with intense core glow
const miraBShaderMaterial = {
  uniforms: {
    time: { value: 0 },
    color: { value: new THREE.Color(COLORS.MIRA_B_CORE) },
    intensity: { value: 0.85 },
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform vec3 color;
    uniform float intensity;

    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      // Strong Fresnel effect for intense edge glow
      float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 4.0);

      // Intense core brightness - white dwarf is extremely hot
      float coreBright = pow(1.0 - length(vPosition) * 2.0, 3.0);

      // Subtle rapid pulsation (white dwarfs can pulsate quickly)
      float pulse = 0.98 + 0.02 * sin(time * 4.0);

      // Combine effects
      vec3 finalColor = color * intensity * pulse;
      finalColor += vec3(1.0, 1.0, 1.0) * coreBright * 0.35;
      finalColor += vec3(0.8, 0.9, 1.0) * fresnel * 0.3;

      // Slight blue tint for hot star
      finalColor = mix(finalColor, vec3(0.7, 0.85, 1.0), 0.15);

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
  const reduceMotion = Boolean(useReducedMotion());
  const capture = captureMode();

  // White dwarf: hot blue-white (#e0e7ff per product direction)
  const color = useMemo(() => new THREE.Color(COLORS.MIRA_B_CORE), []);

  const diskRadius = radius * DISK_SCALE;

  useFrame((_, delta) => {
    if (capture.active) timeRef.current = CAPTURE_TIME;
    else if (!reduceMotion && !document.hidden) timeRef.current += Math.min(delta, .05);
    const time = timeRef.current;

    if (materialRef.current) {
      materialRef.current.uniforms.time.value = time;
      materialRef.current.uniforms.color.value = color;
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
          {...miraBShaderMaterial}
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
