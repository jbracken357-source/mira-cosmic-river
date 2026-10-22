import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { advanceTime } from '../../lib/captureMode';
import { FOREGROUND_DRIFT, foregroundPuff } from '../../lib/tailPath';
import type { QualityTier } from '../../constants';

// 穿行体积 (Wayfinder C): near mist crossing the frame between the viewer and the
// river, so a turn of the camera slides the foreground past the far road. Each puff
// is a camera-facing quad that borrows a patch of the river's own smoke image — the
// same material, not a new texture — fading out as the camera nears it, so a close
// pass never fills the frame with one grey card.
const vertexShader = `
  attribute vec3 aOffset;
  attribute float aScale;
  attribute float aSeed;
  uniform float uTime;
  varying vec2 vUv;
  varying float vSeed;
  varying float vDepth;
  void main() {
    vUv = uv;
    vSeed = aSeed;
    vec3 centre = aOffset;
    // A slow drift along the road's heading and a slower bob: enough that the mist
    // is visibly gas, never enough to read as motion of its own.
    centre.x -= mod(uTime * .12 + aSeed * 40., 8.) - 4.;
    centre.y += sin(uTime * .05 + aSeed * 9.) * .6;
    vec4 mv = modelViewMatrix * vec4(centre, 1.);
    mv.xy += position.xy * aScale;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = `
  uniform sampler2D uMap;
  uniform float uReady;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vSeed;
  varying float vDepth;
  void main() {
    // A patch of the smoke image, picked by the seed, inside its lit middle band.
    vec2 patchUv = vec2(.12 + fract(vSeed * 3.17) * .55, .3 + fract(vSeed * 7.31) * .3);
    float smoke = texture2D(uMap, patchUv + (vUv - .5) * vec2(.32, .3)).r;
    float r = length(vUv - .5) * 2.;
    float soft = 1. - smoothstep(.35, 1., r);
    float near = smoothstep(${FOREGROUND_DRIFT.nearFade[0].toFixed(3)}, ${FOREGROUND_DRIFT.nearFade[1].toFixed(3)}, vDepth);
    float alpha = smoothstep(.04, .5, smoke) * soft * near * uOpacity * uReady;
    gl_FragColor = vec4(uColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export default function ForegroundDrift({ length, map, ready, opacityRef, tier, reduceMotion }: {
  length: number;
  // The river's smoke image, shared with the veil (null until it binds).
  map: React.MutableRefObject<THREE.Texture | null>;
  ready: React.MutableRefObject<number>;
  opacityRef: React.MutableRefObject<number>;
  tier: QualityTier;
  reduceMotion: boolean;
}) {
  const count = tier === 'low' ? FOREGROUND_DRIFT.countLow : FOREGROUND_DRIFT.count;
  const geometry = useMemo(() => {
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('uv', quad.getAttribute('uv'));
    const offsets = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const seeds = new Float32Array(count);
    // Stable placement, like the tail: reloads and captures see the same mist.
    let seed = 29;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const { scale } = FOREGROUND_DRIFT;
    for (let i = 0; i < count; i++) {
      offsets.set(foregroundPuff(length, random(), random(), random()), i * 3);
      scales[i] = scale[0] + random() * (scale[1] - scale[0]);
      seeds[i] = random();
    }
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    geo.instanceCount = count;
    quad.dispose();
    return geo;
  }, [count, length]);

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: null },
      uReady: { value: 0 },
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color(FOREGROUND_DRIFT.color) },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), []);

  useEffect(() => () => { geometry.dispose(); }, [geometry]);
  useEffect(() => () => { material.dispose(); }, [material]);

  const meshRef = useRef<THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>>(null);
  useFrame((_, delta) => {
    const mat = meshRef.current?.material;
    if (!mat) return;
    const u = mat.uniforms;
    if (map.current && u.uMap.value !== map.current) u.uMap.value = map.current;
    u.uReady.value = map.current ? ready.current : 0;
    u.uTime.value = advanceTime(u.uTime.value, delta, { reduceMotion });
    u.uOpacity.value = opacityRef.current * FOREGROUND_DRIFT.opacity;
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} frustumCulled={false} raycast={() => {}} renderOrder={2} />;
}
