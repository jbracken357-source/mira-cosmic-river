import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../../constants';

interface MaterialStreamProps {
  from: [number, number, number];
  to: [number, number, number];
  particleCount: number;
  turbulence: number;
}

// Deterministic pseudo-random function seeded by index
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export default function MaterialStream({
  from,
  to,
  particleCount,
  turbulence,
}: MaterialStreamProps) {
  const pointsRef = useRef<THREE.Points>(null);

  // Create particle positions along the stream path
  const particles = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const direction = end.clone().sub(start);

    const colorStart = new THREE.Color(COLORS.STELLAR_ORANGE);
    const colorEnd = new THREE.Color(COLORS.WHITE_DWARF_BLUE);

    for (let i = 0; i < particleCount; i++) {
      const t = i / particleCount;

      // Position along the path with some randomness (deterministic)
      const pos = start.clone().add(direction.clone().multiplyScalar(t));
      pos.x += (seededRandom(i * 3) - 0.5) * turbulence * 0.5;
      pos.y += (seededRandom(i * 3 + 1) - 0.5) * turbulence * 0.3;
      pos.z += (seededRandom(i * 3 + 2) - 0.5) * turbulence * 0.5;

      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;

      // Color interpolation
      const color = colorStart.clone().lerp(colorEnd, t);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      // Size varies along the stream (deterministic)
      sizes[i] = 0.02 + 0.03 * seededRandom(i + 1000);
    }

    return { positions, colors, sizes };
  }, [from, to, particleCount, turbulence]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(particles.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(particles.colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(particles.sizes, 1));
    return geo;
  }, [particles]);

  useFrame((state) => {
    if (pointsRef.current) {
      // Rotate particles along the stream
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.1;

      // Animate particle positions for flow effect
      const positions = pointsRef.current.geometry.attributes.position;
      for (let i = 0; i < particleCount; i++) {
        const offset = (state.clock.elapsedTime + i * 0.01) % 1;
        const originalX = particles.positions[i * 3];
        positions.array[i * 3] = originalX + Math.sin(offset * 10) * turbulence * 0.1;
      }
      positions.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.05}
        vertexColors
        transparent
        opacity={0.7}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}