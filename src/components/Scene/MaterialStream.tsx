import type { MutableRefObject } from 'react';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../../constants';
import type { OrbitPositions } from '../../types';

export type OrbitPositionsRef = MutableRefObject<OrbitPositions>;

interface MaterialStreamProps {
  positionsRef: OrbitPositionsRef;
  particleCount: number;
  turbulence: number;
}

// Deterministic pseudo-random function seeded by index
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export default function MaterialStream({
  positionsRef,
  particleCount,
  turbulence,
}: MaterialStreamProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const { colors, sizes } = useMemo(() => {
    const colorsArr = new Float32Array(particleCount * 3);
    const sizesArr = new Float32Array(particleCount);
    const colorStart = new THREE.Color(COLORS.STELLAR_ORANGE);
    const colorEnd = new THREE.Color(COLORS.WHITE_DWARF_BLUE);

    for (let i = 0; i < particleCount; i++) {
      const t = i / particleCount;
      const color = colorStart.clone().lerp(colorEnd, t);
      colorsArr[i * 3] = color.r;
      colorsArr[i * 3 + 1] = color.g;
      colorsArr[i * 3 + 2] = color.b;
      sizesArr[i] = 0.2 + 0.3 * seededRandom(i + 1000);
    }

    return { colors: colorsArr, sizes: sizesArr };
  }, [particleCount]);

  const geometry = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, [particleCount, colors, sizes]);

  useFrame((state) => {
    const pts = pointsRef.current;
    if (!pts) return;

    const { primary, secondary } = positionsRef.current;
    const start = new THREE.Vector3(...primary);
    const end = new THREE.Vector3(...secondary);
    const direction = end.clone().sub(start);
    const posAttr = pts.geometry.attributes.position;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < particleCount; i++) {
      const t = i / particleCount;
      const pos = start.clone().add(direction.clone().multiplyScalar(t));
      pos.x += (seededRandom(i * 3) - 0.5) * turbulence * 0.5;
      pos.y += (seededRandom(i * 3 + 1) - 0.5) * turbulence * 0.3;
      pos.z += (seededRandom(i * 3 + 2) - 0.5) * turbulence * 0.5;

      const offset = (state.clock.elapsedTime + i * 0.01) % 1;
      arr[i * 3] = pos.x + Math.sin(offset * 10) * turbulence * 0.1;
      arr[i * 3 + 1] = pos.y;
      arr[i * 3 + 2] = pos.z;
    }

    posAttr.needsUpdate = true;
    pts.rotation.y = state.clock.elapsedTime * 0.1;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.3}
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