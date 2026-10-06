// 下缘 (the lower edge) in free viewing: who holds the row, and for how long (#88).
//
// The closing line of the full cinematic (终幕那句 — the translations `subtitle`)
// does not unmount when the opening lands; it holds the lower edge and stays the
// row's default occupant. Three things can move it:
//
//   结语 (epilogue)  takes the whole screen: the closing line yields while the
//                    epilogue is up and returns when it leaves. Intentional input
//                    clears the epilogue only — never the closing line.
//   milestone hint   最亮/最暗 borrows the row for about MILESTONE_HINT_MS, once per
//                    cycle, then the closing line returns. The row never stacks the
//                    hint next to the closing line.
//   panel attention  tonight's save (and on mobile an open info card) owns the
//                    viewer's attention; the row hushes with the rest of the chrome.
//
// During the full cinematic itself the row stays empty: the closing line never
// appears early beneath the three captions, and while the final beat holds the
// same words they live in the upper third, not the lower edge.
import { CINEMATIC } from '../constants/animation';
import type { Language } from '../constants/translations';

export type LowerEdgeOwner = 'none' | 'closingLine' | 'milestone';

export interface LowerEdgeInput {
  introComplete: boolean;    // 自由观看 reached (direct entry starts here)
  epilogueText: boolean;     // the epilogue line itself is on screen
  milestoneShowing: boolean; // the milestone hint is inside its ~8s window
  panelAttention: boolean;   // a panel owns the viewer's attention
}

// The single authority for the row: at most one occupant, the closing line by default.
export function lowerEdgeOwner(input: LowerEdgeInput): LowerEdgeOwner {
  if (!input.introComplete) return 'none';
  if (input.epilogueText) return 'none';
  if (input.panelAttention) return 'none';
  return input.milestoneShowing ? 'milestone' : 'closingLine';
}

// 终幕那句的抵达 (#88): the closing line fades in only when the session actually
// passed through the final beat — the ≤0.5s settle (TRANSITIONS.CLOSING_LINE_SETTLE)
// belongs to that 终幕→下缘 transition alone. A session that started in free
// viewing (直达) — or one that cut the opening short before the final beat — has
// no final beat to arrive from, so the line is present from the first frame and
// there is nothing to fade.
export type ClosingLineArrival = 'present' | 'settle';

// The store publishes the opening's quantized mark, which lands on FINAL_TEXT the
// moment the final beat is shown and never goes past it.
export function closingLineArrival(cinematicMark: number): ClosingLineArrival {
  return cinematicMark >= CINEMATIC.FINAL_TEXT ? 'settle' : 'present';
}

export type MilestoneKind = 'maximum' | 'minimum';

export interface MilestoneArmInput {
  introComplete: boolean;
  milestone: MilestoneKind | 'none';
  shownBefore: boolean; // already remembered for this cycle
  armed: boolean;       // already armed in this viewing session
  dismissed: boolean;   // the ~8s window has closed
}

// Once per cycle, only in free viewing, and never again once the window has run.
// Returns the narrowed kind when the hint should arm, so callers need no cast.
export function armMilestone(input: MilestoneArmInput): MilestoneKind | null {
  if (!input.introComplete) return null;
  if (input.milestone === 'none') return null;
  if (input.shownBefore || input.armed || input.dismissed) return null;
  return input.milestone;
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
