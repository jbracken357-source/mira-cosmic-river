import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useBinaryStar, useMobile, useTonightSave } from '../../hooks';
import { TRANSLATIONS } from '../../constants/translations';
import { TRANSITIONS } from '../../constants/animation';
import {
  MILESTONE_HINT_MS,
  lowerEdgeOwner,
  shouldArmMilestone,
} from '../../lib/lowerEdge';
import { milestoneStorageKey, phaseMilestone } from '../../lib/starClock';
import { rememberFlag, rememberedFlag } from '../../lib/rememberedFlag';

// 下缘 (#88): the lower edge of the free-viewing screen. The closing line of the
// full cinematic (终幕那句) stays here instead of unmounting — on direct entry it is
// already the first thing at the row. The row holds at most one line: the milestone
// hint (本周期最亮/最暗) borrows it for about eight seconds once per cycle, the
// epilogue takes the whole screen while it is up, and a panel that owns the
// viewer's attention hushes it. Who occupies the row is decided by lib/lowerEdge.
export default function LowerEdge() {
  const language = useBinaryStar((state) => state.language);
  const introComplete = useBinaryStar((state) => state.introComplete);
  const epilogueText = useBinaryStar((state) => state.epilogueText);
  const sky = useBinaryStar((state) => state.sky);
  const cardOpen = useBinaryStar((state) => state.cardOpen);
  const tonightOpen = useTonightSave((state) => state.phase !== 'idle');
  const isMobile = useMobile();
  const t = TRANSLATIONS[language];
  const reduceMotion = Boolean(useReducedMotion());

  // The milestone window, once per cycle (the same remembered-flag the hint has
  // always used): arm in free viewing only, dismiss on the ~8s timer.
  const [armed, setArmed] = useState<'maximum' | 'minimum' | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const milestone = phaseMilestone(sky);
  if (
    shouldArmMilestone({
      introComplete,
      milestone,
      shownBefore: milestone === 'none' ? false : rememberedFlag(milestoneStorageKey(milestone, sky)),
      armed: armed !== null,
      dismissed,
    })
  ) {
    setArmed(milestone as 'maximum' | 'minimum');
  }

  useEffect(() => {
    if (!armed) return;
    rememberFlag(milestoneStorageKey(armed, sky));
    const timeout = window.setTimeout(() => setDismissed(true), MILESTONE_HINT_MS);
    return () => window.clearTimeout(timeout);
  }, [armed, sky]);

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
          transition={{ duration: 0.4 }}
          className="flex justify-center"
        >
          <div className="backdrop-blur-sm bg-white/5 border border-white/10 px-4 py-2 rounded-full">
            <span className="text-[10px] tracking-[0.18em] uppercase text-white/55 font-extralight">
              {milestoneText}
            </span>
          </div>
        </motion.div>
      )}
      {owner === 'tagline' && (
        <motion.p
          key="tagline"
          data-testid="lower-edge-tagline"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.25 } }}
          transition={{ duration: reduceMotion ? 0 : TRANSITIONS.TAGLINE_SETTLE }}
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
