import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useBinaryStar } from '../../hooks';
import { TRANSLATIONS } from '../../constants/translations';
import { collectViewerHolds, idleTiming, resolveViewerControl } from '../../lib/viewerControl';

// The epilogue: allowed after the shared idle clock crosses its threshold, dismissed
// by the first intentional input. The 1s poll only detects the threshold crossing;
// dismissal is event-driven through the store (noteIntentionalInput clears
// epilogueVisible immediately, and the text below renders only while it holds).
export default function ClosingMessage() {
  const language = useBinaryStar((state) => state.language);
  const introComplete = useBinaryStar((state) => state.introComplete);
  const epilogueVisible = useBinaryStar((state) => state.epilogueVisible);
  const t = TRANSLATIONS[language];
  const reduceMotion = Boolean(useReducedMotion());

  const [isVisible, setIsVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (!introComplete && isVisible) setIsVisible(false);

  useEffect(() => {
    if (!introComplete) {
      useBinaryStar.getState().setEpilogueVisible(false);
      return;
    }

    // Idle is measured from the moment exploration starts, not from module load.
    useBinaryStar.getState().restampIdleClock();

    const checkIdle = () => {
      const state = useBinaryStar.getState();
      const control = resolveViewerControl(
        Date.now(),
        state.lastIntentionalInputAt,
        collectViewerHolds(state, reduceMotion),
        idleTiming(),
      );
      // The flag covers camera or text: under reduced motion there is no closing
      // flight, but the epilogue line is still allowed at the 60s mark.
      const epilogueActive = control.epilogueCamera || control.epilogueText;
      if (state.epilogueVisible !== epilogueActive) {
        state.setEpilogueVisible(epilogueActive);
      }
      setIsVisible(control.epilogueText);
    };

    intervalRef.current = setInterval(checkIdle, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      useBinaryStar.getState().setEpilogueVisible(false);
    };
  }, [introComplete, reduceMotion]);

  // Unmount rather than playing the 2s exit fade — replay must not leave the epilogue over the opening.
  if (!introComplete) return null;

  return (
    <AnimatePresence>
      {isVisible && epilogueVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 2 }}
          className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none pl-[max(2rem,env(safe-area-inset-left))] pr-[max(2rem,env(safe-area-inset-right))]"
        >
          <p
            data-testid="epilogue-text"
            className="text-white/50 text-lg md:text-2xl italic max-w-lg px-8 text-center leading-relaxed"
            style={{ fontFamily: "'Caveat', 'Cinzel', serif", textShadow: '0 2px 12px #000' }}
          >
            {t.closingMessage}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
