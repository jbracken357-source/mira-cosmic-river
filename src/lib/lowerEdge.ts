// 下缘 (the lower edge) in free viewing: who holds the row, and for how long (#88).
//
// The closing line of the full cinematic (终幕那句 — the translations `subtitle`)
// does not unmount when the opening lands; it settles at the lower edge and stays
// the row's default occupant. Three things can move it:
//
//   结语 (epilogue)  takes the whole screen: the tagline yields while the line is up
//                    and returns when it leaves. Intentional input clears the
//                    epilogue only — never the tagline.
//   milestone hint   最亮/最暗 borrows the row for about MILESTONE_HINT_MS, once per
//                    cycle, then the tagline returns. The row never stacks the hint
//                    next to the tagline.
//   panel attention  tonight's save (and on mobile an open info card) owns the
//                    viewer's attention; the row hushes with the rest of the chrome.
//
// During the full cinematic itself the row stays empty: the tagline never appears
// early beneath the three captions, and while the final beat holds the same words
// they live in the upper third, not the lower edge.
import type { Language } from '../constants/translations';

export type LowerEdgeOwner = 'none' | 'tagline' | 'milestone';

export interface LowerEdgeInput {
  introComplete: boolean;    // 自由观看 reached (direct entry starts here)
  epilogueText: boolean;     // the epilogue line itself is on screen
  milestoneShowing: boolean; // the milestone hint is inside its ~8s window
  panelAttention: boolean;   // a panel owns the viewer's attention
}

// The single authority for the row: at most one occupant, tagline by default.
export function lowerEdgeOwner(input: LowerEdgeInput): LowerEdgeOwner {
  if (!input.introComplete) return 'none';
  if (input.epilogueText) return 'none';
  if (input.panelAttention) return 'none';
  return input.milestoneShowing ? 'milestone' : 'tagline';
}

// 约 8 秒: how long the milestone hint holds the lower edge before the tagline returns.
export const MILESTONE_HINT_MS = 8000;

export interface MilestoneArmInput {
  introComplete: boolean;
  milestone: 'maximum' | 'minimum' | 'none';
  shownBefore: boolean; // already remembered for this cycle
  armed: boolean;       // already armed in this viewing session
  dismissed: boolean;   // the ~8s window has closed
}

// Once per cycle, only in free viewing, and never again once the window has run.
export function shouldArmMilestone(input: MilestoneArmInput): boolean {
  return (
    input.introComplete &&
    input.milestone !== 'none' &&
    !input.shownBefore &&
    !input.armed &&
    !input.dismissed
  );
}

// 结语 line breaks: zh cuts after the first 句号 so the second line opens with
// 「而我的星尘」 and 「星尘」 is never split; en cuts after "starstuff.". Joining the
// two lines back (with a space in en) reproduces the full sentence.
export function splitEpilogue(message: string, language: Language): [string, string] {
  const marker = language === 'ch' ? '。' : 'starstuff.';
  const at = message.indexOf(marker);
  if (at < 0) return [message, ''];
  const cut = at + marker.length;
  return [message.slice(0, cut), message.slice(cut).trimStart()];
}

// The word the epilogue must never break across lines; the renderer wraps every
// occurrence in a no-wrap span.
export function epilogueToken(language: Language): string {
  return language === 'ch' ? '星尘' : 'starstuff';
}
