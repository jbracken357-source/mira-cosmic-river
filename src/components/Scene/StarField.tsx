import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface StarFieldProps {
  count?: number;
}

// Fixed seed: the sky must look the same on every render and every machine.
// Components render purely (no Math.random during render) and stable stars keep
// visual checks comparable between runs.
const STARFIELD_SEED = 0x5eed1a;

// mulberry32 - tiny deterministic PRNG, plenty for placing stars
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Spectral classes with plausible colours and weights. M and K dwarfs really do outnumber
// everything else; the hot blue end is rare and that rarity is what makes it read as a real
// sky rather than a colour-wheel decoration. Weights sum to 1.
const SPECTRAL: Array<{ rgb: [number, number, number]; weight: number }> = [
  { rgb: [0.62, 0.74, 1.0], weight: 0.06 }, // B - blue-white
  { rgb: [0.76, 0.84, 1.0], weight: 0.11 }, // A - white-blue
  { rgb: [0.94, 0.95, 1.0], weight: 0.13 }, // F - white
  { rgb: [1.0, 0.97, 0.87], weight: 0.2 }, // G - yellow
  { rgb: [1.0, 0.85, 0.62], weight: 0.26 }, // K - orange
  { rgb: [1.0, 0.68, 0.47], weight: 0.24 }, // M - red-orange
];

// Three shells rather than one cloud. Distance does the depth work: the near shell is sparse,
// large, saturated and barely twinkles; the far shell is small, dim and reddened by the dust
// it is seen through, which is the same cue that makes a photograph of a sky look deep.
const LAYERS = {
  near: { share: 0.26, min: 42, max: 70, sizeMin: 0.55, sizeMax: 2.1, brightMin: 0.62, brightMax: 1.0, redden: 0.0 },
  mid: { share: 0.44, min: 70, max: 108, sizeMin: 0.35, sizeMax: 1.35, brightMin: 0.38, brightMax: 0.78, redden: 0.45 },
  far: { share: 0.3, min: 108, max: 158, sizeMin: 0.25, sizeMax: 0.85, brightMin: 0.16, brightMax: 0.45, redden: 1.0 },
} as const;

type LayerName = keyof typeof LAYERS;

// Custom twinkling star field - replaces DreiStars
// Each star has its own colour temperature, depth, brightness and twinkle rhythm.
export default function StarField({ count = 5000 }: StarFieldProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const { geometry } = useMemo(() => {
    const rand = mulberry32(STARFIELD_SEED);
    const positions = new Float32Array(count * 3);
    const colorsArr = new Float32Array(count * 3);
    const sizesArr = new Float32Array(count);
    const brightArr = new Float32Array(count);
    const phaseArr = new Float32Array(count);
    const speedArr = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Which shell this star belongs to.
      const layerRoll = rand();
      let layerName: LayerName = 'mid';
      let cumulativeShare = 0;
      for (const name of Object.keys(LAYERS) as LayerName[]) {
        cumulativeShare += LAYERS[name].share;
        if (layerRoll <= cumulativeShare) {
          layerName = name;
          break;
        }
      }
      const layer = LAYERS[layerName];

      // Spherical distribution inside the shell.
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const r = layer.min + rand() * (layer.max - layer.min);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Colour temperature, then dust reddening for the far shell.
      const roll = rand();
      let cumulative = 0;
      let rgb = SPECTRAL[0].rgb;
      for (const spectral of SPECTRAL) {
        cumulative += spectral.weight;
        if (roll <= cumulative) {
          rgb = spectral.rgb;
          break;
        }
      }
      const redden = layer.redden;
      const variation = 0.06;
      const tint = [
        rgb[0] + (rand() - 0.5) * variation,
        rgb[1] * (1 - redden * 0.1) + (rand() - 0.5) * variation,
        rgb[2] * (1 - redden * 0.28) + (rand() - 0.5) * variation,
      ];
      colorsArr[i * 3] = Math.min(1, Math.max(0, tint[0]));
      colorsArr[i * 3 + 1] = Math.min(1, Math.max(0, tint[1]));
      colorsArr[i * 3 + 2] = Math.min(1, Math.max(0, tint[2]));

      // Size distribution (most small, few bright), scaled by the shell.
      const sizeRoll = Math.pow(rand(), 2);
      sizesArr[i] = layer.sizeMin + sizeRoll * (layer.sizeMax - layer.sizeMin);

      // A handful of genuinely bright foreground stars carry the frame.
      const brightRoll = layer.brightMin + rand() * (layer.brightMax - layer.brightMin);
      brightArr[i] = Math.min(1.8, rand() < 0.04 ? brightRoll * 1.7 : brightRoll);

      // Twinkle data: random phase and speed.
      phaseArr[i] = rand() * Math.PI * 2;
      speedArr[i] = 0.5 + rand() * 3.0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colorsArr, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizesArr, 1));
    geo.setAttribute('aBright', new THREE.BufferAttribute(brightArr, 1));
    geo.setAttribute('aTwinklePhase', new THREE.BufferAttribute(phaseArr, 1));
    geo.setAttribute('aTwinkleSpeed', new THREE.BufferAttribute(speedArr, 1));

    return {
      geometry: geo,
    };
  }, [count]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        attach="material"
        uniforms={{
          uTime: { value: 0 },
        }}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexColors={true}
      />
    </points>
  );
}

const vertexShader = `
  attribute float aSize;
  attribute float aBright;
  attribute float aTwinklePhase;
  attribute float aTwinkleSpeed;

  uniform float uTime;

  varying vec3 vColor;
  varying float vBright;

  void main() {
    vColor = color;

    // Bright, close stars hold steady; faint ones are the ones that shimmer.
    float twinkleAmp = mix(0.45, 0.14, clamp(aBright, 0.0, 1.0));
    float twinkle = 1.0 + twinkleAmp * sin(aTwinklePhase + uTime * aTwinkleSpeed);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Distance shrinks the point (perspective) and dims it (brightness below), so the near
    // and far shells separate on screen instead of reading as one flat sheet.
    float attenuation = 150.0 / -mvPosition.z;
    gl_PointSize = min(aSize * twinkle * attenuation, 7.0);

    vBright = aBright * twinkle * (0.72 + 0.3 * attenuation);
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vBright;

  void main() {
    // Soft circular star
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    float halo = pow(1.0 - dist * 2.0, 2.2);
    float core = pow(max(1.0 - dist * 4.0, 0.0), 3.0);

    // The halo carries the temperature; the core adds the sparkle.
    vec3 finalColor = vColor * vBright * (0.9 + 0.35 * core);

    gl_FragColor = vec4(finalColor, halo);
  }
`;
