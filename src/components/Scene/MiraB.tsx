import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AccretionDisk_Shader } from '../../shaders/accretionDisk';

interface MiraBProps {
  position: [number, number, number];
  radius: number;
  segments?: number;
}

// Custom shader for Mira B - White Dwarf with intense core glow
const miraBShaderMaterial = {
  uniforms: {
    time: { value: 0 },
    color: { value: new THREE.Color('#e0e7ff') },
    intensity: { value: 2.5 },
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
      finalColor += vec3(1.0, 1.0, 1.0) * coreBright * 0.5;
      finalColor += vec3(0.8, 0.9, 1.0) * fresnel * 0.4;

      // Slight blue tint for hot star
      finalColor = mix(finalColor, vec3(0.7, 0.85, 1.0), 0.15);

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
};

export default function MiraB({ position, radius, segments = 64 }: MiraBProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const diskMaterialRef = useRef<THREE.ShaderMaterial>(null);

  // White dwarf: hot blue-white (#e0e7ff per product direction)
  const color = useMemo(() => new THREE.Color('#e0e7ff'), []);

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    if (materialRef.current) {
      materialRef.current.uniforms.time.value = time;
      materialRef.current.uniforms.color.value = color;
    }

    if (diskMaterialRef.current) {
      diskMaterialRef.current.uniforms.uTime.value = time;
      diskMaterialRef.current.uniforms.uColor.value = color;
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

      {/* Inner bright corona */}
      <mesh scale={1.3}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Outer glow */}
      <mesh scale={1.8}>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.05}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Point light - white dwarfs are bright but small */}
      <pointLight
        color={color}
        intensity={30}
        distance={12}
        decay={2}
      />

      {/* Accretion disk */}
      <mesh rotation-x={Math.PI / 2.5} scale={2.5}>
        <circleGeometry args={[radius, 64]} />
        <shaderMaterial
          ref={diskMaterialRef}
          {...AccretionDisk_Shader}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
