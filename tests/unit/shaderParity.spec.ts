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
import { MiraA_Shader, HIGHLIGHT_SHOULDER_GLSL, PULSE_RATE } from '../../src/shaders/miraA';
import { AccretionDisk_Shader } from '../../src/shaders/accretionDisk';
import {
  SURFACE_DETAIL_FLOOR,
  PULSE_LIGHT_SWING,
  pulsationSurfaceLight,
  PULSE_CELL_LIFT_DIM,
  PULSE_CELL_LIFT_BRIGHT,
  pulsationCellLift,
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

  test('the photosphere light and hot network breathe with the pulsation phase (#87)', () => {
    const f = MiraA_Shader.fragmentShader;
    // Both curves run off the radius pulse's own sine, lifted to 0..1.
    expect(f).toContain(`float pulsePhase = sin(uTime * ${PULSE_RATE}) * .5 + .5;`);
    expect(f).toContain(`float cellLift = mix(${PULSE_CELL_LIFT_DIM}, ${PULSE_CELL_LIFT_BRIGHT}, pulsePhase);`);
    expect(f).toContain(`color += vec3(1.2, .58, .16) * pow(heat, 5.) * cellLift * detailStrength;`);
    expect(f).toContain(`float surfaceLight = 1. + ${PULSE_LIGHT_SWING} * (pulsePhase * 2. - 1.);`);
    expect(f).toContain('color *= surfaceLight * (.68 + .55 * uBrightness);');
  });

  test('the GLSL curves are the pure functions at theta = uTime * PULSE_RATE + pi/2', () => {
    // pulsePhase = sin(uTime * rate) * .5 + .5 is -cos(theta) * .5 + .5, so the two
    // GLSL expressions above must equal the TS functions value for value.
    for (const uTime of [0, 1.3, 4, 8, 12.7]) {
      const theta = uTime * PULSE_RATE + Math.PI / 2;
      const pulsePhase = 0.5 + 0.5 * Math.sin(uTime * PULSE_RATE);
      expect(pulsationSurfaceLight(theta)).toBeCloseTo(1 + PULSE_LIGHT_SWING * (pulsePhase * 2 - 1), 10);
      expect(pulsationCellLift(theta)).toBeCloseTo(
        PULSE_CELL_LIFT_DIM + (PULSE_CELL_LIFT_BRIGHT - PULSE_CELL_LIFT_DIM) * pulsePhase,
        10,
      );
    }
  });

  test('Mira B shares the same highlight shoulder snippet', () => {
    expect(miraBSource).toContain('${HIGHLIGHT_SHOULDER_GLSL}');
  });

  test('the companion density fades on its own and does not join the entry gate', () => {
    expect(miraBSource).toContain('companion-surface-density-v1.webp');
    expect(miraBSource).toContain('uSurfaceReady');
    expect(miraBSource).not.toContain('noteMaterial');
    // The companion stays a lit star (#87): its own lamp and rim light are what keep
    // the small body readable next to the giant; the hue evaluator in
    // binaryLighting.spec.ts mirrors these exact lines.
    expect(miraBSource).toContain('vec3 finalColor = color * intensity * pulse');
    expect(miraBSource).toContain('finalColor += vec3(1.0, 1.0, 1.0) * coreBright * mix(0.35, 0.16, weight)');
    expect(miraBSource).toContain('finalColor += vec3(0.8, 0.9, 1.0) * fresnel * 0.3');
    expect(miraBSource).toContain('finalColor = mix(finalColor, vec3(0.7, 0.85, 1.0), 0.15)');
    // The stretch has to land before the shoulder. After it, the same grains
    // compress into the hot core and the zoomed-in star goes flat white again.
    const grain = miraBSource.indexOf('finalColor *= mix(1.0, grain, weight)');
    const shoulder = miraBSource.indexOf('finalColor = highlightShoulder(finalColor)');
    expect(grain).toBeGreaterThan(-1);
    expect(shoulder).toBeGreaterThan(grain);
    expect(miraBSource).toContain('(density - 0.50) / 0.17');
    // Capture parks the fade at 1. That weight must wait until the map is bound,
    // or an unbound sampler is stretched into grain and a repeated capture drifts.
    const gate = miraBSource.indexOf('boundAt == null');
    const park = miraBSource.indexOf('materialFade(boundAt, performance.now())');
    expect(gate).toBeGreaterThan(-1);
    expect(park).toBeGreaterThan(gate);
    // The stamp belongs to the GPU upload, not the decode callback. A capture
    // that fades in a texture which has not uploaded yet drifts between visits.
    const upload = miraBSource.indexOf('loaded.onUpdate');
    const stamp = miraBSource.indexOf('surfaceBoundAtRef.current = performance.now()');
    expect(upload).toBeGreaterThan(-1);
    expect(stamp).toBeGreaterThan(upload);
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
