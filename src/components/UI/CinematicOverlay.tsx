import { motion, AnimatePresence } from 'framer-motion';
import { useBinaryStar } from '../../hooks';
import { TRANSLATIONS } from '../../constants/translations';
import { CINEMATIC, TRANSITIONS } from '../../constants/animation';

// Cinematic overlay: 15-second opening text sequence
export default function CinematicOverlay() {
  const language = useBinaryStar((state) => state.language);
  const cinematicTime = useBinaryStar((state) => state.cinematicTime);
  const introComplete = useBinaryStar((state) => state.introComplete);
  const setLanguage = useBinaryStar((state) => state.setLanguage);
  const t = TRANSLATIONS[language];

  const handleSkip = () => {
    useBinaryStar.getState().setIntroComplete(true);
  };

  if (introComplete) {
    return <ExploreUI />;
  }

  return (
    <div
      data-testid="cinematic-overlay"
      className="relative z-10 flex h-screen w-full pointer-events-none select-none overflow-hidden"
    >
      {/* Skip button */}
      <div className="absolute top-4 right-4 pointer-events-auto z-50">
        <button
          data-testid="skip-cinematic"
          onClick={handleSkip}
          className="text-white/30 text-xs font-extralight tracking-widest uppercase hover:text-white/60 transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Dark screen (0-2s): nothing */}
      {/* Stars appear text (2-4s) */}
      <AnimatePresence>
        {cinematicTime >= CINEMATIC.STARS_APPEAR && cinematicTime < CINEMATIC.PULL_BACK_START && (
          <motion.div
            key="text1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: TRANSITIONS.FADE_IN }}
            className="absolute bottom-16 md:bottom-24 left-6 md:left-12 right-6 md:right-12 pointer-events-none select-none"
          >
            <p className="text-white/90 text-lg md:text-2xl font-extralight italic tracking-wide leading-relaxed bg-black/40 backdrop-blur-sm px-4 py-3 rounded-lg inline-block">
              {t.cinematic1}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pull-back text (4-8s) */}
      <AnimatePresence>
        {cinematicTime >= CINEMATIC.PULL_BACK_START && cinematicTime < CINEMATIC.TAIL_REVEAL_START && (
          <motion.div
            key="text2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: TRANSITIONS.FADE_IN }}
            className="absolute bottom-16 md:bottom-24 left-6 md:left-12 right-6 md:right-12 pointer-events-none select-none"
          >
            <p className="text-white/80 text-base md:text-xl font-extralight italic tracking-wide leading-relaxed bg-black/40 backdrop-blur-sm px-4 py-3 rounded-lg inline-block">
              {t.cinematic2}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tail reveal text (8-12.5s) */}
      <AnimatePresence>
        {cinematicTime >= CINEMATIC.TAIL_REVEAL_START && cinematicTime < CINEMATIC.FINAL_TEXT && (
          <motion.div
            key="text3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: TRANSITIONS.FADE_IN }}
            className="absolute bottom-16 md:bottom-24 left-6 md:left-12 right-6 md:right-12 pointer-events-none select-none"
          >
            <p className="text-white/80 text-base md:text-xl font-extralight italic tracking-wide leading-relaxed bg-black/40 backdrop-blur-sm px-4 py-3 rounded-lg inline-block">
              {t.cinematic3}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Final text (12.5-15s) */}
      <AnimatePresence>
        {cinematicTime >= CINEMATIC.FINAL_TEXT && (
          <motion.div
            key="text-final"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: TRANSITIONS.FINAL_TEXT_FADE }}
            className="absolute top-1/3 left-6 md:left-12 pointer-events-none select-none"
          >
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-light text-white/90 tracking-wider">
              Mira
            </h1>
            <p className="text-white/50 text-sm md:text-base font-extralight italic tracking-widest uppercase mt-2">
              {t.subtitle}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Language switch */}
      <div className="absolute bottom-4 left-4 pointer-events-auto z-50">
        <button
          onClick={() => setLanguage(language === 'en' ? 'ch' : 'en')}
          className="text-white/30 text-xs font-extralight tracking-widest hover:text-white/60 transition-colors"
        >
          {language === 'en' ? '中文' : 'EN'}
        </button>
      </div>
    </div>
  );
}

// Minimal explore-mode UI
function ExploreUI() {
  const language = useBinaryStar((state) => state.language);
  const setLanguage = useBinaryStar((state) => state.setLanguage);
  const t = TRANSLATIONS[language];

  return (
    <div
      data-testid="explore-ui"
      className="relative z-10 flex h-screen w-full pointer-events-none select-none overflow-hidden"
    >
      {/* Top bar */}
      <header className="absolute top-0 left-0 right-0 px-4 md:px-14 py-4 md:py-8 flex items-center justify-between">
        <div className="flex items-center gap-3 md:gap-6">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: TRANSITIONS.EXPLORE_TRANSITION }}
            className="font-display text-2xl md:text-4xl text-orange-400/80 italic tracking-widest"
          >
            Mira
          </motion.span>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <button
            data-testid="replay-opening"
            onClick={() => useBinaryStar.getState().setIntroComplete(false)}
            className="pointer-events-auto text-white/30 text-xs font-extralight tracking-widest uppercase hover:text-white/60 transition-colors"
          >
            {t.replayOpening}
          </button>
          <button
            onClick={() => setLanguage(language === 'en' ? 'ch' : 'en')}
            className="pointer-events-auto text-white/30 text-xs font-extralight tracking-widest hover:text-white/60 transition-colors"
          >
            {language === 'en' ? '中文' : 'EN'}
          </button>
        </div>
      </header>

      {/* Bottom hint */}
      <footer className="absolute bottom-4 md:bottom-8 left-0 right-0 px-8 flex justify-center">
        <div className="backdrop-blur-sm bg-white/5 border border-white/10 px-4 py-2 rounded-full">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500/60 animate-pulse" />
            <span className="text-[9px] tracking-[0.2em] uppercase text-white/40 font-extralight">
              {t.interactionHint}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
