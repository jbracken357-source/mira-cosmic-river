import { motion } from 'framer-motion';
import { useBinaryStar } from '../../hooks';
import { ANIMATION, TRANSLATIONS } from '../../constants';

export default function IntroAnimation() {
  const language = useBinaryStar((state) => state.language);
  const introComplete = useBinaryStar((state) => state.introComplete);
  const t = TRANSLATIONS[language];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: introComplete ? 1 : 0 }}
      transition={{ duration: 0.5 }}
      className="fixed left-4 top-4 z-10"
    >
      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: ANIMATION.INTRO_STAGGER.TITLE / 1000,
          duration: 0.5,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="font-display text-2xl md:text-3xl text-solar-white mb-1"
        style={{
          letterSpacing: '0.05em',
        }}
      >
        {t.title}
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: ANIMATION.INTRO_STAGGER.SUBTITLE / 1000,
          duration: 0.4,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="font-body text-sm text-nebula-violet/80"
      >
        {t.subtitle}
      </motion.p>
    </motion.div>
  );
}