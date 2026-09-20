// GLSL ↔ TS parity guard: the shaders in src/shaders/tail.ts and RiverVeil.tsx mirror the
// pure math in src/lib/riverLighting.ts. The star reaches, companion gain, and shadow
// floor reach the GPU as uniforms, so the guard checks the wiring; the veil's light
// response lives inside the GLSL itself, so the guard checks the mirrored literals.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  MIRA_A_REACH,
  MIRA_B_REACH,
  MIRA_B_GAIN,
  RIVER_SHADOW_FLOOR,
  VEIL_SHADOW_RETAIN,
  VEIL_LIGHT_LIFT,
  veilLightResponse,
} from '../../src/lib/riverLighting';
import { TailVertexShader, TailFragmentShader, createTailMaterial } from '../../src/shaders/tail';
import { MiraA_Shader, Atmosphere_Shader, HIGHLIGHT_SHOULDER_GLSL } from '../../src/shaders/miraA';
import { pulsationLighting } from '../../src/lib/pulsationLighting';
import { AccretionDisk_Shader } from '../../src/shaders/accretionDisk';
import {
  SURFACE_DETAIL_FLOOR,
  HIGHLIGHT_KNEE,
  HIGHLIGHT_CEILING,
  DISK_ARC_TRACE,
  IMPACT_ARC_WIDTH,
  WAKE_ARC_OFFSET,
  WAKE_ARC_WIDTH,
  WAKE_ARC_GAIN,
  ARC_CLUMP_FLOOR,
  HOT_SPOT_ANGLE_WIDTH,
  HOT_SPOT_RADIUS,
  HOT_SPOT_RADIAL_WIDTH,
} from '../../src/lib/binaryLighting';

const veilSource = readFileSync(
  path.join(process.cwd(), 'src/components/Scene/RiverVeil.tsx'),
  'utf8',
);

const miraBSource = readFileSync(
  path.join(process.cwd(), 'src/components/Scene/MiraB.tsx'),
  'utf8',
);

// GLSL writes fractional literals without the leading zero (.75, not 0.75).
function glslLiteral(value: number): string {
  return String(value).replace(/^0\./, '.');
}

test.describe('tail shader stays in step with riverLighting', () => {
  test('the star reaches, companion gain, and shadow floor arrive as uniforms', () => {
    const material = createTailMaterial();
    expect(material.uniforms.uReach.value.toArray()).toEqual([MIRA_A_REACH, MIRA_B_REACH, MIRA_B_GAIN]);
    expect(material.uniforms.uShadowFloor.value).toBe(RIVER_SHADOW_FLOOR);
    material.dispose();
  });

  test('the GLSL mirrors the falloff and shadow-floor formulas', () => {
    expect(TailVertexShader).toContain('float x = dist / reach;');
    expect(TailVertexShader).toContain('return 1.0 / (1.0 + x * x);');
    expect(TailFragmentShader).toContain('uShadowFloor + (1.0 - uShadowFloor) * vLight');
  });
});

test.describe('veil shader stays in step with riverLighting', () => {
  test('the veil wires the same star reaches and companion gain', () => {
    expect(veilSource).toContain('uReach: { value: new THREE.Vector3(MIRA_A_REACH, MIRA_B_REACH, MIRA_B_GAIN) }');
  });

  test('the veil light response literals match the exported constants', () => {
    expect(veilSource).toContain(`${glslLiteral(VEIL_SHADOW_RETAIN)} + ${glslLiteral(VEIL_LIGHT_LIFT)} * light`);
    // The constants really are the response's endpoints: shadow keeps three quarters of
    // the body, full light lifts it by a third.
    expect(veilLightResponse(0)).toBeCloseTo(VEIL_SHADOW_RETAIN, 10);
    expect(veilLightResponse(1)).toBeCloseTo(VEIL_SHADOW_RETAIN + VEIL_LIGHT_LIFT, 10);
  });

  test('the GLSL mirrors the falloff formula', () => {
    expect(veilSource).toContain('return 1.0 / (1.0 + x * x);');
  });
});

test.describe('Mira A shader stays in step with binaryLighting', () => {
  test('the surface detail constants arrive in the GLSL', () => {
    const f = MiraA_Shader.fragmentShader;
    expect(f).toContain(`${SURFACE_DETAIL_FLOOR} + ${1 - SURFACE_DETAIL_FLOOR} * smoothstep(.3, .75, region)`);
    expect(f).toContain('.45 + .55 * smoothstep(.05, .5, mu)');
  });

  test('the highlight shoulder snippet mirrors the pure function', () => {
    expect(HIGHLIGHT_SHOULDER_GLSL).toContain(`float head = ${HIGHLIGHT_CEILING - HIGHLIGHT_KNEE};`);
    expect(HIGHLIGHT_SHOULDER_GLSL).toContain(`max(c - ${HIGHLIGHT_KNEE}, 0.0)`);
    expect(HIGHLIGHT_SHOULDER_GLSL).toContain('1.0 - exp(-over / head)');
    expect(MiraA_Shader.fragmentShader).toContain(HIGHLIGHT_SHOULDER_GLSL);
  });

  test('Mira B shares the same highlight shoulder snippet', () => {
    expect(miraBSource).toContain('${HIGHLIGHT_SHOULDER_GLSL}');
  });
});

test.describe('Mira A halo clock stays in step with pulsationLighting', () => {
  test('the GLSL envelope is the same curve the rest of the scene consumes', () => {
    expect(Atmosphere_Shader.fragmentShader).toContain('0.38 + 0.62 * uBrightness');
    expect(pulsationLighting({ brightness: 0, colorShift: 0 }).miraAClock).toBe(0.38);
    expect(pulsationLighting({ brightness: 1, colorShift: 0 }).miraAClock).toBe(1);
  });
});

test.describe('accretion disk shader stays in step with binaryLighting', () => {
  const f = AccretionDisk_Shader.fragmentShader;

  test('the arc envelope mirrors the pure constants', () => {
    expect(f).toContain(`gaussFalloff(wrapAngle(angle - uImpactAngle), ${IMPACT_ARC_WIDTH})`);
    expect(f).toContain(`${WAKE_ARC_GAIN} * gaussFalloff(wrapAngle(angle - uImpactAngle - ${WAKE_ARC_OFFSET}), ${WAKE_ARC_WIDTH})`);
    expect(f).toContain(`${DISK_ARC_TRACE} + ${1 - DISK_ARC_TRACE} * clamp(impactArc + wakeArc, 0.0, 1.0)`);
  });

  test('the clumps and the hot spot mirror the pure constants', () => {
    expect(f).toContain(`${ARC_CLUMP_FLOOR} + ${1 - ARC_CLUMP_FLOOR} * smoothstep(.2, .8,`);
    // arcClump's two wave shapes: frequencies, phase offset, and drift rates pinned as written.
    expect(f).toContain('(.5 + .5 * sin(angle * 3. + 1.7 + uTime * .22)) * (.5 + .5 * sin(angle * 7. - uTime * .9))');
    expect(f).toContain(`gaussFalloff(wrapAngle(angle - uImpactAngle), ${HOT_SPOT_ANGLE_WIDTH})`);
    expect(f).toContain(`gaussFalloff(r - ${HOT_SPOT_RADIUS}, ${HOT_SPOT_RADIAL_WIDTH})`);
  });
});
