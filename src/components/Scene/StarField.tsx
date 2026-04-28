import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface StarFieldProps {
  count?: number;
}

// Custom twinkling star field - replaces DreiStars
// Each star has unique color temperature, brightness, and twinkle rhythm
export default function StarField({ count = 5000 }: StarFieldProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const { geometry } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colorsArr = new Float32Array(count * 3);
    const sizesArr = new Float32Array(count);
    const twinkleArr = new Float32Array(count * 2); // phase, speed

    // Temperature-based star colors (realistic distribution)
    const starColors = [
      // [r, g, b, weight] - spectral type distribution
      [1.0, 0.85, 0.7, 0.15],   // K-type (orange)
      [1.0, 0.95, 0.8, 0.25],   // G-type (yellow-white)
      [0.8, 0.85, 1.0, 0.30],   // A-type (blue-white)
      [0.6, 0.7, 1.0, 0.15],    // B-type (blue)
      [1.0, 0.6, 0.4, 0.10],    // M-type (red)
      [0.9, 0.9, 0.95, 0.05],   // F-type (white)
    ];

    for (let i = 0; i < count; i++) {
      // Spherical distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 50 + Math.random() * 80;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Random color from realistic distribution
      const roll = Math.random();
      let cumulative = 0;
      let color = starColors[0];
      for (const c of starColors) {
        cumulative += c[3];
        if (roll <= cumulative) {
          color = c;
          break;
        }
      }
      // Add variation
      const variation = 0.08;
      colorsArr[i * 3] = Math.min(1, Math.max(0, color[0] + (Math.random() - 0.5) * variation));
      colorsArr[i * 3 + 1] = Math.min(1, Math.max(0, color[1] + (Math.random() - 0.5) * variation));
      colorsArr[i * 3 + 2] = Math.min(1, Math.max(0, color[2] + (Math.random() - 0.5) * variation));

      // Size distribution (most small, few bright)
      const size = 0.3 + Math.pow(Math.random(), 2) * 2.0;
      sizesArr[i] = size;

      // Twinkle data: random phase and speed
      twinkleArr[i * 2] = Math.random() * Math.PI * 2;     // phase offset
      twinkleArr[i * 2 + 1] = 0.5 + Math.random() * 3.0;   // twinkle speed
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colorsArr, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizesArr, 1));
    geo.setAttribute('aTwinklePhase', new THREE.BufferAttribute(
      new Float32Array(twinkleArr.filter((_, i) => i % 2 === 0)), 1,
    ));
    geo.setAttribute('aTwinkleSpeed', new THREE.BufferAttribute(
      new Float32Array(twinkleArr.filter((_, i) => i % 2 === 1)), 1,
    ));

    return {
      geometry: geo,
    };
  }, [count]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        attach="material"
        uniforms={{
          uTime: { value: 0 },
        }}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexColors={true}
      />
    </points>
  );
}

const vertexShader = `
  attribute float aSize;
  attribute float aTwinklePhase;
  attribute float aTwinkleSpeed;

  uniform float uTime;

  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vColor = color;

    // Twinkle: sinusoidal brightness variation
    float twinkle = 0.6 + 0.4 * sin(aTwinklePhase + uTime * aTwinkleSpeed);
    vTwinkle = twinkle;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * twinkle * (150.0 / -mvPosition.z);
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    // Soft circular star
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    float alpha = 1.0 - smoothstep(0.2, 0.5, dist);
    alpha *= vTwinkle;

    // Bright core
    float core = pow(1.0 - dist * 2.0, 3.0);
    vec3 finalColor = vColor + core * vec3(0.3);

    gl_FragColor = vec4(finalColor, alpha * 0.9);
  }
`;
