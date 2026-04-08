import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import type { VisualMode } from '../../types';
import { COLORS, PHYSICS } from '../../constants';

interface OrbitRingProps {
  semiMajorAxis: number;
  eccentricity: number;
  inclination: number;
  mode: VisualMode;
}

export default function OrbitRing({
  semiMajorAxis,
  eccentricity,
  inclination,
  mode,
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

  // Color based on mode
  const color = useMemo(() => {
    switch (mode) {
      case 'glow':
        return new THREE.Color(COLORS.STELLAR_ORANGE);
      case 'wave':
        return new THREE.Color(COLORS.NEBULA_VIOLET);
      case 'particles':
        return new THREE.Color(COLORS.WHITE_DWARF_BLUE);
      default:
        return new THREE.Color(COLORS.NEBULA_VIOLET);
    }
  }, [mode]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.opacity = 0.3 + 0.1 * Math.sin(state.clock.elapsedTime * 0.5);
    }
  });

  // Wave mode distortion
  const wavePoints = useMemo(() => {
    if (mode !== 'wave') return points;

    return points.map((pt, i) => {
      const wave = 0.1 * Math.sin(i * 0.1 + PHYSICS.GRAVITY.waveFrequency);
      return new THREE.Vector3(pt.x, pt.y + wave, pt.z);
    });
  }, [mode, points]);

  return (
    <Line
      points={mode === 'wave' ? wavePoints : points}
      lineWidth={1}
    >
      <lineBasicMaterial
        ref={materialRef as any}
        color={color}
        transparent
        opacity={0.4}
      />
    </Line>
  );
}
