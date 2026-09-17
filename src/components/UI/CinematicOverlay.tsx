import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useBinaryStar, useMobile } from '../../hooks';
import { TRANSLATIONS } from '../../constants/translations';
import { CINEMATIC, TRANSITIONS } from '../../constants/animation';
import type { StarName } from './InfoCards';

// Cinematic overlay: 15-second opening text sequence
export default function CinematicOverlay({
  onSelectStar,
}: {
  onSelectStar: (star: StarName | null) => void;
}) {
  const language = useBinaryStar((state) => state.language);
  const cinematicTime = useBinaryStar((state) => state.cinematicTime);
  const introComplete = useBinaryStar((state) => state.introComplete);
  const setLanguage = useBinaryStar((state) => state.setLanguage);
  const t = TRANSLATIONS[language];
  const reduceMotion = Boolean(useReducedMotion());
  const fade = reduceMotion ? 0 : TRANSITIONS.FADE_IN;
  const finalFade = reduceMotion ? 0 : TRANSITIONS.FINAL_TEXT_FADE;
  const caption = cinematicTime < CINEMATIC.STARS_APPEAR || cinematicTime >= CINEMATIC.FINAL_TEXT
    ? null
    : cinematicTime < CINEMATIC.PULL_BACK_START ? t.cinematic1
      : cinematicTime < CINEMATIC.TAIL_REVEAL_START ? t.cinematic2 : t.cinematic3;

  const handleSkip = () => {
    useBinaryStar.getState().setIntroComplete(true);
  };

  if (introComplete) {
    return <ExploreUI onSelectStar={onSelectStar} />;
  }

  return (
    <div
      data-testid="cinematic-overlay"
      className="relative z-10 flex h-dvh w-full pointer-events-none select-none overflow-hidden"
    >
      {/* Skip button */}
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] pointer-events-auto z-50">
        <button
          data-testid="skip-cinematic"
          onClick={handleSkip}
          className="text-white/30 text-xs font-extralight tracking-widest uppercase hover:text-white/60 transition-colors"
        >
          Skip
        </button>
      </div>

      {/* One caption at a time; exit finishes before the next line enters. */}
      <AnimatePresence mode="wait">
        {caption && (
          <motion.div
            key={caption}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : .25 } }}
            transition={{ duration: Math.min(fade, .75) }}
            className="absolute bottom-32 md:bottom-24 left-6 md:left-12 right-6 md:right-12 pointer-events-none select-none"
          >
            <p className="text-white/70 text-base md:text-xl font-extralight tracking-wide leading-relaxed" style={{ textShadow: '0 2px 12px #000' }}>
              {caption}
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
            transition={{ duration: finalFade }}
            className="absolute top-1/3 left-6 md:left-12 pointer-events-none select-none"
            style={{ textShadow: '0 2px 12px #000' }}
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
      <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] pointer-events-auto z-50">
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
function ExploreUI({ onSelectStar }: { onSelectStar: (star: StarName | null) => void }) {
  const language = useBinaryStar((state) => state.language);
  const setLanguage = useBinaryStar((state) => state.setLanguage);
  const isPlaying = useBinaryStar((state) => state.isPlaying);
  const t = TRANSLATIONS[language];
  const isMobile = useMobile();
  const reduceMotion = Boolean(useReducedMotion());

  return (
    <div
      data-testid="explore-ui"
      className="relative z-10 flex h-dvh w-full pointer-events-none select-none overflow-hidden"
    >
      {/* Top bar */}
      <header className="absolute top-0 left-0 right-0 px-4 md:px-14 pt-[max(1rem,env(safe-area-inset-top))] pb-4 md:pb-8 flex items-center justify-between">
        <div className="flex items-center gap-3 md:gap-6">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : TRANSITIONS.EXPLORE_TRANSITION }}
            className="font-display text-2xl md:text-4xl text-orange-400/80 italic tracking-widest"
          >
            Mira
          </motion.span>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <button
            data-testid="return-to-view"
            onClick={() => useBinaryStar.getState().requestReturnToExplore()}
            className="pointer-events-auto min-h-11 min-w-11 inline-flex items-center justify-center text-white/30 text-xs font-extralight tracking-widest uppercase hover:text-white/60 transition-colors"
          >
            {t.returnToView}
          </button>
          <button
            data-testid="pause-toggle"
            aria-pressed={!isPlaying}
            onClick={() => useBinaryStar.getState().setPlaying(!isPlaying)}
            className="pointer-events-auto min-h-11 min-w-11 inline-flex items-center justify-center text-white/30 text-xs font-extralight tracking-widest uppercase hover:text-white/60 transition-colors"
          >
            {isPlaying ? t.pause : t.resume}
          </button>
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

      {/* Bottom hint — tail line on its own row so it does not collide with the pill on narrow viewports */}
      <footer className="absolute bottom-0 left-0 right-0 px-8 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-8 pt-2 flex flex-col items-center gap-3">
        <button
          data-testid="tail-hint"
          onClick={() => onSelectStar('tail')}
          className="pointer-events-auto text-[9px] tracking-[0.2em] uppercase text-white/30 font-extralight hover:text-white/55 transition-colors"
        >
          {t.tailHint}
        </button>
        <div className="backdrop-blur-sm bg-white/5 border border-white/10 px-4 py-2 rounded-full">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500/60 animate-pulse" />
            <span className="text-[9px] tracking-[0.2em] uppercase text-white/40 font-extralight">
              {isMobile ? t.interactionHintMobile : t.interactionHint}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
