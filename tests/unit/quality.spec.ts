import { test, expect } from '@playwright/test';
import { detectQualityTier } from '../../src/constants/quality';

const desktop = {
  qualityQuery: null,
  innerWidth: 1440,
  deviceMemory: 8,
  hardwareConcurrency: 8,
};

test.describe('detectQualityTier', () => {
  test('?quality=low always forces the light tier', () => {
    expect(detectQualityTier({ ...desktop, qualityQuery: 'low' })).toBe('low');
    expect(
      detectQualityTier({
        qualityQuery: 'low',
        innerWidth: 375,
        deviceMemory: 8,
        hardwareConcurrency: 8,
      }),
    ).toBe('low');
  });

  test('very constrained memory uses the light tier', () => {
    expect(detectQualityTier({ ...desktop, deviceMemory: 2 })).toBe('low');
    expect(detectQualityTier({ ...desktop, deviceMemory: 1 })).toBe('low');
  });

  test('mobile width uses the mid tier, not low', () => {
    expect(
      detectQualityTier({
        qualityQuery: null,
        innerWidth: 375,
        deviceMemory: 8,
        hardwareConcurrency: 8,
      }),
    ).toBe('mid');
  });

  test('mid-range memory or few cores use the mid tier', () => {
    expect(detectQualityTier({ ...desktop, deviceMemory: 4 })).toBe('mid');
    expect(detectQualityTier({ ...desktop, hardwareConcurrency: 4 })).toBe('mid');
  });

  test('a capable desktop stays on the high tier', () => {
    expect(detectQualityTier(desktop)).toBe('high');
  });

  test('missing capability hints do not force a downgrade', () => {
    expect(
      detectQualityTier({
        qualityQuery: null,
        innerWidth: 1440,
      }),
    ).toBe('high');
  });
});
