import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MIRA_B_BEACON } from '../../lib/binaryLighting';

// The companion's beacon (see MIRA_B_BEACON): one camera-facing point whose size is
// the larger of its projected world size and a pixel floor. It sits inside Mira B's
// group, so it rides the orbit and the shared journey for free, and it depth-tests
// against the giant — when the companion passes behind it, the beacon goes with it.
const vertexShader = `
  uniform float uWorldSize;
  uniform float uMinPx;
  uniform float uViewportHeight;
  uniform float uPixelRatio;
  void main() {
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    gl_Position = projectionMatrix * mv;
    // projectionMatrix[1][1] is cot(fov / 2): world size to pixels at this depth.
    float projected = uWorldSize * projectionMatrix[1][1] * uViewportHeight * 0.5 / -mv.z;
    gl_PointSize = max(projected, uMinPx * uPixelRatio);
  }
`;

// Mirrors beaconProfile in src/lib/binaryLighting.ts.
const fragmentShader = `
  uniform vec3 uColor;
  uniform float uIntensity;
  void main() {
    float x = clamp(length(gl_PointCoord - 0.5) * 2.0, 0.0, 1.0);
    float core = exp(-x * x * 60.0);
    float halo = 0.22 / (1.0 + x * x * 40.0);
    float profile = (core + halo) * (1.0 - smoothstep(0.7, 1.0, x));
    gl_FragColor = vec4(uColor * uIntensity * profile, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export default function CompanionBeacon({ radius }: { radius: number }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    return geo;
  }, []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uWorldSize: { value: radius * MIRA_B_BEACON.worldScale * 2 },
      uMinPx: { value: MIRA_B_BEACON.minPx },
      uViewportHeight: { value: 1 },
      uPixelRatio: { value: 1 },
      uColor: { value: new THREE.Color(MIRA_B_BEACON.color) },
      uIntensity: { value: MIRA_B_BEACON.intensity },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [radius]);

  useEffect(() => () => { geometry.dispose(); }, [geometry]);
  useEffect(() => () => { material.dispose(); }, [material]);

  const pointsRef = useRef<THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>>(null);
  useFrame((state) => {
    const mat = pointsRef.current?.material;
    if (!mat) return;
    mat.uniforms.uViewportHeight.value = state.size.height * state.viewport.dpr;
    mat.uniforms.uPixelRatio.value = state.viewport.dpr;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} raycast={() => {}} frustumCulled={false} />;
}
