import { test, expect } from '@playwright/test';
import { INFO_CARD } from '../../src/constants/animation';

// Info card motion windows (#20): enter 180–240ms, exit 120–180ms. The components
// read these constants; this test pins the window so a casual bump cannot regress
// the acceptance criterion.
test.describe('info card motion windows', () => {
  test('enter duration stays within 180–240ms', () => {
    expect(INFO_CARD.ENTER).toBeGreaterThanOrEqual(0.18);
    expect(INFO_CARD.ENTER).toBeLessThanOrEqual(0.24);
  });

  test('exit duration stays within 120–180ms', () => {
    expect(INFO_CARD.EXIT).toBeGreaterThanOrEqual(0.12);
    expect(INFO_CARD.EXIT).toBeLessThanOrEqual(0.18);
  });
});
