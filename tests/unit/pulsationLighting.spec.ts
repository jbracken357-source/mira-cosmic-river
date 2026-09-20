import { test, expect } from '@playwright/test';
import { pulsationLighting } from '../../src/lib/pulsationLighting';

const DIM = { brightness: 0, colorShift: 0 };
const BRIGHT = { brightness: 1, colorShift: 1 };

test.describe('pulsationLighting', () => {
  test('pins the four envelopes at the dim and bright ends', () => {
    expect(pulsationLighting(DIM)).toEqual({
      starFieldSky: 0.35,
      bloomIntensity: 0.18,
      bloomRadius: 0.28,
      miraAClock: 0.38,
    });
    expect(pulsationLighting(BRIGHT)).toEqual({
      starFieldSky: 1,
      bloomIntensity: 0.8,
      bloomRadius: 0.72,
      miraAClock: 1,
    });
  });

  test('star field, bloom intensity and Mira A clock climb with brightness', () => {
    let previous = pulsationLighting(DIM);
    for (let b = 0.05; b <= 1; b += 0.05) {
      const current = pulsationLighting({ brightness: b, colorShift: 0 });
      expect(current.starFieldSky).toBeGreaterThan(previous.starFieldSky);
      expect(current.bloomIntensity).toBeGreaterThan(previous.bloomIntensity);
      expect(current.miraAClock).toBeGreaterThan(previous.miraAClock);
      previous = current;
    }
  });

  test('bloom radius climbs with colour shift, not brightness', () => {
    const atDim = pulsationLighting({ brightness: 0, colorShift: 0.5 });
    const atBright = pulsationLighting({ brightness: 1, colorShift: 0.5 });
    expect(atDim.bloomRadius).toBe(atBright.bloomRadius);

    let previous = pulsationLighting(DIM).bloomRadius;
    for (let s = 0.05; s <= 1; s += 0.05) {
      const radius = pulsationLighting({ brightness: 0, colorShift: s }).bloomRadius;
      expect(radius).toBeGreaterThan(previous);
      previous = radius;
    }
  });

  test('stays in range across the cycle so the field never blacks out', () => {
    for (let b = 0; b <= 1; b += 0.1) {
      const light = pulsationLighting({ brightness: b, colorShift: b });
      expect(light.starFieldSky).toBeGreaterThan(0);
      expect(light.starFieldSky).toBeLessThanOrEqual(1);
      expect(light.bloomIntensity).toBeGreaterThan(0);
      expect(light.miraAClock).toBeGreaterThan(0);
      expect(light.miraAClock).toBeLessThanOrEqual(1);
    }
  });
});
