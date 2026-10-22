import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PHYSICS } from '../../constants';
import ForegroundDrift from './ForegroundDrift';
import type { QualityTier } from '../../constants';
import { useEntryReadiness } from '../../hooks';
import { materialFade } from '../../lib/entryReadiness';
import { qualityBudget } from '../../lib/qualityBudget';
import { veilRibbon, veilSide, VEIL_FAR_SPAN, PORTRAIT_VEIL_FAR_SPAN } from '../../lib/tailPath';
import { advanceTime, parkedFade } from '../../lib/captureMode';
import {
  MIRA_A_REACH,
  MIRA_B_REACH,
  MIRA_B_GAIN,
  VEIL_SPINE_GAIN,
  FLOW_WEIGHT,
  FLOW_SPREAD,
  veilLayerWeight,
} from '../../lib/riverLighting';
import type { DailySkyCoupling } from '../../lib/riverLighting';

const vertexShader = `
  attribute vec3 aTangent;
  attribute float aSide;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vFacing;
  void main() {
    vUv = uv;
    vWorldPos = (modelMatrix * vec4(position, 1.)).xyz;
    vec4 center = modelViewMatrix * vec4(position, 1.);
    vec3 tangent = normalize(mat3(modelViewMatrix) * aTangent);
    vec3 side = cross(normalize(-center.xyz), tangent);
    float sideLength = length(side);
    // sin of the angle between the sight-line and the ribbon's run: near zero the
    // camera looks down the ribbon and the billboard collapses into a thin card
    // whose straight edges show (side views of the root). The fragment fades it.
    vFacing = sideLength;
    side = sideLength > .001 ? side / sideLength : vec3(1., 0., 0.);
    // Each curved centerline lives in 3D. Only its cross-section faces the viewer,
    // avoiding edge-on cards without restricting the existing orbit controls.
    center.xyz += side * aSide;
    gl_Position = projectionMatrix * center;
  }
`;

