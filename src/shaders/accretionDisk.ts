// Accretion disk shader for Mira B (white dwarf)
// Broken, glowing accretion arcs with a hot spot where the matter stream impacts.
//
// The ring is described in normalised radius (0 at the star, 1 at the disk's outer edge), so the
// geometry is a unit sphere squeezed into the disk's shape and the mesh scale decides how big
// the disk is. Every term here is O(1) per fragment.

import * as THREE from 'three';
import { COLORS } from '../constants/colors';
import {
  DISK_ARC_TRACE,
  IMPACT_ARC_WIDTH,
  WAKE_ARC_OFFSET,
  WAKE_ARC_WIDTH,
  WAKE_ARC_GAIN,
  ARC_CLUMP_FLOOR,
  HOT_SPOT_ANGLE_WIDTH,
  HOT_SPOT_RADIUS,
  HOT_SPOT_RADIAL_WIDTH,
} from '../lib/binaryLighting';

// Where the bright band sits and how wide the annulus is. Fractions of the disk's outer radius.
// The radial band stays thin, while its azimuthal arc is deliberately incomplete so it reads as
// flowing matter rather than a diagram-like orbit.
export const DISK_SHAPE = {
  inner: 0.5, // inner edge of the ring
  outer: 1.0, // outer edge of the ring
  band: 0.74, // radius of the brightest band
  bandWidth: 0.24,
} as const;

// Both faces contribute. Restrained gains retain the sheared gas detail instead
// of turning the entire disk into a white bloom halo.
export const DISK_GAIN = {
  ring: 0.46,
  hotSpot: 0.65,
  innerGlow: 0.1,
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

    // Mirrors wrapAngle and gaussFalloff in src/lib/binaryLighting.ts.
    float wrapAngle(float a) { return atan(sin(a), cos(a)); }
    float gaussFalloff(float x, float width) { float q = x / width; return exp(-q * q); }

    void main() {
      float r = length(vPosition.xz);
      float angle = atan(vPosition.z, vPosition.x);

      // Ring profile: a soft inner edge, a bright mid band, a soft outer edge. The inner and
      // outer edges are what make this read as a ring rather than a filled disc.
      float inner = smoothstep(uInner - 0.16, uInner + 0.04, r);
      float outer = 1.0 - smoothstep(uOuter - 0.22, uOuter, r);
      float flowingBand = uBand + .06 * sin(angle * 3. - uTime * .25);
      float band = exp(-pow((r - flowingBand) / uBandWidth, 2.0));
      float ring = inner * outer * (0.4 + 0.9 * band);

      // Mirrors arcEnvelope in src/lib/binaryLighting.ts: two broad, incomplete arcs over a
      // faint dust trace — the inflow lights its landing region, and the rest of the orbit
      // never closes into a diagram-like circle.
      float impactArc = gaussFalloff(wrapAngle(angle - uImpactAngle), ${IMPACT_ARC_WIDTH});
      float wakeArc = ${WAKE_ARC_GAIN} * gaussFalloff(wrapAngle(angle - uImpactAngle - ${WAKE_ARC_OFFSET}), ${WAKE_ARC_WIDTH});
      float arc = ${DISK_ARC_TRACE} + ${1 - DISK_ARC_TRACE} * clamp(impactArc + wakeArc, 0.0, 1.0);
      // Mirrors arcClump: inside the arcs the gas breaks into intermittent clumps.
      arc *= ${ARC_CLUMP_FLOOR} + ${1 - ARC_CLUMP_FLOOR} * smoothstep(.2, .8, (.5 + .5 * sin(angle * 3. + 1.7 + uTime * .22)) * (.5 + .5 * sin(angle * 7. - uTime * .9)));
      ring *= arc;

      // Doppler beaming: the side of the disk sweeping toward the viewer is brighter. Real
      // accretion disks are asymmetric for exactly this reason, and it stops the ring from
      // reading as a perfect sticker.
      float beam = 0.7 + 0.55 * cos(angle - 0.5);

      // Azimuthal structure: sheared streaks that rotate with the material.
      float streak = 0.65 + 0.35 * sin(angle * 5.0 - uTime * .5 + r * 24.0);

      // Mirrors hotSpotProfile in src/lib/binaryLighting.ts: the hot spot sits where the
      // stream from Mira A lands.
      float spot = gaussFalloff(wrapAngle(angle - uImpactAngle), ${HOT_SPOT_ANGLE_WIDTH}) * gaussFalloff(r - ${HOT_SPOT_RADIUS}, ${HOT_SPOT_RADIAL_WIDTH});

      vec3 color = uColor * ring * beam * streak * uRingGain;
      // Inner glow stays outside the hole, or the ring's centre fills in and it reads as a disc.
      color += uColor * uInnerGlow * arc * exp(-max(r - uInner, 0.0) * 6.0) * smoothstep(0.12, uInner, r);
      color += uHotColor * spot * uHotGain;

      float alpha = clamp(ring * beam * 0.48 + spot * 0.35, 0.0, 1.0) * uOpacity;

      gl_FragColor = vec4(color, alpha);
    }
  `,
};
