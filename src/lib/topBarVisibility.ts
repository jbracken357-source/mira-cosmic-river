// 顶栏 (#90): the free-viewing top bar as one pure verdict — which controls the
// bar holds, and when 「主视角」 exists at all.
//
// 自由观看第一眼 the bar is quiet: 环境音, 语言 and 完整开场 only, and those three
// are constants of the explore header — not this verdict's business. What the
// verdict decides is the conditional trio:
//
//   暂停 / 今晚的 Mira   appear with the first drag or zoom of the visit (the same
//                        scene manipulation that retires the gesture hint), and the
//                        next landing — 直达 or a ritual replay — starts quiet again.
//                        The graduation is per visit by design: the bar's first
//                        read stays three items no matter how well the viewer knows
//                        the gestures. (The hint is the opposite: 学会 is remembered
//                        across visits, so no 「?」 ever lingers.)
//   主视角               exists only while the camera sits off the main view — a
//                        drag, a zoom, the idle creep, the epilogue's interrupted
//                        flight — and is gone again once the viewer is back on it.
//
// The epilogue's hush of the whole bar (and its ~0.4s exit, TRANSITIONS.
// TOP_BAR_EPILOGUE_EXIT) is a rendering concern of the header, not of this verdict.
import { CAMERA, PORTRAIT_CAMERA } from '../constants/animation';

export interface TopBarInput {
  manipulated: boolean;      // the viewer dragged or zoomed the scene this visit
  awayFromMainView: boolean; // the camera sits off the explore framing
}

// Only the conditional controls are answered here; 环境音 / 语言 / 完整开场 never
// leave the free-viewing bar.
export interface TopBarVisibility {
  pause: boolean;
  tonightSave: boolean;
  returnToView: boolean;
}

export function topBarVisibility(input: TopBarInput): TopBarVisibility {
  return {
    pause: input.manipulated,
    tonightSave: input.manipulated,
    returnToView: input.awayFromMainView,
  };
}

// 镜头离开主视角: how far off the explore framing the camera must sit before
// 「主视角」 exists. Small enough that the idle creep (0.05 units/s) earns it
// within seconds of visible drift; large enough that the return flight's exact
// landing — and a damped drag's last quiver — never leaves it stuck on.
export const MAIN_VIEW_AWAY_TOLERANCE = 0.25;

export function cameraAwayFromMainView(
  position: readonly [number, number, number],
  portrait: boolean,
): boolean {
  const home = (portrait ? PORTRAIT_CAMERA : CAMERA).EXPLORE.position;
  return (
    Math.hypot(position[0] - home[0], position[1] - home[1], position[2] - home[2]) >
    MAIN_VIEW_AWAY_TOLERANCE
  );
}