const fragmentShader = `
  uniform sampler2D uMap;
  uniform sampler2D uFlow;
  uniform float uFlowReady;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uReady;
  uniform float uLayer;
  uniform float uAccent;
  uniform float uFarSpan;
  uniform vec2 uUvScale;
  uniform vec2 uUvOffset;
  uniform vec3 uColor;
  uniform vec3 uMiraBPos;
  uniform vec3 uMiraAPos;
  uniform vec3 uReach;  // x: Mira A reach, y: Mira B reach, z: Mira B gain
  uniform vec3 uColorGold;
  uniform float uSkyGain;
  uniform float uSkyWarmth;
  uniform float uSparkle;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vFacing;

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
    float smoke = density;

    // A long, gently wandering lane makes the brightest material follow the tail instead
    // of tracing every closed eddy in the source image as a luminous ring.
    float laneCenter = .5 + sin(vUv.x * 8. + uLayer * 1.7 + uTime * .1) * .12;
    float lane = exp(-pow((vUv.y - laneCenter) / .19, 2.));

    // The flow map: long threads running WITH the river (the density image above is
    // smoke — volume and eddies, but no direction). It rides the lane's wander so its
    // brightest thread is the lane's own centre, each ribbon offsets it a little so the
    // stack braids instead of repeating, and it only ever adds threads (max), never
    // carves the smoke. Optional like the companion map: until it binds, it adds nothing.
    // Volume ribbons only: on the narrow pearl accents the brightest thread became a
    // single lit wire across the frame.
#ifdef VEIL_FLOW
    vec2 flowUv = vec2(vUv.x, (vUv.y - laneCenter) * ${FLOW_SPREAD.toFixed(3)} + .5 + (uLayer - 4.) * .021);
    flowUv.y += sin(vUv.x * 5.3 + uLayer * 2.3 + uTime * .07) * .018;
    float flow = texture2D(uFlow, flowUv).r * uFlowReady;
    // The squeeze and the wander push flowUv.y past the image: clamp-to-edge would
    // smear its border rows into long straight streaks, so the threads end inside it.
    flow *= smoothstep(0., .1, flowUv.y) * (1. - smoothstep(.9, 1., flowUv.y));
    // The image converges into one narrow beam at its root end; near the pair that
    // read as a bundle of straight wires, so the threads fade before the root.
    flow *= 1. - smoothstep(.55, .85, vUv.x);
    // Straight threads betray a foreshortened ribbon: seen down its run, the billboard
    // squeezes them into a card of parallel lines. The smoke hides that; the threads
    // step back well before the ribbon itself does.
    flow *= smoothstep(.4, .85, vFacing);
    density = max(density, flow * ${FLOW_WEIGHT.toFixed(3)} * (1. - uAccent));
#endif
    float filament = smoothstep(.42, .88, density) * lane;
    // A touch of contrast in the body: the gaps between the flows stay dark enough that
    // the lit ridges read as a river of light rather than an even violet wash.
    float volume = pow(smoothstep(.1, .8, density), 1.25);
    // The spine: the dense material inside the lane. It is what the HDR lift below
    // pushes past the bloom threshold, so the brightest light runs along the tail
    // (SPEC: 最亮部分沿尾巴方向延伸) instead of pooling only at the stars.
    float spine = lane * smoothstep(.3, .9, density);
    // The far fade's width comes in as a uniform (#103): landscape binds
    // VEIL_FAR_SPAN — the same number that used to be the literal here, bit-exact —
    // and portrait binds PORTRAIT_VEIL_FAR_SPAN so the ribbon's body eases out
    // later, mirroring the points' own portrait far fade (tailPath owns both).
    float edge = smoothstep(0., uFarSpan, vUv.x) * (1. - smoothstep(.94, 1., vUv.x));
    edge *= smoothstep(0., .12, vUv.y) * (1. - smoothstep(.88, 1., vUv.y));
    // Near the root the ribbons are at their widest and least curved, and lit by the
    // HDR chain their straight side edges showed as cards beside the pair (side views
    // especially). There the lateral fade widens and the ribbon thins out before its
    // cut; the dust, the beads and the stars' own atmospheres carry the join.
    float rootness = smoothstep(.62, .95, vUv.x);
    edge *= smoothstep(0., .3, vUv.y) * (1. - smoothstep(.7, 1., vUv.y)) * rootness + (1. - rootness);
    edge *= 1. - .9 * smoothstep(.86, .99, vUv.x);

    // Lit near the stars, easing into cool (not black) shadow down the tail.
    float distA = distance(vWorldPos, uMiraAPos);
    float lightA = starLightFalloff(distA, uReach.x);
    float lightB = starLightFalloff(distance(vWorldPos, uMiraBPos), uReach.y);
    float light = min(1., lightA + uReach.z * lightB);
    // Mirrors veilLightResponse in src/lib/riverLighting.ts: the alpha-blended veil keeps
    // three quarters of its body in shadow; the multiplicative floor suits only additives.
    float level = .75 + .6 * light;
    vec3 color = uColor * level * mix(vec3(.82, .86, 1.05), vec3(1.), light);
    color = mix(color, uColorGold, 0.5 * lightA * lightA * (uAccent * .8 + .2) * (.7 + uSkyWarmth));
    // Gold stays local, but local to the ridges now as well as to the giant: the accent
    // ribbons pick out the densest threads in gold the whole length of the river.
    // (The smoke's ridges, not the flow threads: gold on a straight thread reads as a wire.)
    color = mix(color, uColorGold, uAccent * smoothstep(.6, .95, smoke) * lane * .6);
    color *= 1. + ${VEIL_SPINE_GAIN.toFixed(3)} * mix(.6, 1., uAccent) * spine * uSparkle;
    color *= uSkyGain;
    color = mix(color, color * vec3(1.06, .96, .84), uSkyWarmth);

    float alpha = mix(volume * .62, filament * .95, uAccent);
    // The lit pool reads denser as well as brighter; shadow thins but never vanishes.
    alpha *= mix(.85, 1.15, light);
    // The ribbons pass the giant on their way to the root: inside its limb they would
    // paint over the photosphere with a hard ribbon edge, so they thin out there and
    // leave the star's own atmosphere to carry the join.
    alpha *= smoothstep(${(PHYSICS.MIRA_A.radius * 1.0).toFixed(3)}, ${(PHYSICS.MIRA_A.radius * 1.7).toFixed(3)}, distA);
    alpha *= smoothstep(.15, .45, vFacing);
    gl_FragColor = vec4(color, alpha * edge * uOpacity * uReady);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function createLayer(length: number, index: number, count: number, accent: boolean, flow: boolean) {
  const geometry = new THREE.PlaneGeometry(1, 1, 64, 1);
  const positions = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const tangents = new Float32Array(positions.count * 3);
  const sides = new Float32Array(positions.count);
  for (let i = 0; i < positions.count; i++) {
    const t = 1 - uv.getX(i); // The density image is narrow on the right.
    const { position, tangent } = veilRibbon(t, length, index, count);
    positions.setXYZ(i, position[0], position[1], position[2]);
    tangents.set(tangent, i * 3);
    sides[i] = veilSide(t, accent, uv.getY(i));
  }
  geometry.setAttribute('aTangent', new THREE.BufferAttribute(tangents, 3));
  geometry.setAttribute('aSide', new THREE.BufferAttribute(sides, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: null }, uReady: { value: 0 }, uTime: { value: 0 },
      uFlow: { value: null }, uFlowReady: { value: 0 },
      uOpacity: { value: 0 }, uLayer: { value: index },
      uAccent: { value: accent ? 1 : 0 },
      uFarSpan: { value: VEIL_FAR_SPAN },
      uUvScale: { value: new THREE.Vector2(1.03 + index * .17, .92 + (index % 3) * .21) },
      uUvOffset: { value: new THREE.Vector2(index * .193, index * .117) },
      uColor: { value: new THREE.Color(accent
        ? (index % 2 === 0 ? '#e7d0ae' : '#bac9f2')
        : (index % 2 === 0 ? '#7f8ed0' : '#958cce')) },
      uMiraBPos: { value: new THREE.Vector3(0, 0, 0) },
      uMiraAPos: { value: new THREE.Vector3(0, 0, 0) },
      uReach: { value: new THREE.Vector3(MIRA_A_REACH, MIRA_B_REACH, MIRA_B_GAIN) },
      uColorGold: { value: new THREE.Color('#f2d8a8') },
      uSkyGain: { value: 1 },
      uSkyWarmth: { value: 0 },
      uSparkle: { value: 1 },
    },
    // The flow threads cost a texture read per fragment; the low tier skips them.
    defines: flow ? { VEIL_FLOW: '' } : {},
    vertexShader, fragmentShader,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: accent ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  return { geometry, material };
}

export default function RiverVeil({ opacityRef, readyRef, length, reduceMotion, miraARef, miraBRef, sky, tier, portrait }: {
  opacityRef: MutableRefObject<number>;
  readyRef: MutableRefObject<boolean>;
  length: number;
  reduceMotion: boolean;
  miraARef: MutableRefObject<THREE.Group | null>;
  miraBRef: MutableRefObject<THREE.Group | null>;
  // The daily coupling (#27): gain/warmth as ever, plus a density that makes tonight's
  // material a touch thicker or thinner, never absent.
  sky: DailySkyCoupling;
  // The governed tier — same source Scene spends the rest of the budget from.
  tier: QualityTier;
  // 竖屏长卷 (#103): the ribbon's far fade eases later in the tall frame, the veil's
  // own half of the points' portrait far fade (PORTRAIT_VEIL_FAR_SPAN).
  portrait: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bWorldPos = useRef(new THREE.Vector3());
  const aWorldPos = useRef(new THREE.Vector3());
  const { veilVolumes: volumeCount, veilAccents: accentCount, veilFlow, driftPuffs } = qualityBudget(tier);
  const count = volumeCount + accentCount;
  const layers = useMemo(() => Array.from({ length: count }, (_, i) => (
    createLayer(length, i, count, i >= volumeCount, veilFlow > 0)
  )), [length, count, volumeCount, veilFlow]);
  const mapRef = useRef<THREE.Texture | null>(null);
  // The veil's arrival fade as of this frame, shared with the foreground mist.
  const readyValueRef = useRef(0);
  const flowRef = useRef<THREE.Texture | null>(null);
  const flowBoundAtRef = useRef<number | null>(null);
  // When the density map bound (performance.now clock), for the arrival fade (#62).
  // Null until the first bind; a governed tier change keeps the stamp, so rebuilt
  // ribbons arrive already faded in.
  const mapBoundAtRef = useRef<number | null>(null);

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
      mapBoundAtRef.current = performance.now();
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
      mapBoundAtRef.current = null;
      texture.dispose();
    };
  }, [readyRef]);

  // The flow map (FLOW_WEIGHT): optional detail like the companion's surface, so it
  // never joins the entry gate — a late or missing file leaves the smoke alone.
  useEffect(() => {
    let active = true;
    const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}materials/river-flow-v1.webp`, (loaded) => {
      if (!active) return;
      loaded.colorSpace = THREE.NoColorSpace;
      flowRef.current = loaded;
      flowBoundAtRef.current = performance.now();
    }, undefined, () => {
      if (!active) return;
      flowRef.current = null;
      flowBoundAtRef.current = null;
    });
    return () => {
      active = false;
      flowRef.current = null;
      flowBoundAtRef.current = null;
      texture.dispose();
    };
  }, []);

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
    if (miraARef.current) miraARef.current.getWorldPosition(aWorldPos.current);
    const map = mapRef.current;
    // The arrival fade (#62): uReady rises to exactly 1 over ENTRY_FADE_MS instead
    // of switching in one frame. A rebuilt layer set picks up the retained map's
    // stamp and therefore arrives already faded in. Capture mode parks the fade at
    // its endpoint — the registered policy lives in captureMode.
    const ready = parkedFade(materialFade(mapBoundAtRef.current, performance.now()));
    readyValueRef.current = ready;
    const flow = flowRef.current;
    // Unlike the smoke, the flow fade never parks at 1 unbound: an empty sampler at
    // full weight is still nothing (max with zero), but keep it honest at 0.
    const flowReady = flowBoundAtRef.current == null ? 0 : parkedFade(materialFade(flowBoundAtRef.current, performance.now()));
    for (const [i, child] of (groupRef.current?.children ?? []).entries()) {
      const material = (child as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>).material;
      if (map && material.uniforms.uMap.value !== map) {
        material.uniforms.uMap.value = map;
      }
      material.uniforms.uReady.value = ready;
      if (flow && material.uniforms.uFlow.value !== flow) material.uniforms.uFlow.value = flow;
      material.uniforms.uFlowReady.value = flowReady;
      material.uniforms.uTime.value = advanceTime(material.uniforms.uTime.value, delta, { reduceMotion });
      const isAccent = material.uniforms.uAccent.value === 1;
      // Written every frame like the tail's own uFarFade, so a rotation flips it.
      material.uniforms.uFarSpan.value = portrait ? PORTRAIT_VEIL_FAR_SPAN : VEIL_FAR_SPAN;
      material.uniforms.uOpacity.value = opacityRef.current * veilLayerWeight(i, count, isAccent) / count * sky.density;
      material.uniforms.uMiraBPos.value.copy(bWorldPos.current);
      material.uniforms.uMiraAPos.value.copy(aWorldPos.current);
      material.uniforms.uSkyGain.value = sky.gain;
      material.uniforms.uSkyWarmth.value = sky.warmth;
      material.uniforms.uSparkle.value = sky.sparkle;
    }
  });

  return <>
    <group ref={groupRef} name="river-veil">
      {layers.map(({ geometry, material }, i) => (
        <mesh key={i} geometry={geometry} material={material} frustumCulled={false} raycast={() => {}} />
      ))}
    </group>
    {driftPuffs > 0 && (
      <ForegroundDrift count={driftPuffs} length={length} map={mapRef} ready={readyValueRef} opacityRef={opacityRef} reduceMotion={reduceMotion} />
    )}
  </>;
}
