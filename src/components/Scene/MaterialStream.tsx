import type { MutableRefObject } from 'react';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../../constants';
import type { OrbitPositions } from '../../types';
import { useReducedMotion } from 'framer-motion';
import { advanceTime } from '../../lib/captureMode';

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
  const timeRef = useRef(0);
  const reduceMotion = Boolean(useReducedMotion());

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

  useFrame((_, delta) => {
    const pts = pointsRef.current;
    if (!pts) return;

    const { primary, secondary } = positionsRef.current;
    timeRef.current = advanceTime(timeRef.current, delta, { reduceMotion });
    const dx = secondary[0] - primary[0];
    const dy = secondary[1] - primary[1];
    const dz = secondary[2] - primary[2];
    const startFraction = Math.min(.8, 2.4 / Math.hypot(dx, dy, dz));
    const posAttr = pts.geometry.attributes.position;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < particleCount; i++) {
      const t = (i / particleCount + timeRef.current * .045) % 1;
      const along = startFraction + t * (1 - startFraction);
      const curve = Math.sin(t * Math.PI);
      arr[i * 3] = primary[0] + dx * along + (seededRandom(i * 3) - .5) * turbulence * .22;
      arr[i * 3 + 1] = primary[1] + dy * along + curve * .25;
      arr[i * 3 + 2] = primary[2] + dz * along + curve * .45 + (seededRandom(i * 3 + 2) - .5) * turbulence * .2;
    }

    posAttr.needsUpdate = true;
    // The endpoints already live in world space; rotating the whole stream breaks
    // its connection to both stars.
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.06}
        vertexColors
        transparent
        opacity={0.16}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
