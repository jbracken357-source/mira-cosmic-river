import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { resolveQualityTier } from '../../constants';

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
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv;
    uv.y += sin(uv.x * 12. + uTime * .16 + uLayer) * .016;
    uv.x += sin(uTime * .08 + uLayer) * .012;
    float density = texture2D(uMap, uv).r;
    float edge = smoothstep(0., .08, vUv.x) * (1. - smoothstep(.94, 1., vUv.x));
    edge *= smoothstep(0., .12, vUv.y) * (1. - smoothstep(.88, 1., vUv.y));
    gl_FragColor = vec4(uColor, pow(density, 1.15) * edge * uOpacity * uReady);
  }
`;

function createLayer(length: number, index: number, count: number) {
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
    positions.setXYZ(i, -t * length * .6,
      Math.sin(wave) * 2 + Math.sin(curl) * t * .45 + offset * t * .45,
      t * length * .5 + offset * t * .85);
    tangents.set([-length * .6,
      Math.cos(wave) * Math.PI * 1.6 + (.45 * Math.sin(curl) + 2.25 * t * Math.cos(curl)) + offset * .45,
      length * .5 + offset * .85], i * 3);
    sides[i] = (uv.getY(i) - .5) * (5 + t * 4);
  }
  geometry.setAttribute('aTangent', new THREE.BufferAttribute(tangents, 3));
  geometry.setAttribute('aSide', new THREE.BufferAttribute(sides, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: null }, uReady: { value: 0 }, uTime: { value: 0 },
      uOpacity: { value: 0 }, uLayer: { value: index },
      uColor: { value: new THREE.Color(index % 2 === 0 ? '#9caddc' : '#ead2ae') },
    },
    vertexShader, fragmentShader,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
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
  const groupRef = useRef<THREE.Group>(null);
  const count = tier === 'low' ? 2 : tier === 'mid' ? 3 : 5;
  const layers = useMemo(() => Array.from({ length: count }, (_, i) => createLayer(length, i, count)), [length, count]);

  useEffect(() => {
    let active = true;
    readyRef.current = false;
    const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}materials/river-density-v1.webp`, (loaded) => {
      if (!active) return;
      loaded.colorSpace = THREE.NoColorSpace; // Grayscale density, not display RGB.
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
      if (!reduceMotion && !document.hidden) material.uniforms.uTime.value += Math.min(delta, .05);
      material.uniforms.uOpacity.value = opacityRef.current * 2 / count;
    }
  });

  return <group ref={groupRef} name="river-veil">
    {layers.map(({ geometry, material }, i) => (
      <mesh key={i} geometry={geometry} material={material} frustumCulled={false} raycast={() => {}} />
    ))}
  </group>;
}
