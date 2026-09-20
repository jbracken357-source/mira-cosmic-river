import { test, expect } from '@playwright/test';
import { qualityBudget } from '../../src/lib/qualityBudget';
import type { QualityBudget } from '../../src/lib/qualityBudget';

// Literals from the #26 descent contract (docs/design-audit-2026-09-17/evidence/quality-26.md)
// plus the river veil counts that used to live beside it in RiverVeil. High and mid
// share decoration — including the veil — so the first step only spends bloom and dpr.
const HIGH: QualityBudget = {
  starCount: 5000,
  sphereSegments: 64,
  bloomLevels: 4,
  tailParticles: 10000,
  streamParticles: 600,
  veilVolumes: 7,
  veilAccents: 2,
  dpr: [1, 1.5],
};

const MID: QualityBudget = {
  starCount: 5000,
  sphereSegments: 64,
  bloomLevels: 2,
  tailParticles: 10000,
  streamParticles: 600,
  veilVolumes: 7,
  veilAccents: 2,
  dpr: 1,
};

const LOW: QualityBudget = {
  starCount: 300,
  sphereSegments: 16,
  bloomLevels: 1,
  tailParticles: 300,
  streamParticles: 150,
  veilVolumes: 2,
  veilAccents: 0,
  dpr: 1,
};

const DECORATION = [
  'starCount',
  'sphereSegments',
  'tailParticles',
  'streamParticles',
  'veilVolumes',
  'veilAccents',
] as const satisfies readonly (keyof QualityBudget)[];

const COSTS = [...DECORATION, 'bloomLevels'] as const;

function numeric(budget: QualityBudget, key: (typeof COSTS)[number]): number {
  return budget[key];
}

test.describe('qualityBudget', () => {
  test('pins the three rungs to the documented cost table', () => {
    expect(qualityBudget('high')).toEqual(HIGH);
    expect(qualityBudget('mid')).toEqual(MID);
    expect(qualityBudget('low')).toEqual(LOW);
  });

  test('low is a subset of mid is a subset of high', () => {
    const low = qualityBudget('low');
    const mid = qualityBudget('mid');
    const high = qualityBudget('high');
    for (const key of COSTS) {
      expect(numeric(low, key)).toBeLessThanOrEqual(numeric(mid, key));
      expect(numeric(mid, key)).toBeLessThanOrEqual(numeric(high, key));
    }
  });

  test('high → mid withdraws post-processing and resolution only', () => {
    const high = qualityBudget('high');
    const mid = qualityBudget('mid');
    for (const key of DECORATION) {
      expect(numeric(mid, key)).toBe(numeric(high, key));
    }
    expect(mid.bloomLevels).toBeLessThan(high.bloomLevels);
    expect(mid.dpr).toBe(1);
    expect(high.dpr).toEqual([1, 1.5]);
  });

  test('mid → low is where decoration is cut', () => {
    const mid = qualityBudget('mid');
    const low = qualityBudget('low');
    for (const key of DECORATION) {
      expect(numeric(low, key)).toBeLessThan(numeric(mid, key));
    }
    expect(low.bloomLevels).toBeLessThanOrEqual(mid.bloomLevels);
    expect(low.dpr).toBe(1);
  });
});
