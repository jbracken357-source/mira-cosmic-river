// Mira A (Red Giant) Surface Shader
// Ported from mira-demo2/Mira-Demo2/components/MiraSystem.tsx

import * as THREE from 'three';

// Noise GLSL utility - simplex noise for shader surface variation
export const NOISE_GLSL = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    // First corner
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    // Permutations
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    // Gradients: 7x7 points over a square, mapped onto an octahedron.
    // The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
    float n_ = 0.142857142857; // 1.0/7.0
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  // mod(p,7*7)

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);    // mod(j,N)

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    // Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
`;

// Mira A Surface Shader with pulsation (332-day period scaled to ~8s visual)
export const MiraA_Shader = {
  uniforms: {
    uTime: { value: 0 },
    uColorCore: { value: new THREE.Color('#1a0500') },
    uColorSurface: { value: new THREE.Color('#0d0200') },
    uTurbulence: { value: 0.3 },
    uNoiseAmp: { value: 0.35 },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying float vNoise;
    uniform float uTime;
    uniform float uTurbulence;
    uniform float uNoiseAmp;

    ${NOISE_GLSL}

    void main() {
      vUv = uv;
      vNormal = normal;

      // Pulsation: 332-day period scaled to ~8 second visual rhythm
      float pulsePhase = sin(uTime * 0.785) * 0.5 + 0.5; // ~8s period
      float timeSpeed = uTime * (0.1 + uTurbulence * 1.5);
      float noiseAmp = uNoiseAmp * (0.8 + pulsePhase * 0.4);

      float lowFreq = snoise(position * (0.5 + uTurbulence * 1.0) + timeSpeed);
      float highFreq = snoise(position * (2.0 + uTurbulence * 2.0) - timeSpeed * 2.0);

      vNoise = lowFreq * 0.7 + highFreq * 0.3;

      // Radius pulsation
      float radiusPulse = 1.0 + 0.05 * sin(uTime * 0.785);
      vec3 newPos = position * radiusPulse + normal * (vNoise * noiseAmp);

      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying float vNoise;
    uniform vec3 uColorCore;
    uniform vec3 uColorSurface;
    uniform float uTime;

    void main() {
      // Fresnel effect for limb darkening
      float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);

      // Pulsation: brighter (whiter) at peak, redder at dim
      float pulsePhase = sin(uTime * 0.785) * 0.5 + 0.5;
      vec3 pulseColor = mix(
        uColorSurface * 0.8,  // dim = deeper red
        uColorCore * 1.2,     // bright = hotter/whiter
        pulsePhase
      );

      // Mix colors based on noise and pulsation
      vec3 color = mix(pulseColor, uColorCore, vNoise * 0.6 + 0.4);

      // Edge glow (subtle, not bright)
      color += vec3(0.6, 0.2, 0.05) * fresnel * 0.15;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

// Atmosphere Halo Shader for the glow effect around Mira A
export const Atmosphere_Shader = {
  uniforms: {
    uColor: { value: new THREE.Color('#331100') },
  },
  vertexShader: `
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    uniform vec3 uColor;
    void main() {
      float intensity = pow(0.6 - dot(vNormal, vec3(0, 0, 1.0)), 4.0);
      gl_FragColor = vec4(uColor, intensity * 0.3);
    }
  `,
};

// Mass Transfer Stream Shader - visualizes matter flowing from Mira A to Mira B
export const Stream_Shader = {
  uniforms: {
    uTime: { value: 0 },
    uColorStart: { value: new THREE.Color('#ff8c00') },
    uColorEnd: { value: new THREE.Color('#a78bfa') },
    uTurbulence: { value: 0.0 },
    uOpacity: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    varying float vNoise;
    uniform float uTime;
    uniform float uTurbulence;
    ${NOISE_GLSL}
    void main() {
      vUv = uv;
      // Turbulence increases noise frequency and speed massively
      float t = uTime * (1.0 + uTurbulence * 4.0);
      float amp = 0.1 + uTurbulence * 0.6;

      float noise = snoise(vec3(position.x * 2.0, position.y * 0.5 + t, position.z * 2.0));
      vNoise = noise;
      vec3 pos = position + normal * noise * amp;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying float vNoise;
    uniform vec3 uColorStart;
    uniform vec3 uColorEnd;
    uniform float uOpacity;

    void main() {
      // Gradient from A (bottom) to B (top)
      vec3 color = mix(uColorStart, uColorEnd, vUv.y);

      // Make it look like energy plasma
      float alpha = 0.4 + 0.6 * sin(vUv.y * 20.0 + vNoise * 5.0);

      // Fade edges
      float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
      alpha *= smoothstep(0.0, 0.5, edge);

      // Fade ends
      float endFade = smoothstep(0.0, 0.2, vUv.y) * (1.0 - smoothstep(0.8, 1.0, vUv.y));

      gl_FragColor = vec4(color, alpha * endFade * 0.8 * uOpacity);
    }
  `,
};
