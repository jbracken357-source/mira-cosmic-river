import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { resolveQualityTier } from '../../constants';
import { CAPTURE_TIME, captureMode } from '../../lib/captureMode';

const vertexShader = `
  attribute vec3 aTangent;
  attribute float aSide;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 center = modelViewMatrix * vec4(position, 1.);
    vec3 tangent = normalize(mat3(modelViewMatrix) * aTangent);
    vec3 side = cross(normalize(-center.xyz), tangent);
    float sideLength = length(side);
    side = sideLength > .001 ? side / sideLength : vec3(1., 0., 0.);
    // Each curved centerline lives in 3D. Only its cross-section faces the viewer,
    // avoiding edge-on cards without restricting the existing orbit controls.
    center.xyz += side * aSide;
    gl_Position = projectionMatrix * center;
  }
`;

const fragmentShader = `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uReady;
  uniform float uLayer;
  uniform float uAccent;
  uniform vec2 uUvScale;
  uniform vec2 uUvOffset;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    vec2 uv = (vUv - .5) * uUvScale + .5 + uUvOffset;
    uv.y += sin(uv.x * 12. + uTime * .16 + uLayer) * .016;
    uv.x += sin(uTime * .08 + uLayer) * .012;
    float primary = texture2D(uMap, uv).r;
    vec2 secondaryUv = uv * vec2(.73, 1.31) + vec2(uLayer * .137, uLayer * .071);
    float secondary = texture2D(uMap, secondaryUv).r;
    float density = primary * .68 + secondary * .32;

    // A long, gently wandering lane makes the brightest material follow the tail instead
    // of tracing every closed eddy in the source image as a luminous ring.
    float laneCenter = .5 + sin(vUv.x * 8. + uLayer * 1.7 + uTime * .1) * .12;
    float lane = exp(-pow((vUv.y - laneCenter) / .19, 2.));
    float volume = smoothstep(.08, .78, density);
    float filament = smoothstep(.42, .88, density) * lane;
    float edge = smoothstep(0., .08, vUv.x) * (1. - smoothstep(.94, 1., vUv.x));
    edge *= smoothstep(0., .12, vUv.y) * (1. - smoothstep(.88, 1., vUv.y));
    float alpha = mix(volume * .56, filament * .8, uAccent);
    gl_FragColor = vec4(uColor, alpha * edge * uOpacity * uReady);
  }
`;

function createLayer(length: number, index: number, count: number, accent: boolean) {
  const geometry = new THREE.PlaneGeometry(1, 1, 64, 1);
  const positions = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const tangents = new Float32Array(positions.count * 3);
  const sides = new Float32Array(positions.count);
  const offset = index - (count - 1) / 2;
  for (let i = 0; i < positions.count; i++) {
    const t = 1 - uv.getX(i); // The density image is narrow on the right.
    const wave = t * Math.PI * .8;
    const curl = t * 5 + index * .7;
    positions.setXYZ(i, -t * length * .56,
      Math.sin(wave) * 2.2 + Math.sin(curl) * t * .55 + offset * t * .62,
      t * length * .62 + offset * t * 1.05);
    tangents.set([-length * .56,
      Math.cos(wave) * Math.PI * 1.6 + (.45 * Math.sin(curl) + 2.25 * t * Math.cos(curl)) + offset * .45,
      length * .62 + offset * 1.05], i * 3);
    sides[i] = (uv.getY(i) - .5) * (accent ? 5.5 + t * 5 : 7 + t * 7);
  }
  geometry.setAttribute('aTangent', new THREE.BufferAttribute(tangents, 3));
  geometry.setAttribute('aSide', new THREE.BufferAttribute(sides, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: null }, uReady: { value: 0 }, uTime: { value: 0 },
      uOpacity: { value: 0 }, uLayer: { value: index },
      uAccent: { value: accent ? 1 : 0 },
      uUvScale: { value: new THREE.Vector2(1.03 + index * .17, .92 + (index % 3) * .21) },
      uUvOffset: { value: new THREE.Vector2(index * .193, index * .117) },
      uColor: { value: new THREE.Color(accent
        ? (index % 2 === 0 ? '#e7d0ae' : '#bac9f2')
        : (index % 2 === 0 ? '#65769d' : '#8a745f')) },
    },
    vertexShader, fragmentShader,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: accent ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  return { geometry, material };
}

export default function RiverVeil({ opacityRef, readyRef, length, reduceMotion }: {
  opacityRef: MutableRefObject<number>;
  readyRef: MutableRefObject<boolean>;
  length: number;
  reduceMotion: boolean;
}) {
  const tier = resolveQualityTier();
  const capture = captureMode();
  const groupRef = useRef<THREE.Group>(null);
  const volumeCount = tier === 'low' ? 2 : tier === 'mid' ? 4 : 7;
  const accentCount = tier === 'low' ? 0 : tier === 'mid' ? 1 : 2;
  const count = volumeCount + accentCount;
  const layers = useMemo(() => Array.from({ length: count }, (_, i) => (
    createLayer(length, i, count, i >= volumeCount)
  )), [length, count, volumeCount]);

  useEffect(() => {
    let active = true;
    readyRef.current = false;
    const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}materials/river-density-v1.webp`, (loaded) => {
      if (!active) return;
      loaded.colorSpace = THREE.NoColorSpace; // Grayscale density, not display RGB.
      loaded.wrapS = THREE.RepeatWrapping;
      loaded.wrapT = THREE.RepeatWrapping;
      for (const { material } of layers) {
        material.uniforms.uMap.value = loaded;
        material.uniforms.uReady.value = 1;
      }
      readyRef.current = true;
    }, undefined, () => {
      // Keep the procedural tail alive when the optional image is unavailable.
      if (active) readyRef.current = false;
    });
    return () => {
      active = false;
      readyRef.current = false;
      texture.dispose();
      for (const { geometry, material } of layers) {
        material.uniforms.uReady.value = 0;
        geometry.dispose();
        material.dispose();
      }
    };
  }, [layers, readyRef]);

  useFrame((_, delta) => {
    for (const child of groupRef.current?.children ?? []) {
      const material = (child as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>).material;
      if (capture.active) material.uniforms.uTime.value = CAPTURE_TIME;
      else if (!reduceMotion && !document.hidden) material.uniforms.uTime.value += Math.min(delta, .05);
      const isAccent = material.uniforms.uAccent.value === 1;
      material.uniforms.uOpacity.value = opacityRef.current * (isAccent ? 1.05 : 1.55) / count;
    }
  });

  return <group ref={groupRef} name="river-veil">
    {layers.map(({ geometry, material }, i) => (
      <mesh key={i} geometry={geometry} material={material} frustumCulled={false} raycast={() => {}} />
    ))}
  </group>;
}
