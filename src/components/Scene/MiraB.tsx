import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../../constants';

interface MiraBProps {
  position: [number, number, number];
  radius: number;
  hue: number;
}

// Custom shader for Mira B (white dwarf with bright core)
const miraBShaderMaterial = {
  uniforms: {
    time: { value: 0 },
    color: { value: new THREE.Color(COLORS.WHITE_DWARF_BLUE) },
    intensity: { value: 2.0 },
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
      // Fresnel effect for edge glow
      float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);

      // Core brightness
      float core = pow(1.0 - length(vPosition) / 0.3, 2.0);

      // Fast pulsation
      float pulse = 0.95 + 0.05 * sin(time * 3.0);

      // Combine effects
      vec3 finalColor = color * intensity * pulse;
      finalColor += fresnel * vec3(1.0) * 0.3;
      finalColor += core * vec3(1.0) * 0.2;

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
};

export default function MiraB({ position, radius, hue }: MiraBProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Convert hue to color (white dwarf tends to blue-white)
  const color = useMemo(() => {
    const tempColor = new THREE.Color();
    tempColor.setHSL(hue / 360, 0.6, 0.7);
    return tempColor;
  }, [hue]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
      materialRef.current.uniforms.color.value = color;
    }

    // Subtle pulsation
    if (meshRef.current) {
      const pulse = 1 + 0.02 * Math.sin(state.clock.elapsedTime * 3.0);
      meshRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={position}>
      {/* Core white dwarf */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[radius, 32, 32]} />
        <shaderMaterial
          ref={materialRef}
          {...miraBShaderMaterial}
          transparent={false}
        />
      </mesh>

      {/* Bright corona */}
      <mesh scale={1.5}>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.2}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Point light */}
      <pointLight
        color={color}
        intensity={20}
        distance={10}
        decay={2}
      />
    </group>
  );
}