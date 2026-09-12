import { useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createTailMaterial } from '../../shaders/tail';

interface MiraTailProps {
  opacityRef: React.MutableRefObject<number>;
  particleCount?: number;
  tailLength?: number;
}

// Generate tail particle positions - curved stream behind Mira A
// Based on real Mira bow shock geometry: matter flowing away from orbital motion
function generateTailData(count: number, length: number) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  const lengths = new Float32Array(count);
  const spreads = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const t = i / count; // 0 = near star, 1 = far end
    const l = t * length;

    // Curved tail: matter streams behind Mira A
    // Extends diagonally (-X, -Z) so it's visible from the camera
    const spread = 0.3 + t * 3.0;
    const curve = Math.sin(t * Math.PI * 0.8) * 2.0; // upward curve

    // Random position within the cone
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * spread;

    // Tail extends in -X direction with +Z offset toward the camera
    positions[i * 3] = -l * 0.6;     // behind Mira A (reduced for visibility)
    positions[i * 3 + 1] = Math.cos(angle) * radius + curve;
    positions[i * 3 + 2] = Math.sin(angle) * radius + l * 0.5; // +Z toward camera

    seeds[i] = Math.random();
    sizes[i] = 0.5 + Math.random() * 1.5;
    lengths[i] = t;
    spreads[i] = 0.5 + Math.random() * 1.5;
  }

  return { positions, seeds, sizes, lengths, spreads };
}

export default function MiraTail({
  opacityRef,
  particleCount = 10000,
  tailLength = 25,
}: MiraTailProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const { positions, seeds, sizes, lengths, spreads } =
      generateTailData(particleCount, tailLength);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aLength', new THREE.BufferAttribute(lengths, 1));
    geo.setAttribute('aSpread', new THREE.BufferAttribute(spreads, 1));
    return geo;
  }, [particleCount, tailLength]);

  const material = useMemo(() => createTailMaterial(), []);

  // Track mouse position for ripple effect
  const mouseRef = useRef(new THREE.Vector2(0, 0));

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Normalize to [-1, 1]
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useFrame(() => {
    if (materialRef.current) {
      const mat = materialRef.current;
      mat.uniforms.uTime.value += 0.016;
      mat.uniforms.uOpacity.value = opacityRef.current;
      mat.uniforms.uMouse.value.copy(mouseRef.current);
      mat.uniforms.uMouseInfluence.value = THREE.MathUtils.lerp(
        mat.uniforms.uMouseInfluence.value,
        0.8,
        0.05,
      );
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry} material={material} />
  );
}
