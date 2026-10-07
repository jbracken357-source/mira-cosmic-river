import { test, expect } from '@playwright/test';
import { INFO_CARD, TRANSITIONS } from '../../src/constants/animation';

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

// 顶栏的结语退场与归来 (#90): when the epilogue appears the top bar lets go of
// the screen in about 0.3–0.5s — never the slow 1.2s re-entry the other way. The
// header reads these constants; the pins keep casual bumps off the values.
test.describe('the top bar’s epilogue exit', () => {
  test('stays within 0.3–0.5s', () => {
    expect(TRANSITIONS.TOP_BAR_EPILOGUE_EXIT).toBeGreaterThanOrEqual(0.3);
    expect(TRANSITIONS.TOP_BAR_EPILOGUE_EXIT).toBeLessThanOrEqual(0.5);
  });

  test('the return after the interrupt keeps its 1.2s', () => {
    expect(TRANSITIONS.TOP_BAR_EPILOGUE_RETURN).toBe(1.2);
  });
});
