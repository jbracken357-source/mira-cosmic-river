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

const veilSource = readFileSync(
  path.join(process.cwd(), 'src/components/Scene/RiverVeil.tsx'),
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

  test('the veil GLSL mirrors the falloff formula', () => {
    expect(veilSource).toContain('return 1.0 / (1.0 + x * x);');
  });
});
