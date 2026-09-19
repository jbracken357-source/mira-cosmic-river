import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useBinaryStar } from '../../hooks';
import { TRANSLATIONS } from '../../constants/translations';

// The epilogue line. Pure render: the frame loop is the epilogue's only clock-driven
// writer (it publishes epilogueText alongside epilogueVisible), and any intentional
// input clears both in the same event — there is nothing left to poll here.
export default function ClosingMessage() {
  const language = useBinaryStar((state) => state.language);
  const introComplete = useBinaryStar((state) => state.introComplete);
  const epilogueText = useBinaryStar((state) => state.epilogueText);
  const t = TRANSLATIONS[language];
  const reduceMotion = Boolean(useReducedMotion());

  // Unmount rather than playing the 2s exit fade — replay must not leave the epilogue over the opening.
  if (!introComplete) return null;

  return (
    <AnimatePresence>
      {epilogueText && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 2 }}
          className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none pl-[max(2rem,env(safe-area-inset-left))] pr-[max(2rem,env(safe-area-inset-right))]"
        >
          <p
            data-testid="epilogue-text"
            className="font-epilogue text-white/50 text-lg md:text-2xl italic max-w-lg px-8 text-center leading-relaxed"
            style={{ textShadow: '0 2px 12px #000' }}
          >
            {t.closingMessage}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
