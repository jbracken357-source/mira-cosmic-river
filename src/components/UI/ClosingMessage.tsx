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
          {/* A soft local dusk behind the line: the epilogue must stay readable where
              the framing puts it over the pair's glow (reduced motion never flies the
              closing camera, so the text lands on the explore framing). */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(3,1,5,0.55),transparent_75%)]" />
          <p
            data-testid="epilogue-text"
            className="relative font-epilogue text-white/70 text-xl md:text-3xl max-w-xl px-8 text-center text-balance leading-relaxed"
            style={{ textShadow: '0 2px 20px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)' }}
          >
            {t.closingMessage}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
