import { useEffect, useRef, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createTailMaterial } from '../../shaders/tail';
import { useReducedMotion } from 'framer-motion';
import RiverVeil from './RiverVeil';
import { advanceTime, captureMode } from '../../lib/captureMode';
import { dailySkyCoupling, tailBaseOpacity } from '../../lib/riverLighting';
import { useBinaryStar } from '../../hooks';
import type { QualityTier } from '../../constants';

interface MiraTailProps {
  opacityRef: React.MutableRefObject<number>;
  particleCount?: number;
  tailLength?: number;
  miraBRef: MutableRefObject<THREE.Group | null>;
  // The governed tier, not the load-time sniff: the veil must follow the same
  // descent as the tail points (#26 / #50).
  tier: QualityTier;
}

// Generate tail particle positions - curved stream behind Mira A
// Based on real Mira bow shock geometry: matter flowing away from orbital motion
function generateTailData(count: number, length: number) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  const lengths = new Float32Array(count);
  const spreads = new Float32Array(count);

  // Stable particles keep reloads and quality comparisons visually reproducible.
  let seed = 17;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const t = i / count; // 0 = near star, 1 = far end
    const l = t * length;

    // Curved tail: matter streams behind Mira A
    // Extends diagonally (-X, -Z) so it's visible from the camera
    const spread = 0.3 + t * 3.0;
    const curve = Math.sin(t * Math.PI * 0.8) * 2.0; // upward curve

    // Random position within the cone
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * spread;

    // Tail extends in -X direction with +Z offset toward the camera
    positions[i * 3] = -l * 0.6;     // behind Mira A (reduced for visibility)
    positions[i * 3 + 1] = Math.cos(angle) * radius + curve;
    positions[i * 3 + 2] = Math.sin(angle) * radius + l * 0.5; // +Z toward camera

    seeds[i] = random();
    sizes[i] = 0.5 + random() * 1.5;
    lengths[i] = t;
    spreads[i] = 0.5 + random() * 1.5;
  }

  return { positions, seeds, sizes, lengths, spreads };
}

export default function MiraTail({
  opacityRef,
  particleCount = 10000,
  tailLength = 25,
  miraBRef,
  tier,
}: MiraTailProps) {
  const textureReadyRef = useRef(false);
  const pointsRef = useRef<THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>>(null);
  const bWorldPos = useRef(new THREE.Vector3());
  const reduceMotion = Boolean(useReducedMotion());
  const capture = captureMode();
  const skyState = useBinaryStar((state) => state.sky);
  // The daily coupling (#27): one deterministic sky drives the river's gain (a small lift
  // over the plain coupling), warmth, and the density of its material — all re-derived
  // only when the sky itself is refreshed, never per frame.
  const coupling = useMemo(() => dailySkyCoupling(skyState), [skyState]);

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

  useEffect(() => () => { geometry.dispose(); }, [geometry]);
  useEffect(() => () => { material.dispose(); }, [material]);

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

  useFrame((_, delta) => {
    // Update the material actually mounted on the points (the old ref was never bound).
    const mat = pointsRef.current?.material;
    if (!mat) return;
    mat.uniforms.uTime.value = advanceTime(mat.uniforms.uTime.value, delta, { reduceMotion });
    mat.uniforms.uOpacity.value = opacityRef.current * tailBaseOpacity(textureReadyRef.current, particleCount, coupling.density);
    mat.uniforms.uSkyGain.value = coupling.gain;
    mat.uniforms.uSkyWarmth.value = coupling.warmth;
    if (miraBRef.current) {
      miraBRef.current.getWorldPosition(bWorldPos.current);
      mat.uniforms.uMiraBPos.value.copy(bWorldPos.current);
    }
    mat.uniforms.uMouse.value.copy(mouseRef.current);
    // Capture mode zeroes the ripple along with every other time-varying input.
    mat.uniforms.uMouseInfluence.value = reduceMotion || capture.active ? 0 : .3;
  });

  return (
    <group>
      <points ref={pointsRef} geometry={geometry} material={material} raycast={() => {}} />
      <RiverVeil opacityRef={opacityRef} readyRef={textureReadyRef} length={tailLength} reduceMotion={reduceMotion} miraBRef={miraBRef} sky={coupling} tier={tier} />
    </group>
  );
}
