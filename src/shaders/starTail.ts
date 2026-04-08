// Star Tail / Particle Trail Shader
// For the UV bow shock tail effect behind Mira A

import * as THREE from 'three';

// Particle tail shader for the UV bow shock effect
// Inspired by NASA GALEX imaging of Mira's 13-light-year tail
export const StarTail_Shader = {
  uniforms: {
    uTime: { value: 0 },
    uColorStart: { value: new THREE.Color('#7B2CBF') }, // Deep purple
    uColorEnd: { value: new THREE.Color('#00D4FF') },   // Electric blue
    uOpacity: { value: 0.8 },
    uTurbulence: { value: 0.3 },
  },
  vertexShader: `
    varying vec2 vUv;
    varying float vAge;
    varying float vNoise;
    uniform float uTime;
    uniform float uTurbulence;

    // Simple noise function
    float noise(vec3 p) {
      return fract(sin(dot(p, vec3(12.9898, 78.233, 45.5432))) * 43758.5453);
    }

    void main() {
      vUv = uv;

      // Particle age based on position (tail stretches behind star)
      vAge = uv.x;

      // Turbulence affects particle movement
      float turbulenceFactor = 0.5 + uTurbulence * 2.0;
      float timeOffset = uTime * turbulenceFactor;

      // Noise for organic particle movement
      float noiseVal = noise(vec3(position.x * 0.5, position.y * 0.5 + timeOffset, position.z * 0.5));
      vNoise = noiseVal;

      // Particles spread out as they age
      vec3 pos = position;
      pos.y += sin(vAge * 10.0 + timeOffset) * 0.1 * uTurbulence;
      pos.z += cos(vAge * 8.0 + timeOffset) * 0.1 * uTurbulence;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = (1.0 - vAge) * 3.0; // Particles fade at tail end
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying float vAge;
    varying float vNoise;
    uniform vec3 uColorStart;
    uniform vec3 uColorEnd;
    uniform float uOpacity;

    void main() {
      // Circular particle shape
      float strength = 1.0 - length(gl_PointCoord - vec2(0.5)) * 2.0;
      strength = smoothstep(0.0, 1.0, strength);

      // Color gradient along tail
      vec3 color = mix(uColorStart, uColorEnd, vAge);

      // Add noise variation for organic look
      color += vNoise * 0.2;

      // Fade at tail end
      float fade = 1.0 - smoothstep(0.7, 1.0, vAge);

      gl_FragColor = vec4(color, strength * uOpacity * fade);
    }
  `,
};

// Alternative: Stream line shader for continuous flow visualization
export const FlowStream_Shader = {
  uniforms: {
    uTime: { value: 0 },
    uFlowSpeed: { value: 1.0 },
    uColor: { value: new THREE.Color('#9333EA') },
    uOpacity: { value: 0.6 },
  },
  vertexShader: `
    varying vec2 vUv;
    varying float vFlow;

    void main() {
      vUv = uv;
      vFlow = uv.x;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying float vFlow;
    uniform float uTime;
    uniform float uFlowSpeed;
    uniform vec3 uColor;
    uniform float uOpacity;

    void main() {
      // Animated flow pattern
      float flow = sin(vFlow * 20.0 - uTime * uFlowSpeed);
      float alpha = 0.3 + 0.4 * smoothstep(-0.5, 1.0, flow);

      // Edge fade
      float edgeFade = 1.0 - abs(vUv.y - 0.5) * 2.0;
      alpha *= smoothstep(0.0, 1.0, edgeFade);

      gl_FragColor = vec4(uColor, alpha * uOpacity);
    }
  `,
};
