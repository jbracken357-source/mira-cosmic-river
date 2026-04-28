// Accretion disk shader for Mira B (white dwarf)
// Thin glowing ring with hot spot where matter stream impacts

import * as THREE from 'three';

export const AccretionDisk_Shader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#e0e7ff') },
    uOpacity: { value: 0.7 },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;

    void main() {
      vUv = uv;
      vPosition = position;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uOpacity;

    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;

    void main() {
      // Ring distance from center
      float dist = length(vPosition.xy);
      float ring = smoothstep(0.0, 0.15, dist) * (1.0 - smoothstep(0.45, 0.5, dist));

      // Inner glow
      float innerGlow = exp(-dist * 4.0);

      // Hot spot - where matter stream hits (rotating)
      float angle = atan(vPosition.y, vPosition.x);
      float hotSpot = pow(max(0.0, cos(angle - uTime * 2.0)), 8.0) * 0.6;

      // Subtle turbulence
      float turb = 0.9 + 0.1 * sin(angle * 12.0 + uTime * 3.0);

      // Combine
      vec3 finalColor = uColor * ring * turb;
      finalColor += vec3(1.0, 0.95, 0.9) * innerGlow * 0.4;
      finalColor += vec3(1.0, 0.9, 0.7) * hotSpot * ring;

      float alpha = (ring * 0.8 + innerGlow * 0.3) * uOpacity;
      alpha += hotSpot * ring * 0.5 * uOpacity;

      gl_FragColor = vec4(finalColor, alpha);
    }
  `,
};
