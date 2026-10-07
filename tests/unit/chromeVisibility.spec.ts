import { test, expect } from '@playwright/test';
import { CAMERA, PORTRAIT_CAMERA } from '../../src/constants/animation';
import {
  cameraAwayFromMainView,
  MAIN_VIEW_AWAY_TOLERANCE,
  topBarChrome,
} from '../../src/lib/chromeVisibility';

// 顶栏 (#90): the free-viewing top bar as a pure verdict. 自由观看第一眼 the bar
// holds three controls only — 环境音, 语言, 完整开场 (the constants, not this
// verdict's business); the first drag or zoom of the visit graduates 暂停 and
// 今晚的 Mira; 主视角 exists only while the camera sits off the main view, and is
// gone again once the viewer is back on it.

test.describe('the quiet first look and the graduation', () => {
  test('the first look shows neither 暂停 nor 今晚的 Mira nor 主视角', () => {
    expect(topBarChrome({ manipulated: false, awayFromMainView: false })).toEqual({
      pause: false,
      tonightSave: false,
      returnToView: false,
    });
  });

  test('the first drag or zoom of the visit brings 暂停 and 今晚的 Mira', () => {
    const chrome = topBarChrome({ manipulated: true, awayFromMainView: false });
    expect(chrome.pause).toBe(true);
    expect(chrome.tonightSave).toBe(true);
    // Manipulation alone never conjures 主视角: the pair can fill the frame and the
    // camera still be home.
    expect(chrome.returnToView).toBe(false);
  });

  test('主视角 follows the camera alone: away shows it, back home hides it', () => {
    expect(topBarChrome({ manipulated: false, awayFromMainView: true }).returnToView).toBe(true);
    expect(topBarChrome({ manipulated: true, awayFromMainView: true })).toEqual({
      pause: true,
      tonightSave: true,
      returnToView: true,
    });
    // 回到之后没有.
    expect(topBarChrome({ manipulated: true, awayFromMainView: false }).returnToView).toBe(false);
  });
});

test.describe('cameraAwayFromMainView (镜头离开主视角)', () => {
  const explore = CAMERA.EXPLORE.position;

  test('the explore framing itself is home, in either orientation', () => {
    expect(cameraAwayFromMainView([...explore], false)).toBe(false);
    expect(cameraAwayFromMainView([...PORTRAIT_CAMERA.EXPLORE.position], true)).toBe(false);
  });

  test('a nudge inside the tolerance is still home; a real drag is away', () => {
    const nudged: [number, number, number] = [
      explore[0] + MAIN_VIEW_AWAY_TOLERANCE / 2,
      explore[1],
      explore[2],
    ];
    expect(cameraAwayFromMainView(nudged, false)).toBe(false);

    const dragged: [number, number, number] = [explore[0] + 3, explore[1] - 2, explore[2] + 1];
    expect(cameraAwayFromMainView(dragged, false)).toBe(true);
  });

  test('the tolerance stays small enough that the idle creep earns 主视角 quickly', () => {
    // The idle advance runs at 0.05 units/s: 主视角 must appear within seconds of
    // visible drift, not minutes — and after the return flight's exact landing it
    // must be gone.
    expect(MAIN_VIEW_AWAY_TOLERANCE).toBeGreaterThanOrEqual(0.1);
    expect(MAIN_VIEW_AWAY_TOLERANCE).toBeLessThanOrEqual(0.5);
  });

  test('a portrait framing is measured against the portrait main view', () => {
    // The portrait explore pose is far from the landscape one: judged against the
    // wrong table it would read as away forever.
    expect(cameraAwayFromMainView([...PORTRAIT_CAMERA.EXPLORE.position], true)).toBe(false);
    expect(cameraAwayFromMainView([...explore], true)).toBe(true);
  });
});
