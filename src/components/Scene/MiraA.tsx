import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../../constants';

interface MiraAProps {
  position: [number, number, number];
  radius: number;
  hue: number;
  turbulence: number;
}

// Custom shader for Mira A (red giant with pulsating atmosphere)
const miraAShaderMaterial = {
  uniforms: {
    time: { value: 0 },
    color: { value: new THREE.Color(COLORS.STELLAR_ORANGE) },
    turbulence: { value: 0.3 },
    intensity: { value: 1.5 },
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
    uniform float turbulence;
    uniform float intensity;

    varying vec3 vNormal;
    varying vec3 vPosition;

    // Simple noise function for turbulence
    float noise(vec3 p) {
      return fract(sin(dot(p, vec3(12.9898, 78.233, 45.5432))) * 43758.5453);
    }

    void main() {
      // Fresnel effect for atmospheric glow
      float fresnel = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);

      // Pulsation effect
      float pulse = 0.9 + 0.1 * sin(time * 1.5);

      // Turbulence variation
      float turbNoise = noise(vPosition * turbulence * 10.0 + time * 0.5);

      // Combine effects
      vec3 finalColor = color * intensity * pulse;
      finalColor += fresnel * color * 0.5;
      finalColor *= (1.0 + turbNoise * turbulence * 0.2);

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
};

export default function MiraA({ position, radius, hue, turbulence }: MiraAProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Convert hue to color
  const color = useMemo(() => {
    const tempColor = new THREE.Color();
    tempColor.setHSL(hue / 360, 0.9, 0.5);
    return tempColor;
  }, [hue]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
      materialRef.current.uniforms.color.value = color;
      materialRef.current.uniforms.turbulence.value = turbulence;
    }

    // Subtle pulsation of the mesh
    if (meshRef.current) {
      const pulse = 1 + 0.05 * Math.sin(state.clock.elapsedTime * 1.5);
      meshRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={position}>
      {/* Core star mesh */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[radius, 64, 64]} />
        <shaderMaterial
          ref={materialRef}
          {...miraAShaderMaterial}
          transparent={false}
        />
      </mesh>

      {/* Atmospheric glow sphere */}
      <mesh scale={1.2}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Point light for illumination */}
      <pointLight
        color={color}
        intensity={50}
        distance={15}
        decay={2}
      />
    </group>
  );
}