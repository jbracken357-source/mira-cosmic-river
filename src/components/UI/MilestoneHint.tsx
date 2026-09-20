import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBinaryStar } from '../../hooks';
import { TRANSLATIONS } from '../../constants/translations';
import { milestoneStorageKey, phaseMilestone } from '../../lib/starClock';
import { rememberFlag, rememberedFlag } from '../../lib/rememberedFlag';

const HINT_MS = 8000;

function readShown(key: string): boolean {
  return rememberedFlag(key);
}

function writeShown(key: string): void {
  rememberFlag(key);
}

export default function MilestoneHint() {
  const language = useBinaryStar((state) => state.language);
  const sky = useBinaryStar((state) => state.sky);
  const introComplete = useBinaryStar((state) => state.introComplete);
  const t = TRANSLATIONS[language];
  const [armed, setArmed] = useState<'maximum' | 'minimum' | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (introComplete && armed === null && !dismissed) {
    const milestone = phaseMilestone(sky);
    if (milestone !== 'none' && !readShown(milestoneStorageKey(milestone, sky))) {
      setArmed(milestone);
    }
  }

  useEffect(() => {
    if (!armed) return;
    writeShown(milestoneStorageKey(armed, sky));
    const timeout = window.setTimeout(() => setDismissed(true), HINT_MS);
    return () => window.clearTimeout(timeout);
  }, [armed, sky]);

  const kind = dismissed ? null : armed;

  const text = kind === 'maximum' ? t.milestoneMaximum : kind === 'minimum' ? t.milestoneMinimum : null;

  return (
    <AnimatePresence>
      {kind && text && (
        <motion.div
          data-testid="milestone-hint"
          data-milestone-kind={kind}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.4 }}
          className="absolute bottom-16 md:bottom-24 left-0 right-0 z-20 flex justify-center px-8"
        >
          <div className="backdrop-blur-sm bg-white/5 border border-white/10 px-4 py-2 rounded-full">
            <span className="text-[10px] tracking-[0.18em] uppercase text-white/55 font-extralight">
              {text}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
