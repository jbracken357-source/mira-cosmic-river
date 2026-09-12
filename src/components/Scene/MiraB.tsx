import { useRef, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AccretionDisk_Shader, makeDiskUniforms } from '../../shaders/accretionDisk';
import {
  Atmosphere_Shader,
  MIRA_B_CORONA,
  makeAtmosphereUniforms,
} from '../../shaders/miraA';

type OrbitPositionsRef = MutableRefObject<{
  primary: [number, number, number];
  secondary: [number, number, number];
}>;

interface MiraBProps {
  position: [number, number, number];
  radius: number;
  segments?: number;
  /** Live orbital positions, so the hot spot can sit where the stream actually lands. */
  positionsRef?: OrbitPositionsRef;
}

// Custom shader for Mira B - White Dwarf with intense core glow
const miraBShaderMaterial = {
  uniforms: {
    time: { value: 0 },
    color: { value: new THREE.Color('#e0e7ff') },
    intensity: { value: 1.7 },
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
    }
  `,
};

// The disk plane is tilted towards the viewer rather than lying in the 30-degree-inclined
// orbital plane. Those are the same plane as far as the physics is concerned, but the explore
// camera sits within a few degrees of the orbital plane, where a coplanar disk is edge-on and
// collapses to a smear. A third of a radian keeps the ring an unmistakable ellipse from every
// angle the camera actually reaches.
const DISK_TILT = Math.PI / 9;
// Outer radius of the disk, in white dwarf radii. Far enough out that the ring clears the
// star's own bloom — a disk you cannot see past the star is not a disk.
const DISK_SCALE = 5.5;

export default function MiraB({ position, radius, segments = 64, positionsRef }: MiraBProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const coronaRef = useRef<THREE.ShaderMaterial>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const diskMaterialRef = useRef<THREE.ShaderMaterial>(null);

  // White dwarf: hot blue-white (#e0e7ff per product direction)
  const color = useMemo(() => new THREE.Color('#e0e7ff'), []);

  const diskScale = radius * DISK_SCALE;

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    if (materialRef.current) {
      materialRef.current.uniforms.time.value = time;
      materialRef.current.uniforms.color.value = color;
    }

    if (coronaRef.current) {
      coronaRef.current.uniforms.uTime.value = time;
    }

    if (diskMaterialRef.current) {
      diskMaterialRef.current.uniforms.uTime.value = time;

      // Aim the hot spot at Mira A. The stream arrives from that direction, and because the
      // model matrix only ever carries a translation this is a rotation of the world-space
      // A→B vector into the disk's own tilted plane.
      const live = positionsRef?.current;
      if (live) {
        const wx = live.primary[0] - live.secondary[0];
        const wy = live.primary[1] - live.secondary[1];
        const wz = live.primary[2] - live.secondary[2];
        const localY = wy * Math.cos(DISK_TILT) + wz * Math.sin(DISK_TILT);
        diskMaterialRef.current.uniforms.uImpactAngle.value = Math.atan2(localY, wx);
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

      {/* Corona: one soft shell instead of stacked flat discs — a white dwarf is a hot point
          with a tight halo, not a grey plate. */}
      <mesh scale={MIRA_B_CORONA.scale}>
        <sphereGeometry args={[radius, 32, 24]} />
        <shaderMaterial
          ref={coronaRef}
          vertexShader={Atmosphere_Shader.vertexShader}
          fragmentShader={Atmosphere_Shader.fragmentShader}
          uniforms={makeAtmosphereUniforms({
            color: MIRA_B_CORONA.color,
            shellRadius: radius * MIRA_B_CORONA.scale,
            coreRadius: radius,
            opacity: MIRA_B_CORONA.opacity,
            falloff: MIRA_B_CORONA.falloff,
            pulseAmp: MIRA_B_CORONA.pulseAmp,
          })}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          transparent={true}
          depthWrite={false}
        />
      </mesh>

      {/* Point light - white dwarfs are bright but small */}
      <pointLight
        color={color}
        intensity={30}
        distance={12}
        decay={2}
      />

      {/* Accretion disk. Unit geometry: the shader works in normalised radius and the scale
          here is the disk's outer radius. */}
      <mesh rotation-x={DISK_TILT} scale={diskScale}>
        <circleGeometry args={[1, 96]} />
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
