import { test, expect } from '@playwright/test';
import {
  MILESTONE_HINT_MS,
  epilogueToken,
  lowerEdgeOwner,
  shouldArmMilestone,
  splitEpilogue,
} from '../../src/lib/lowerEdge';
import { TRANSITIONS } from '../../src/constants/animation';
import { TRANSLATIONS } from '../../src/constants/translations';

// 下缘 (#88): the lower-edge state machine in its pure seam — who occupies the row
// when, the milestone hint's ~8s occupancy, the epilogue's line-break rules, and the
// ticket's exact wording. The UI components read these; these tests pin the rules.

test.describe('lower edge ownership', () => {
  const freeViewing = { introComplete: true, epilogueText: false, milestoneShowing: false, panelAttention: false };

  test('the tagline is the default occupant in free viewing', () => {
    expect(lowerEdgeOwner(freeViewing)).toBe('tagline');
  });

  test('the full cinematic keeps the row empty — the tagline never appears early', () => {
    expect(lowerEdgeOwner({ ...freeViewing, introComplete: false })).toBe('none');
    // Not even if a milestone window would be open.
    expect(lowerEdgeOwner({ ...freeViewing, introComplete: false, milestoneShowing: true })).toBe('none');
  });

  test('the epilogue takes the screen: the tagline yields, milestone or not', () => {
    expect(lowerEdgeOwner({ ...freeViewing, epilogueText: true })).toBe('none');
    expect(lowerEdgeOwner({ ...freeViewing, epilogueText: true, milestoneShowing: true })).toBe('none');
  });

  test('a panel that owns attention hushes the row', () => {
    expect(lowerEdgeOwner({ ...freeViewing, panelAttention: true })).toBe('none');
  });

  test('the milestone hint borrows the row instead of stacking beside the tagline', () => {
    expect(lowerEdgeOwner({ ...freeViewing, milestoneShowing: true })).toBe('milestone');
  });
});

test.describe('milestone hint occupancy', () => {
  test('the hint holds the lower edge for about eight seconds', () => {
    expect(MILESTONE_HINT_MS).toBeGreaterThanOrEqual(7500);
    expect(MILESTONE_HINT_MS).toBeLessThanOrEqual(8500);
  });

  test('arms once per cycle, in free viewing only', () => {
    const atMaximum = { milestone: 'maximum' as const, shownBefore: false, armed: false, dismissed: false };
    expect(shouldArmMilestone({ ...atMaximum, introComplete: true })).toBe(true);
    // The opening is still running: nothing arms beneath the captions.
    expect(shouldArmMilestone({ ...atMaximum, introComplete: false })).toBe(false);
    // Already remembered this cycle (a reload must not fire it again).
    expect(shouldArmMilestone({ ...atMaximum, introComplete: true, shownBefore: true })).toBe(false);
    // Already armed or already dismissed.
    expect(shouldArmMilestone({ ...atMaximum, introComplete: true, armed: true })).toBe(false);
    expect(shouldArmMilestone({ ...atMaximum, introComplete: true, dismissed: true })).toBe(false);
    // No milestone tonight.
    expect(shouldArmMilestone({ ...atMaximum, milestone: 'none', introComplete: true })).toBe(false);
  });
});

test.describe('epilogue line breaks', () => {
  test('zh breaks after the 句号 and the second line opens with 「而我的星尘」', () => {
    const [line1, line2] = splitEpilogue(TRANSLATIONS.ch.closingMessage, 'ch');
    expect(line1).toBe('我们都是星尘。');
    expect(line2.startsWith('而我的星尘')).toBe(true);
    // 「星尘」 is never split: it sits whole at the end of line 1 and inside line 2.
    expect(line1.endsWith('星尘。')).toBe(true);
    expect(line2).toContain('星尘');
    // The lines join back into the full sentence.
    expect(line1 + line2).toBe(TRANSLATIONS.ch.closingMessage);
  });

  test('en breaks after "starstuff."', () => {
    const [line1, line2] = splitEpilogue(TRANSLATIONS.en.closingMessage, 'en');
    expect(line1).toBe('We are made of starstuff.');
    expect(line2).toBe('And my starstuff chose yours.');
    expect(`${line1} ${line2}`).toBe(TRANSLATIONS.en.closingMessage);
  });

  test('the protected token exists in both languages and appears in the copy', () => {
    expect(epilogueToken('ch')).toBe('星尘');
    expect(epilogueToken('en')).toBe('starstuff');
    expect(TRANSLATIONS.ch.closingMessage).toContain(epilogueToken('ch'));
    expect(TRANSLATIONS.en.closingMessage).toContain(epilogueToken('en'));
  });

  test('a message without the marker stays on one line', () => {
    expect(splitEpilogue('no marker here', 'en')).toEqual(['no marker here', '']);
  });
});

test.describe('the ticket wording, character for character', () => {
  test('the closing line of the full cinematic (终幕那句)', () => {
    expect(TRANSLATIONS.ch.subtitle).toBe('在宇宙的尽头，我们依然相伴。');
    expect(TRANSLATIONS.en.subtitle).toBe('Together, Until the End of Time');
  });

  test('the epilogue', () => {
    expect(TRANSLATIONS.ch.closingMessage).toBe('我们都是星尘。而我的星尘，选择了你的。');
    expect(TRANSLATIONS.en.closingMessage).toBe('We are made of starstuff. And my starstuff chose yours.');
  });

  test('the milestone hint copy', () => {
    expect(TRANSLATIONS.ch.milestoneMaximum).toBe('本周期最亮');
    expect(TRANSLATIONS.ch.milestoneMinimum).toBe('本周期最暗');
  });

  test('tonight\u2019s Mira keeps its own phrase — a saved memory, not the sky line', () => {
    expect(TRANSLATIONS.ch.tonightPhrase).toBe('彼此牵引，共同前行');
    expect(TRANSLATIONS.en.tonightPhrase).toBe('Drawn to each other, travelling together');
  });
});

test.describe('motion windows', () => {
  test('from the final beat to the lower edge in no more than half a second', () => {
    expect(TRANSITIONS.TAGLINE_SETTLE).toBeGreaterThan(0);
    expect(TRANSITIONS.TAGLINE_SETTLE).toBeLessThanOrEqual(0.5);
  });

  test('the epilogue enters in about 0.8s and leaves faster when interrupted', () => {
    expect(TRANSITIONS.EPILOGUE_ENTER).toBeGreaterThanOrEqual(0.7);
    expect(TRANSITIONS.EPILOGUE_ENTER).toBeLessThanOrEqual(0.9);
    expect(TRANSITIONS.EPILOGUE_EXIT).toBeLessThan(TRANSITIONS.EPILOGUE_ENTER);
    expect(TRANSITIONS.EPILOGUE_EXIT).toBeGreaterThan(0);
  });
});
