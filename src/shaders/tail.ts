// Mira Tail Particle Shader - The hero shader
// 10,000+ particles forming a 13-light-year UV tail behind Mira A
// Mouse-reactive ripples, soft particles, warm pearl-to-blue gradient
//
// Star-light response mirrors the pure math in src/lib/riverLighting.ts (unit-tested there);
// keep the falloff and shadow-floor formulas in step with it.

import * as THREE from 'three';
import { MIRA_A_REACH, MIRA_B_REACH, MIRA_B_GAIN, RIVER_SHADOW_FLOOR } from '../lib/riverLighting';

export const TailVertexShader = `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec2 uMouse;
  uniform float uMouseInfluence;
  uniform float uParticleSize;
  uniform vec3 uMiraBPos;
  uniform vec3 uReach;  // x: Mira A reach, y: Mira B reach, z: Mira B gain

  attribute float aSeed;
  attribute float aSize;
  attribute float aLength;  // 0 = near star, 1 = far end of tail
  attribute float aSpread;  // lateral spread factor

  varying float vLength;
  varying float vSeed;
  varying float vAlpha;
  varying float vLight;   // combined light from the pair (riverLight)
  varying float vLightA;  // Mira A alone — drives the local gold accent
  varying float vLightB;  // Mira B alone — drives the cool pool around the companion

  // Simplex-like noise (simplified for performance)
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0)
    ) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0 / 7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = 1.79284291400159 - 0.85373472095314 *
      vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  // Mirrors starLightFalloff in src/lib/riverLighting.ts.
  float starLightFalloff(float dist, float reach) {
    float x = dist / reach;
    return 1.0 / (1.0 + x * x);
  }

  void main() {
    vLength = aLength;
    vSeed = aSeed;

    vec3 pos = position;

    // Organic noise-based displacement along the tail
    float timeScaled = uTime * 0.15;
    float noiseFreq = 0.3 + aLength * 0.5;
    float noiseAmp = 0.5 + aLength * 2.5 * aSpread;

    float nx = snoise(vec3(pos.x * noiseFreq * 0.1, timeScaled, aSeed)) * noiseAmp;
    float ny = snoise(vec3(pos.y * noiseFreq * 0.1, timeScaled + 1.0, aSeed + 100.0)) * noiseAmp * 0.3;
    float nz = snoise(vec3(pos.z * noiseFreq * 0.1, timeScaled + 2.0, aSeed + 200.0)) * noiseAmp;

    pos.x += nx;
    pos.y += ny;
    pos.z += nz;

    // Star light, computed on the displaced world position so the lit pool sits on the
    // stars even as the noise stirs the river. Mira A never leaves the origin.
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vLightA = starLightFalloff(length(worldPos.xyz), uReach.x);
    vLightB = starLightFalloff(distance(worldPos.xyz, uMiraBPos), uReach.y);
    vLight = min(1.0, vLightA + uReach.z * vLightB);

    // Mouse-reactive gravitational ripple
    vec4 screenPos = viewMatrix * worldPos;
    vec2 screenXY = screenPos.xy / -screenPos.z;
    float distToMouse = distance(screenXY, uMouse);
    float ripple = sin(distToMouse * 12.0 - uTime * 3.0) * exp(-distToMouse * 2.0);
    pos.x += ripple * uMouseInfluence * 0.5 * (1.0 - aLength * 0.5);
    pos.y += ripple * uMouseInfluence * 0.3 * (1.0 - aLength * 0.5);

    // Depth-based alpha (fades far particles into background)
    float depthFade = smoothstep(0.0, 0.15, aLength) * (1.0 - smoothstep(0.85, 1.0, aLength));
    vAlpha = depthFade * uOpacity;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Size attenuation: bigger near star, smaller at tail end
    float sizeFactor = (1.0 - aLength * 0.7) * aSize * uParticleSize;
    gl_PointSize = sizeFactor * (200.0 / -mvPosition.z);
  }
`;

export const TailFragmentShader = `
  uniform vec3 uColorNear;
  uniform vec3 uColorMid;
  uniform vec3 uColorFar;
  uniform vec3 uColorGold;   // pearl gold — local to Mira A's full light
  uniform vec3 uColorCool;   // white-dwarf blue — local to Mira B's pool
  uniform float uShadowFloor;
  uniform float uSkyGain;
  uniform float uSkyWarmth;

  varying float vLength;
  varying float vSeed;
  varying float vAlpha;
  varying float vLight;
  varying float vLightA;
  varying float vLightB;

  void main() {
    // Circular particle
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    float circle = exp(-dist * dist * 24.0) * (1.0 - smoothstep(0.3, 0.5, dist));

    // Color gradient: pearl at the star, quickly into muted violet, then blue. The warm
    // segment is deliberately short — the palette's gold stays local to the star light,
    // the river body is blue-violet.
    vec3 color;
    if (vLength < 0.3) {
      color = mix(uColorNear, uColorMid, vLength / 0.3);
    } else {
      color = mix(uColorMid, uColorFar, (vLength - 0.3) / 0.7);
    }

    // Subtle per-particle brightness variation
    float brightness = 0.85 + 0.15 * sin(vSeed * 6.2831);
    color *= brightness;

    // Lit near the stars, falling into structured (not black) shadow down the tail.
    // Mirrors riverBrightness in src/lib/riverLighting.ts.
    float level = uShadowFloor + (1.0 - uShadowFloor) * vLight;
    vec3 shadowTint = vec3(0.55, 0.62, 1.0); // shadow cools toward saturated blue-violet
    color *= level * mix(shadowTint, vec3(1.0), vLight);

    // Gold accents stay local to the primary; the companion adds a cool pool of its own.
    color = mix(color, uColorGold, 0.5 * vLightA * vLightA * (0.7 + uSkyWarmth));
    color = mix(color, uColorCool, vLightB * 0.45);

    // Real-time binding: the pulsation bends brightness and warmth, never switches off.
    // Half-strength warmth on the points: full warmth greys the violet into mud.
    color *= uSkyGain;
    color = mix(color, color * vec3(1.06, 0.96, 0.84), uSkyWarmth * 0.5);

    // Core glow: brighter near center of each particle
    float coreGlow = pow(circle, 1.5) * 0.4;
    color += coreGlow * vec3(1.0, 0.9, 0.8) * level;

    gl_FragColor = vec4(color, vAlpha * circle);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// Factory function to create the shader material
export function createTailMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uMouseInfluence: { value: 0 },
      uParticleSize: { value: 1.2 },
      uColorNear: { value: new THREE.Color('#e3bd8b') },
      uColorMid: { value: new THREE.Color('#a99ccc') },
      uColorFar: { value: new THREE.Color('#789ac2') },
      uColorGold: { value: new THREE.Color('#f2d8a8') },
      uColorCool: { value: new THREE.Color('#dbe6ff') },
      uMiraBPos: { value: new THREE.Vector3(0, 0, 0) },
      uReach: { value: new THREE.Vector3(MIRA_A_REACH, MIRA_B_REACH, MIRA_B_GAIN) },
      uShadowFloor: { value: RIVER_SHADOW_FLOOR },
      uSkyGain: { value: 1 },
      uSkyWarmth: { value: 0 },
    },
    vertexShader: TailVertexShader,
    fragmentShader: TailFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
