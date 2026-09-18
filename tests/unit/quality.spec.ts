import { test, expect } from '@playwright/test';
import { detectQualityTier, explicitQualityPin } from '../../src/constants/quality';

const desktop = {
  qualityQuery: null,
  innerWidth: 1440,
  innerHeight: 900,
  deviceMemory: 8,
  hardwareConcurrency: 8,
};

test.describe('detectQualityTier', () => {
  test('an explicit ?quality= value pins any tier, overriding device hints', () => {
    expect(detectQualityTier({ ...desktop, qualityQuery: 'high' })).toBe('high');
    expect(detectQualityTier({ ...desktop, qualityQuery: 'mid' })).toBe('mid');
    expect(
      detectQualityTier({
        qualityQuery: 'high',
        innerWidth: 375,
        innerHeight: 812,
        deviceMemory: 2,
        hardwareConcurrency: 2,
      }),
    ).toBe('high');
  });

  test('an unrecognised ?quality= value falls back to device hints', () => {
    expect(detectQualityTier({ ...desktop, qualityQuery: 'ultra' })).toBe('high');
    expect(
      detectQualityTier({
        qualityQuery: 'ultra',
        innerWidth: 375,
        innerHeight: 812,
        deviceMemory: 8,
        hardwareConcurrency: 8,
      }),
    ).toBe('mid');
  });

  test('?quality=low always forces the light tier', () => {
    expect(detectQualityTier({ ...desktop, qualityQuery: 'low' })).toBe('low');
    expect(
      detectQualityTier({
        qualityQuery: 'low',
        innerWidth: 375,
        innerHeight: 812,
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
        innerHeight: 812,
        deviceMemory: 8,
        hardwareConcurrency: 8,
      }),
    ).toBe('mid');
  });

  test('landscape phone (wide, short side under 640) uses the mid tier', () => {
    expect(
      detectQualityTier({
        qualityQuery: null,
        innerWidth: 844,
        innerHeight: 390,
        hardwareConcurrency: 6,
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

  test('missing capability hints do not force a downgrade when both sides are large', () => {
    expect(
      detectQualityTier({
        qualityQuery: null,
        innerWidth: 1440,
        innerHeight: 900,
      }),
    ).toBe('high');
  });
});

test.describe('explicitQualityPin', () => {
  test('recognises the three tiers and nothing else', () => {
    expect(explicitQualityPin('low')).toBe('low');
    expect(explicitQualityPin('mid')).toBe('mid');
    expect(explicitQualityPin('high')).toBe('high');
    expect(explicitQualityPin('ultra')).toBeNull();
    expect(explicitQualityPin('')).toBeNull();
    expect(explicitQualityPin(null)).toBeNull();
  });
});
