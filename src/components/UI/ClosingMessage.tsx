import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBinaryStar } from '../../hooks';
import { TRANSLATIONS } from '../../constants/translations';

const IDLE_THRESHOLD = 60; // seconds before closing message appears

export default function ClosingMessage() {
  const language = useBinaryStar((state) => state.language);
  const introComplete = useBinaryStar((state) => state.introComplete);
  const t = TRANSLATIONS[language];

  const [isVisible, setIsVisible] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!introComplete) return;

    const checkIdle = () => {
      const elapsed = (Date.now() - lastActivityRef.current) / 1000;
      setIsVisible(elapsed >= IDLE_THRESHOLD);
    };

    intervalRef.current = setInterval(checkIdle, 1000);

    const resetIdle = () => {
      lastActivityRef.current = Date.now();
      setIsVisible(false);
    };

    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('click', resetIdle);
    window.addEventListener('touchstart', resetIdle);
    window.addEventListener('keydown', resetIdle);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('click', resetIdle);
      window.removeEventListener('touchstart', resetIdle);
      window.removeEventListener('keydown', resetIdle);
    };
  }, [introComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2 }}
          className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
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
