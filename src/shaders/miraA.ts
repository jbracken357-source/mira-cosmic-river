// Mira A (Red Giant) Surface Shader
// Ported from mira-demo2/Mira-Demo2/components/MiraSystem.tsx

import * as THREE from 'three';
import { COLORS } from '../constants/colors';

// One decorative pulsation rate for the whole star: the surface radius, the surface colour and
// the atmosphere all breathe together, or the halo detaches from the star. (Shader strings are
// built at module load, so these have to be declared before the shaders that interpolate them.)
const PULSE_RATE = 0.785; // ~8s cycle
/** Radius pulse of Mira A's decorative cycle. Exported so MiraA.tsx's shells breathe with it. */
export const MIRA_A_PULSE_AMPLITUDE = 0.09; // 9% of the radius come and gone each cycle

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
    uBrightness: { value: 0.5 },
    uColorShift: { value: 0.5 },
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
      // View-space normal: the disc shading below has to follow the camera, not the model,
      // or the star reads as a flat patty that only rotates its own sticker.
      vNormal = normalize(normalMatrix * normal);

      // Pulsation: 332-day period scaled to ~8 second visual rhythm
      float pulsePhase = sin(uTime * ${PULSE_RATE}) * 0.5 + 0.5; // ~8s period
      float timeSpeed = uTime * (0.1 + uTurbulence * 1.5);
      float noiseAmp = uNoiseAmp * (0.8 + pulsePhase * 0.4);

      float lowFreq = snoise(position * (0.5 + uTurbulence * 1.0) + timeSpeed);
      float highFreq = snoise(position * (2.0 + uTurbulence * 2.0) - timeSpeed * 2.0);

      vNoise = lowFreq * 0.7 + highFreq * 0.3;

      // Radius pulsation. Visible: the viewer has to see the star breathe, so the swing is
      // close to a tenth of the radius rather than a hairline.
      float radiusPulse = 1.0 + ${MIRA_A_PULSE_AMPLITUDE} * sin(uTime * ${PULSE_RATE});
      // Granulation is displacement, not the silhouette: keeping it well under the pulse
      // amplitude leaves a round limb to darken instead of a wobbling potato.
      vec3 newPos = position * radiusPulse + normal * (vNoise * noiseAmp * 0.38);

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
    uniform float uBrightness;
    uniform float uColorShift;

    void main() {
      // Limb darkening: a red giant is brightest at the disc centre and falls off toward the
      // limb because you are looking through less photosphere there. Without this the star is
      // a uniformly filled circle.
      float mu = clamp(abs(normalize(vNormal).z), 0.0, 1.0);

      // Pulsation: the decorative cycle swings brightness hard, and the hue swings with it —
      // deep red at the trough, a hotter red-orange at the peak. Both ends stay inside the red
      // end of the palette: the star is a cool red giant, and a peak that reads pink or salmon
      // is a bug, not a highlight.
      float pulsePhase = sin(uTime * ${PULSE_RATE}) * 0.5 + 0.5;
      vec3 dimColor = mix(uColorCore, uColorSurface, 0.02) * 0.42;
      vec3 hotColor = mix(uColorCore, uColorSurface, 0.1) * 1.25;
      vec3 pulseColor = mix(dimColor, hotColor, pulsePhase);

      // Granulation mottles the photosphere, but the deep core colour stays in the mix: this
      // is a cool red giant, not a peach-coloured ball.
      float mottle = vNoise * 0.5 + 0.5;
      vec3 color = mix(uColorCore, pulseColor, 0.55 + 0.35 * mottle);

      // Limb darkening, then a thin warm rim right at the edge.
      color *= mix(0.5, 1.15, pow(mu, 0.6));
      color += vec3(0.55, 0.16, 0.03) * pow(1.0 - mu, 3.0) * 0.22;

      // The 8s pulse above is decorative. uBrightness and uColorShift are the real-clock
      // pulsation, and they are the only thing that differs between tonight and next month: a
      // hot, near-white star at maximum against a dim deep red one at minimum.
      vec3 skyTint = mix(vec3(0.55, 0.10, 0.02), vec3(1.18, 0.98, 0.85), uColorShift);
      color *= skyTint * (0.58 + 0.62 * uBrightness);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

// Shader materials get their uniforms object by assignment, not by cloning, so every shell
// asks for its own set. Sharing one object between shells would make whichever material was
// written to last decide the glow of both.
export function makeAtmosphereUniforms(overrides: {
  color: THREE.Color | string;
  shellRadius: number;
  /**
   * Radius of the star inside the shell. Omit for a shell with nothing to occlude — a haze in
   * open space — where the glow is then thickest at the centre of the shell rather than
   * building towards a silhouette it does not have.
   */
  coreRadius?: number;
  opacity: number;
  falloff: number;
  pulseAmp?: number;
}): Record<string, { value: unknown }> {
  return {
    uColor: { value: new THREE.Color(overrides.color) },
    uBrightness: { value: 0.5 },
    uTime: { value: 0 },
    uOpacity: { value: overrides.opacity },
    uFalloff: { value: overrides.falloff },
    uShellRadius: { value: overrides.shellRadius },
    uCoreRadius: { value: overrides.coreRadius ?? 0 },
    uPulseAmp: { value: overrides.pulseAmp ?? 0 },
  };
}

// Mira A's atmosphere, as two shells a viewer reads as one volume: a dense layer hugging the
// photosphere and a wide thin haze that gives the star its reach on screen. `falloff` is the
// exponential rate at which each shell's glow dies away between the limb and the shell edge —
// a low rate for the wide haze, a high one for the dense layer.
export const MIRA_A_ATMOSPHERE = {
  mid: { scale: 1.4, opacity: 0.46, falloff: 2.4, color: COLORS.MIRA_A_ATMOSPHERE_DENSE },
  outer: { scale: 2.35, opacity: 0.3, falloff: 1.7, color: COLORS.MIRA_A_ATMOSPHERE_HAZE },
} as const;

// Mira B's corona: same shader, white dwarf colours, a much tighter shell. Kept small on
// purpose — a broad halo around the companion buries the accretion disk behind it.
export const MIRA_B_CORONA = {
  scale: 1.7,
  opacity: 0.26,
  falloff: 1.7,
  color: COLORS.MIRA_B_CORONA,
  pulseAmp: 0.015,
} as const;

// Glow shell shader, shared by Mira A's atmosphere, Mira B's corona and the tail's haze. The
// uniforms come from makeAtmosphereUniforms — there are no defaults here to drift out of step
// with it — and GlowShell renders the geometry.
//
// A single shell cannot be a volume, but it can fake one: every fragment works out which
// sight-line it sits on, and how far along the shell that line passes. The glow is thickest
// right at the star's limb — the longest path through the gas — and dies away exponentially
// out to the shell's edge, so the halo has a wide, soft falloff instead of a rim.
export const Atmosphere_Shader = {
  vertexShader: `
    varying vec3 vViewPos;
    varying vec3 vCentre;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vViewPos = mv.xyz;
      // Every vertex of the shell is the same distance from the shell's centre, so the centre
      // in view space is a constant we can compute here. (modelViewMatrix is vertex-stage only
      // in three.js; using it in the fragment shader fails to compile.)
      vCentre = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    varying vec3 vViewPos;
    varying vec3 vCentre;
    uniform vec3 uColor;
    uniform float uBrightness;
    uniform float uTime;
    uniform float uOpacity;
    uniform float uFalloff;
    uniform float uShellRadius;
    uniform float uCoreRadius;
    uniform float uPulseAmp;

    void main() {
      vec3 dir = normalize(vViewPos);

      // Impact parameter: how far this sight-line passes from the star's centre.
      float b = length(vCentre - dot(vCentre, dir) * dir);

      // The limb breathes with the star it wraps.
      float pulse = sin(uTime * ${PULSE_RATE}) * 0.5 + 0.5;
      float core = uCoreRadius * (1.0 + uPulseAmp * (pulse * 2.0 - 1.0));

      // Thickness of the shell along this line of sight, 0 at the shell's own edge and 1 right
      // at the limb, then faded so the shell's outline never shows as an edge. That gradient —
      // over more than the star's own radius — is the whole volume effect.
      float inner = clamp(core / uShellRadius, 0.0, 1.0);
      float span = max(1.0 - inner, 0.001);
      float across = clamp((b / uShellRadius - inner) / span, 0.0, 1.0);
      // Faded to nothing over its own outer third: an exponential that is simply cut off at the
      // shell radius leaves a visible circle in the sky, which is how a volume starts to look
      // like a stack of discs again.
      float glow = exp(-uFalloff * across) * (1.0 - smoothstep(0.68, 1.0, across));

      // Slow, cheap wobble so the halo is not a perfect surface of revolution.
      float ripple = 1.0 + 0.07 * sin(dir.y * 9.0 + uTime * 0.7) * sin(dir.x * 7.0 - uTime * 0.5);

      // Still a halo at the dimmest end of the real cycle — the star must stay findable — but
      // unmistakably larger and brighter at maximum, and breathing with the decorative pulse
      // so the star's radius change is visible in its atmosphere and not only in the photosphere.
      float clock = 0.38 + 0.62 * uBrightness;
      float intensity = glow * ripple * clock * (0.7 + 0.5 * pulse);

      gl_FragColor = vec4(uColor, intensity * uOpacity);
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
