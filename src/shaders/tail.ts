// Mira Tail Particle Shader - The hero shader
// 10,000+ particles forming a 13-light-year UV tail behind Mira A
// Mouse-reactive gravitational ripples, depth fog, orange-to-UV-blue gradient

import * as THREE from 'three';

export const TailVertexShader = `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec2 uMouse;
  uniform float uMouseInfluence;
  uniform float uParticleSize;

  attribute float aSeed;
  attribute float aSize;
  attribute float aLength;  // 0 = near star, 1 = far end of tail
  attribute float aSpread;  // lateral spread factor

  varying float vLength;
  varying float vSeed;
  varying float vAlpha;

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

    // Mouse-reactive gravitational ripple
    vec4 screenPos = modelViewMatrix * vec4(pos, 1.0);
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
  uniform vec3 uColorNear;   // Orange near Mira A: #ff6b35
  uniform vec3 uColorMid;    // Transition: #a78bfa
  uniform vec3 uColorFar;    // UV blue at tail end: #4f46e5

  varying float vLength;
  varying float vSeed;
  varying float vAlpha;

  void main() {
    // Circular particle
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    float circle = 1.0 - smoothstep(0.3, 0.5, dist);

    // Color gradient: orange → violet → UV blue
    vec3 color;
    if (vLength < 0.5) {
      color = mix(uColorNear, uColorMid, vLength * 2.0);
    } else {
      color = mix(uColorMid, uColorFar, (vLength - 0.5) * 2.0);
    }

    // Subtle per-particle brightness variation
    float brightness = 0.85 + 0.15 * sin(vSeed * 6.2831);
    color *= brightness;

    // Core glow: brighter near center of each particle
    float coreGlow = pow(circle, 1.5) * 0.4;
    color += coreGlow * vec3(1.0, 0.9, 0.8);

    gl_FragColor = vec4(color, vAlpha * circle);
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
      uParticleSize: { value: 8.0 },
      uColorNear: { value: new THREE.Color('#ff6b35') },
      uColorMid: { value: new THREE.Color('#a78bfa') },
      uColorFar: { value: new THREE.Color('#4f46e5') },
    },
    vertexShader: TailVertexShader,
    fragmentShader: TailFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
