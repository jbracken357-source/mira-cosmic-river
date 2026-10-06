import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useBinaryStar, useMilestoneHint, useMobile, useTonightSave } from '../../hooks';
import { TRANSLATIONS } from '../../constants/translations';
import { TRANSITIONS } from '../../constants/animation';
import { lowerEdgeOwner } from '../../lib/lowerEdge';

// 下缘 (#88): the lower edge of the free-viewing screen. The closing line of the
// full cinematic (终幕那句) holds it instead of unmounting — on direct entry it is
// present from the first frame, no fade. The row holds at most one line: the
// milestone hint (本周期最亮/最暗) borrows it for about eight seconds once per
// cycle, the epilogue takes the whole screen while it is up, and a panel that owns
// the viewer's attention hushes it. lib/lowerEdge decides who occupies the row,
// hooks/useMilestoneHint owns the hint's arm/dismiss bookkeeping — this component
// is a pure render of those two verdicts.
export default function LowerEdge() {
  const language = useBinaryStar((state) => state.language);
  const introComplete = useBinaryStar((state) => state.introComplete);
  const epilogueText = useBinaryStar((state) => state.epilogueText);
  const closingLineArrival = useBinaryStar((state) => state.closingLineArrival);
  const cardOpen = useBinaryStar((state) => state.cardOpen);
  const armed = useMilestoneHint((state) => state.armed);
  const dismissed = useMilestoneHint((state) => state.dismissed);
  const tonightOpen = useTonightSave((state) => state.phase !== 'idle');
  const isMobile = useMobile();
  const t = TRANSLATIONS[language];
  const reduceMotion = Boolean(useReducedMotion());

  const owner = lowerEdgeOwner({
    introComplete,
    epilogueText,
    milestoneShowing: armed !== null && !dismissed,
    panelAttention: tonightOpen || (isMobile && cardOpen),
  });

  const milestoneText =
    armed === 'maximum' ? t.milestoneMaximum : armed === 'minimum' ? t.milestoneMinimum : null;

  return (
    <AnimatePresence mode="wait">
      {owner === 'milestone' && milestoneText && (
        <motion.div
          key="milestone"
          data-testid="milestone-hint"
          data-milestone-kind={armed}
          // 减少动态效果时，提示只改变透明度 — never a displacement.
          initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
          transition={{ duration: TRANSITIONS.MILESTONE_HINT_FADE }}
          className="flex justify-center"
        >
          <div className="backdrop-blur-sm bg-white/5 border border-white/10 px-4 py-2 rounded-full">
            <span className="text-[10px] tracking-[0.18em] uppercase text-white/55 font-extralight">
              {milestoneText}
            </span>
          </div>
        </motion.div>
      )}
      {owner === 'closingLine' && (
        <motion.p
          key="closingLine"
          data-testid="lower-edge-closing-line"
          // 直达第一眼: with no final beat to arrive from, the line is present from
          // the first frame (initial={false} — no fade). The ≤0.5s settle belongs
          // to the 终幕→下缘 transition alone.
          initial={closingLineArrival === 'present' ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.25 } }}
          transition={{ duration: reduceMotion ? 0 : TRANSITIONS.CLOSING_LINE_SETTLE }}
          // The closing line's own voice — never the controls' all-caps and
          // ultra-wide tracking. Italic stays en-only, as in the final beat.
          className={`text-white/60 text-sm md:text-base font-extralight tracking-wider text-center ${
            language === 'en' ? 'italic' : ''
          }`}
          style={{ textShadow: '0 2px 16px #000' }}
        >
          {t.subtitle}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
