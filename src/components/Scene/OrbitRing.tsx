import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { COLORS } from '../../constants';

interface OrbitRingProps {
  semiMajorAxis: number;
  eccentricity: number;
  inclination: number;
  mode?: string;
}

export default function OrbitRing({
  semiMajorAxis,
  eccentricity,
  inclination,
}: OrbitRingProps) {
  const materialRef = useRef<THREE.LineBasicMaterial>(null);

  // Calculate ellipse points
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const inclRad = (inclination * Math.PI) / 180;

    for (let i = 0; i <= 128; i++) {
      const angle = (i / 128) * 2 * Math.PI;
      const r = semiMajorAxis * (1 - eccentricity * eccentricity) /
                (1 + eccentricity * Math.cos(angle));

      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle) * Math.sin(inclRad);
      const z = r * Math.sin(angle) * Math.cos(inclRad);

      pts.push(new THREE.Vector3(x, y, z));
    }

    return pts;
  }, [semiMajorAxis, eccentricity, inclination]);

  // Color: fixed for single experience
  const color = useMemo(() => {
    return new THREE.Color(COLORS.NEBULA_VIOLET);
  }, []);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.opacity = 0.3 + 0.1 * Math.sin(state.clock.elapsedTime * 0.5);
    }
  });

  return (
    <Line
      points={points}
      lineWidth={1}
    >
      <lineBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={0.4}
      />
    </Line>
  );
}
