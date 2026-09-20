import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { QualityTier } from '../../constants';
import { useEntryReadiness } from '../../hooks';
import { qualityBudget } from '../../lib/qualityBudget';
import { advanceTime } from '../../lib/captureMode';
import {
  MIRA_A_REACH,
  MIRA_B_REACH,
  MIRA_B_GAIN,
  veilLayerWeight,
} from '../../lib/riverLighting';
import type { DailySkyCoupling } from '../../lib/riverLighting';

const vertexShader = `
  attribute vec3 aTangent;
  attribute float aSide;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vWorldPos = (modelMatrix * vec4(position, 1.)).xyz;
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
  uniform vec3 uMiraBPos;
  uniform vec3 uReach;  // x: Mira A reach, y: Mira B reach, z: Mira B gain
  uniform vec3 uColorGold;
  uniform float uSkyGain;
  uniform float uSkyWarmth;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  // Mirrors starLightFalloff in src/lib/riverLighting.ts.
  float starLightFalloff(float dist, float reach) {
    float x = dist / reach;
    return 1.0 / (1.0 + x * x);
  }

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

    // Lit near the stars, easing into cool (not black) shadow down the tail.
    float lightA = starLightFalloff(length(vWorldPos), uReach.x);
    float lightB = starLightFalloff(distance(vWorldPos, uMiraBPos), uReach.y);
    float light = min(1., lightA + uReach.z * lightB);
    // Mirrors veilLightResponse in src/lib/riverLighting.ts: the alpha-blended veil keeps
    // three quarters of its body in shadow; the multiplicative floor suits only additives.
    float level = .75 + .6 * light;
    vec3 color = uColor * level * mix(vec3(.82, .86, 1.05), vec3(1.), light);
    color = mix(color, uColorGold, 0.5 * lightA * lightA * (uAccent * .8 + .2) * (.7 + uSkyWarmth));
    color *= uSkyGain;
    color = mix(color, color * vec3(1.06, .96, .84), uSkyWarmth);

    float alpha = mix(volume * .62, filament * .95, uAccent);
    // The lit pool reads denser as well as brighter; shadow thins but never vanishes.
    alpha *= mix(.85, 1.15, light);
    gl_FragColor = vec4(color, alpha * edge * uOpacity * uReady);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
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
        : (index % 2 === 0 ? '#5f6f9e' : '#76689c')) },
      uMiraBPos: { value: new THREE.Vector3(0, 0, 0) },
      uReach: { value: new THREE.Vector3(MIRA_A_REACH, MIRA_B_REACH, MIRA_B_GAIN) },
      uColorGold: { value: new THREE.Color('#f2d8a8') },
      uSkyGain: { value: 1 },
      uSkyWarmth: { value: 0 },
    },
    vertexShader, fragmentShader,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: accent ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  return { geometry, material };
}

export default function RiverVeil({ opacityRef, readyRef, length, reduceMotion, miraBRef, sky, tier }: {
  opacityRef: MutableRefObject<number>;
  readyRef: MutableRefObject<boolean>;
  length: number;
  reduceMotion: boolean;
  miraBRef: MutableRefObject<THREE.Group | null>;
  // The daily coupling (#27): gain/warmth as ever, plus a density that makes tonight's
  // material a touch thicker or thinner, never absent.
  sky: DailySkyCoupling;
  // The governed tier — same source Scene spends the rest of the budget from.
  tier: QualityTier;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bWorldPos = useRef(new THREE.Vector3());
  const { veilVolumes: volumeCount, veilAccents: accentCount } = qualityBudget(tier);
  const count = volumeCount + accentCount;
  const layers = useMemo(() => Array.from({ length: count }, (_, i) => (
    createLayer(length, i, count, i >= volumeCount)
  )), [length, count, volumeCount]);
  const mapRef = useRef<THREE.Texture | null>(null);

  // Density image: one load for the component's life. A governed tier change
  // rebuilds the ribbons, not the texture — otherwise the river would drop to
  // the procedural fallback while the same image is fetched again, and a
  // transient reload failure would take it away for the rest of the visit.
  // Binding happens in the frame loop so replacement layers pick up the retained
  // map without a second fetch.
  useEffect(() => {
    let active = true;
    const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}materials/river-density-v1.webp`, (loaded) => {
      if (!active) return;
      loaded.colorSpace = THREE.NoColorSpace; // Grayscale density, not display RGB.
      loaded.wrapS = THREE.RepeatWrapping;
      loaded.wrapT = THREE.RepeatWrapping;
      mapRef.current = loaded;
      readyRef.current = true;
      useEntryReadiness.getState().noteMaterial('river', 'ready');
    }, undefined, () => {
      // Keep the procedural tail alive when the optional image is unavailable —
      // and tell the gate, so the opening may start on the fallback path. Only
      // the live instance reports: a StrictMode-discarded load must not settle
      // the gate ahead of the remounted one.
      if (!active) return;
      useEntryReadiness.getState().noteMaterial('river', 'failed');
      readyRef.current = false;
    });
    return () => {
      active = false;
      readyRef.current = false;
      mapRef.current = null;
      texture.dispose();
    };
  }, [readyRef]);

  useEffect(() => {
    const current = layers;
    return () => {
      for (const { geometry, material } of current) {
        material.uniforms.uReady.value = 0;
        geometry.dispose();
        material.dispose();
      }
    };
  }, [layers]);

  useFrame((_, delta) => {
    if (miraBRef.current) miraBRef.current.getWorldPosition(bWorldPos.current);
    const map = mapRef.current;
    for (const [i, child] of (groupRef.current?.children ?? []).entries()) {
      const material = (child as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>).material;
      if (map && material.uniforms.uMap.value !== map) {
        material.uniforms.uMap.value = map;
        material.uniforms.uReady.value = 1;
      }
      material.uniforms.uTime.value = advanceTime(material.uniforms.uTime.value, delta, { reduceMotion });
      const isAccent = material.uniforms.uAccent.value === 1;
      material.uniforms.uOpacity.value = opacityRef.current * veilLayerWeight(i, count, isAccent) / count * sky.density;
      material.uniforms.uMiraBPos.value.copy(bWorldPos.current);
      material.uniforms.uSkyGain.value = sky.gain;
      material.uniforms.uSkyWarmth.value = sky.warmth;
    }
  });

  return <group ref={groupRef} name="river-veil">
    {layers.map(({ geometry, material }, i) => (
      <mesh key={i} geometry={geometry} material={material} frustumCulled={false} raycast={() => {}} />
    ))}
  </group>;
}
