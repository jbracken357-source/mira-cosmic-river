// Accretion disk shader for Mira B (white dwarf)
// A glowing ring with a hot spot where the matter stream impacts.
//
// The ring is described in normalised radius (0 at the star, 1 at the disk's outer edge), so the
// geometry is a unit sphere squeezed into the disk's shape and the mesh scale decides how big
// the disk is. Every term here is O(1) per fragment.

import * as THREE from 'three';
import { COLORS } from '../constants/colors';

// Where the bright band sits and how wide the annulus is. Fractions of the disk's outer radius.
// The ring is deliberately thin against its own radius: a fat donut hugging the star reads as a
// glowing ball, not as a disk, however bright it is.
export const DISK_SHAPE = {
  inner: 0.5, // inner edge of the ring
  outer: 1.0, // outer edge of the ring
  band: 0.74, // radius of the brightest band
  bandWidth: 0.18,
} as const;

// The disk has to clear the bloom luminance threshold (0.9) to get any glow at all, so the band
// is authored above 1.0 and the hot spot well above it. (Both faces of the shell contribute, so
// these are lower than they would be for a single surface.)
export const DISK_GAIN = {
  ring: 1.3,
  hotSpot: 1.9,
  innerGlow: 0.3,
} as const;

// Shader materials take their uniforms object by assignment rather than by cloning, so each
// disk gets its own — otherwise the last material written to would drive both.
export function makeDiskUniforms(): Record<string, { value: unknown }> {
  return {
    uTime: { value: 0 },
    // Cool white-blue: the disk is the white dwarf's own accreted material, heated hard.
    uColor: { value: new THREE.Color(COLORS.ACCRETION_DISK) },
    // The stream coming off Mira A is the hottest thing here and lands white-hot.
    uHotColor: { value: new THREE.Color(COLORS.ACCRETION_DISK_HOT) },
    uOpacity: { value: 1.0 },
    // Local angle (radians) of the matter stream's impact, set from the real A→B direction.
    uImpactAngle: { value: 0 },
    uInner: { value: DISK_SHAPE.inner },
    uOuter: { value: DISK_SHAPE.outer },
    uBand: { value: DISK_SHAPE.band },
    uBandWidth: { value: DISK_SHAPE.bandWidth },
    uRingGain: { value: DISK_GAIN.ring },
    uHotGain: { value: DISK_GAIN.hotSpot },
    uInnerGlow: { value: DISK_GAIN.innerGlow },
  };
}

export const AccretionDisk_Shader = {
  vertexShader: `
    varying vec3 vPosition;

    void main() {
      // The unit sphere's equatorial plane is the disk; its radius across that plane is the
      // normalised disk radius the fragment shader works in.
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform vec3 uHotColor;
    uniform float uOpacity;
    uniform float uImpactAngle;
    uniform float uInner;
    uniform float uOuter;
    uniform float uBand;
    uniform float uBandWidth;
    uniform float uRingGain;
    uniform float uHotGain;
    uniform float uInnerGlow;

    varying vec3 vPosition;

    void main() {
      float r = length(vPosition.xz);
      float angle = atan(vPosition.z, vPosition.x);

      // Ring profile: a soft inner edge, a bright mid band, a soft outer edge. The inner and
      // outer edges are what make this read as a ring rather than a filled disc.
      float inner = smoothstep(uInner - 0.16, uInner + 0.04, r);
      float outer = 1.0 - smoothstep(uOuter - 0.22, uOuter, r);
      float band = exp(-pow((r - uBand) / uBandWidth, 2.0));
      float ring = inner * outer * (0.4 + 0.9 * band);

      // Doppler beaming: the side of the disk sweeping toward the viewer is brighter. Real
      // accretion disks are asymmetric for exactly this reason, and it stops the ring from
      // reading as a perfect sticker.
      float beam = 0.7 + 0.55 * cos(angle - 0.5);

      // Azimuthal structure: sheared streaks that rotate with the material.
      float streak = 0.86 + 0.14 * sin(angle * 9.0 + uTime * 1.7 + r * 5.0);

      // Hot spot where the stream from Mira A lands.
      float dAngle = angle - uImpactAngle;
      dAngle = atan(sin(dAngle), cos(dAngle));
      float spot = exp(-pow(dAngle / 0.42, 2.0)) * exp(-pow((r - 0.85) / 0.26, 2.0));

      vec3 color = uColor * ring * beam * streak * uRingGain;
      // Inner glow stays outside the hole, or the ring's centre fills in and it reads as a disc.
      color += uColor * uInnerGlow * exp(-max(r - uInner, 0.0) * 6.0) * smoothstep(0.12, uInner, r);
      color += uHotColor * spot * uHotGain;

      float alpha = clamp(ring * beam * 0.8 + spot * 0.95, 0.0, 1.0) * uOpacity;

      gl_FragColor = vec4(color, alpha);
    }
  `,
};
