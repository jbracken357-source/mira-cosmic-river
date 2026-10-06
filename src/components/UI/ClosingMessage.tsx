import type { ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useBinaryStar } from '../../hooks';
import { TRANSLATIONS } from '../../constants/translations';
import { TRANSITIONS } from '../../constants/animation';
import { epilogueToken, splitEpilogue } from '../../lib/lowerEdge';

// 「星尘」(en "starstuff") never breaks across lines: every occurrence rides in a
// no-wrap island of its own, so a narrow screen may wrap the line elsewhere but
// never inside the word.
function protectToken(line: string, token: string): ReactNode {
  const parts = line.split(token);
  if (parts.length === 1) return line;
  const nodes: ReactNode[] = [];
  parts.forEach((part, index) => {
    nodes.push(part);
    if (index < parts.length - 1) {
      nodes.push(
        <span key={index} className="whitespace-nowrap">
          {token}
        </span>,
      );
    }
  });
  return nodes;
}

// The epilogue line. Pure render: the frame loop is the epilogue's only clock-driven
// writer (it publishes epilogueText alongside epilogueVisible), and any intentional
// input clears both in the same event — there is nothing left to poll here.
//
// #88: the line breaks after the 句号 (en: after "starstuff.") so the second line
// opens with 「而我的星尘」; it enters in about 0.8s and leaves faster when the
// viewer interrupts.
export default function ClosingMessage() {
  const language = useBinaryStar((state) => state.language);
  const introComplete = useBinaryStar((state) => state.introComplete);
  const epilogueText = useBinaryStar((state) => state.epilogueText);
  const t = TRANSLATIONS[language];
  const reduceMotion = Boolean(useReducedMotion());

  // Unmount rather than playing an exit fade — replay must not leave the epilogue over the opening.
  if (!introComplete) return null;

  const [line1, line2] = splitEpilogue(t.closingMessage, language);
  const token = epilogueToken(language);

  return (
    <AnimatePresence>
      {epilogueText && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : TRANSITIONS.EPILOGUE_EXIT } }}
          transition={{ duration: reduceMotion ? 0 : TRANSITIONS.EPILOGUE_ENTER }}
          className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none pl-[max(2rem,env(safe-area-inset-left))] pr-[max(2rem,env(safe-area-inset-right))]"
        >
          {/* A soft local dusk behind the line: the epilogue must stay readable where
              the framing puts it over the pair's glow (reduced motion never flies the
              closing camera, so the text lands on the explore framing). */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(3,1,5,0.55),transparent_75%)]" />
          <p
            data-testid="epilogue-text"
            className="relative font-epilogue text-white/70 text-xl md:text-3xl max-w-xl px-8 text-center leading-relaxed"
            style={{ textShadow: '0 2px 20px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)' }}
          >
            <span data-testid="epilogue-line-1" className="block">
              {protectToken(line1, token)}
            </span>
            <span data-testid="epilogue-line-2" className="block">
              {protectToken(line2, token)}
            </span>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
