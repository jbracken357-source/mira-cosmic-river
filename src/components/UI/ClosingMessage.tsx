import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useBinaryStar } from '../../hooks';
import { TRANSLATIONS } from '../../constants/translations';
import { TRANSITIONS } from '../../constants/animation';

const IDLE_THRESHOLD = 60; // seconds before closing message appears

export default function ClosingMessage() {
  const language = useBinaryStar((state) => state.language);
  const introComplete = useBinaryStar((state) => state.introComplete);
  const t = TRANSLATIONS[language];
  const reduceMotion = Boolean(useReducedMotion());

  const [isVisible, setIsVisible] = useState(false);
  const lastActivityRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (!introComplete && isVisible) setIsVisible(false);

  useEffect(() => {
    if (!introComplete) {
      useBinaryStar.getState().setEpilogueVisible(false);
      return;
    }

    // Idle is measured from the moment exploration starts, not from module load
    lastActivityRef.current = Date.now();

    const checkIdle = () => {
      const elapsed = (Date.now() - lastActivityRef.current) / 1000;
      const camera = elapsed >= IDLE_THRESHOLD - TRANSITIONS.CLOSING_CAMERA;
      const text = elapsed >= IDLE_THRESHOLD;
      const { epilogueVisible, setEpilogueVisible } = useBinaryStar.getState();
      if (epilogueVisible !== camera) setEpilogueVisible(camera);
      setIsVisible(text);
    };

    intervalRef.current = setInterval(checkIdle, 1000);

    // Activity only records a timestamp. Setting state here re-rendered the whole tree
    // on every pointer move, which stalled input delivery (clicks went unacknowledged).
    // The 1s tick above is what decides visibility, so the message still clears within
    // a second of the viewer coming back.
    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', markActivity);
    window.addEventListener('click', markActivity);
    window.addEventListener('pointerdown', markActivity);
    window.addEventListener('wheel', markActivity, { passive: true });
    window.addEventListener('touchstart', markActivity);
    window.addEventListener('keydown', markActivity);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('mousemove', markActivity);
      window.removeEventListener('click', markActivity);
      window.removeEventListener('pointerdown', markActivity);
      window.removeEventListener('wheel', markActivity);
      window.removeEventListener('touchstart', markActivity);
      window.removeEventListener('keydown', markActivity);
      useBinaryStar.getState().setEpilogueVisible(false);
    };
  }, [introComplete]);

  // Unmount rather than playing the 2s exit fade — replay must not leave the epilogue over the opening.
  if (!introComplete) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 2 }}
          className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none pl-[max(2rem,env(safe-area-inset-left))] pr-[max(2rem,env(safe-area-inset-right))]"
        >
          <p
            className="text-white/50 text-lg md:text-2xl italic max-w-lg px-8 text-center leading-relaxed"
            style={{ fontFamily: "'Caveat', 'Cinzel', serif" }}
          >
            {t.closingMessage}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
