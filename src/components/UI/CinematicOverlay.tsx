import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useBinaryStar, useMobile, useEntryReadiness, useTonightSave } from '../../hooks';
import { TRANSLATIONS } from '../../constants/translations';
import { TRANSITIONS } from '../../constants/animation';
import { openingSegment } from '../../lib/openingTimeline';
import { rememberFlag, rememberedFlag } from '../../lib/rememberedFlag';
import type { StarName } from './InfoCards';
import AmbientToggle from './AmbientToggle';
import TonightSave from './TonightSave';

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
  // cinematicTime is the quantized mark, not the raw clock. openingSegment of a
  // mark is identical to openingSegment of any t in that beat — including title,
  // which is true because the mark has landed on FINAL_TEXT, not because the
  // overlay re-compares the constant.
  const segment = openingSegment(cinematicTime);
  const caption = segment.caption ? t[segment.caption] : null;

  const handleEnterEarly = () => {
    useBinaryStar.getState().setIntroComplete(true);
  };

  // While the entry gate is still waiting on materials (#24), the opening has
  // not started: the loading still alone holds the screen.
  const entryGate = useEntryReadiness((state) => state.gate);

  if (introComplete) {
    return <ExploreUI onSelectStar={onSelectStar} />;
  }

  if (entryGate === 'waiting') {
    return null;
  }

  return (
    <div
      data-testid="cinematic-overlay"
      className="relative z-10 flex h-dvh w-full pointer-events-none select-none overflow-hidden"
    >
      {/* Top-right control cluster during the opening. One place for every quiet
          action (sound, enter early, language) so the corner reads as a single
          group instead of a switch glued to a skip button. */}
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] pointer-events-auto z-50 flex items-center gap-5 md:gap-7">
        <AmbientToggle />
        <button
          data-testid="skip-cinematic"
          onClick={handleEnterEarly}
          className="whisper-btn min-h-11 min-w-11 inline-flex items-center justify-center text-[11px] md:text-xs font-extralight tracking-widest uppercase"
        >
          {t.enterEarly}
        </button>
        <button
          data-testid="language-toggle"
          onClick={() => setLanguage(language === 'en' ? 'ch' : 'en')}
          className="whisper-btn min-h-11 min-w-11 inline-flex items-center justify-center text-xs font-extralight tracking-widest"
        >
          {language === 'en' ? '中文' : 'EN'}
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
            <p className="text-white/85 text-lg md:text-2xl font-extralight tracking-wider leading-relaxed" style={{ textShadow: '0 2px 16px #000' }}>
              {caption}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Final text (12.5-15s) — visibility is the segment's title field. */}
      <AnimatePresence>
        {segment.title && (
          <motion.div
            key="text-final"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: finalFade }}
            className="absolute top-1/3 left-6 md:left-12 pointer-events-none select-none"
            style={{ textShadow: '0 2px 16px #000' }}
          >
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-light text-white/90 tracking-wider">
              Mira
            </h1>
            {/* Italic belongs to the Latin run only — synthetic oblique on CJK
                glyph shapes reads as broken, not romantic. */}
            <p
              className={`text-white/60 text-sm md:text-lg font-extralight tracking-[0.25em] mt-3 ${language === 'en' ? 'italic' : ''}`}
            >
              {t.subtitle}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Once the viewer has manipulated the scene, the interaction hint has done its
// job — remembered across visits like the seen-opening flag.
const LEARNED_CONTROLS_KEY = 'mira:learned-controls';

function hasLearnedControls(): boolean {
  return rememberedFlag(LEARNED_CONTROLS_KEY);
}

function persistLearnedControls(): void {
  rememberFlag(LEARNED_CONTROLS_KEY);
}

// Minimal explore-mode UI
function ExploreUI({ onSelectStar }: { onSelectStar: (star: StarName | null) => void }) {
  const language = useBinaryStar((state) => state.language);
  const setLanguage = useBinaryStar((state) => state.setLanguage);
  const isPlaying = useBinaryStar((state) => state.isPlaying);
  const cardOpen = useBinaryStar((state) => state.cardOpen);
  const epilogueVisible = useBinaryStar((state) => state.epilogueVisible);
  const tonightOpen = useTonightSave((state) => state.phase !== 'idle');
  const t = TRANSLATIONS[language];
  const isMobile = useMobile();
  const reduceMotion = Boolean(useReducedMotion());

  // The epilogue is the emotional close: all chrome lets go of the screen, and the
  // first intentional input (which ends the epilogue) brings it back.
  const epilogueHush = epilogueVisible;
  // While a panel owns the viewer's attention the ambient hints step aside — the
  // mobile bottom sheet would sit on top of them anyway.
  const hintsQuiet = tonightOpen || (isMobile && cardOpen);

  // The interaction hint leaves once the viewer has actually manipulated the scene
  // (drag/zoom land on the canvas; presses on UI buttons do not count), and stays
  // gone on later visits. It stays rediscoverable: a quiet recall button takes its
  // place in the footer.
  const [hintVisible, setHintVisible] = useState(() => !hasLearnedControls());
  useEffect(() => {
    if (!hintVisible) return;
    const dismiss = (event: Event) => {
      if (event.target instanceof HTMLCanvasElement) {
        persistLearnedControls();
        setHintVisible(false);
      }
    };
    window.addEventListener('pointerdown', dismiss, { passive: true });
    window.addEventListener('wheel', dismiss, { passive: true });
    window.addEventListener('touchstart', dismiss, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('wheel', dismiss);
      window.removeEventListener('touchstart', dismiss);
    };
  }, [hintVisible]);

  return (
    <div
      data-testid="explore-ui"
      className="relative z-10 flex h-dvh w-full pointer-events-none select-none overflow-hidden"
    >
      {/* Top bar */}
      <header
        className={`absolute top-0 left-0 right-0 px-4 md:px-14 pt-[max(1rem,env(safe-area-inset-top))] pb-4 md:pb-8 flex items-center justify-between transition-opacity duration-[1200ms] ${
          epilogueHush ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <div className="flex items-center gap-3 md:gap-6">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : TRANSITIONS.EXPLORE_TRANSITION }}
            className="font-display text-2xl md:text-3xl text-white/90 font-light tracking-widest"
          >
            Mira
          </motion.span>
        </div>

        <div className="flex items-center justify-end flex-wrap gap-3 md:gap-7">
          <button
            data-testid="return-to-view"
            onClick={() => useBinaryStar.getState().requestReturnToExplore()}
            className="pointer-events-auto whisper-btn min-h-11 min-w-11 inline-flex items-center justify-center text-[11px] md:text-xs font-extralight tracking-widest uppercase"
          >
            {t.returnToView}
          </button>
          <TonightSave />
          <AmbientToggle />
          <button
            data-testid="pause-toggle"
            aria-pressed={!isPlaying}
            aria-label={isPlaying ? t.pause : t.resume}
            onClick={() => useBinaryStar.getState().setPlaying(!isPlaying)}
            className="pointer-events-auto whisper-btn min-h-11 min-w-11 inline-flex items-center justify-center text-[11px] md:text-xs font-extralight tracking-widest uppercase"
          >
            {isPlaying ? t.pause : t.resume}
          </button>
          <button
            data-testid="replay-opening"
            aria-label={t.replayOpening}
            onClick={() => useBinaryStar.getState().setIntroComplete(false)}
            className="pointer-events-auto whisper-btn min-h-11 min-w-11 inline-flex items-center justify-center text-[11px] md:text-xs font-extralight tracking-widest uppercase"
          >
            {t.replayOpening}
          </button>
          <button
            data-testid="language-toggle"
            onClick={() => setLanguage(language === 'en' ? 'ch' : 'en')}
            className="pointer-events-auto whisper-btn min-h-11 min-w-11 inline-flex items-center justify-center text-xs font-extralight tracking-widest"
          >
            {language === 'en' ? '中文' : 'EN'}
          </button>
        </div>
      </header>

      {/* Bottom hint — tail line on its own row so it does not collide with the pill on narrow viewports */}
      <footer
        className={`absolute bottom-0 left-0 right-0 px-8 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-8 pt-2 flex flex-col items-center gap-3 transition-opacity duration-[1200ms] ${
          epilogueHush || hintsQuiet ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        {/* Keyboard entry to the two stars (#20): the canvas itself is not
            focusable, so these triggers stay screen-reader reachable and only
            become visible when tabbed to. The tail already has a visible entry. */}
        <div className="sr-only focus-within:not-sr-only pointer-events-auto flex items-center gap-3">
          <button
            data-testid="star-trigger-miraA"
            onClick={() => onSelectStar('miraA')}
            className="min-h-11 min-w-11 inline-flex items-center justify-center backdrop-blur-sm bg-white/5 border border-white/10 px-4 rounded-full text-[10px] tracking-[0.2em] uppercase text-white/55 font-extralight hover:text-white/85 transition-colors"
          >
            {t.miraA}
          </button>
          <button
            data-testid="star-trigger-miraB"
            onClick={() => onSelectStar('miraB')}
            className="min-h-11 min-w-11 inline-flex items-center justify-center backdrop-blur-sm bg-white/5 border border-white/10 px-4 rounded-full text-[10px] tracking-[0.2em] uppercase text-white/55 font-extralight hover:text-white/85 transition-colors"
          >
            {t.miraB}
          </button>
        </div>
        <button
          data-testid="tail-hint"
          aria-label={t.tailHint}
          onClick={() => onSelectStar('tail')}
          className="pointer-events-auto whisper-btn min-h-11 min-w-11 inline-flex items-center justify-center text-[10px] tracking-[0.2em] uppercase"
        >
          {t.tailHint}
        </button>
        <AnimatePresence mode="wait">
          {hintVisible ? (
            <motion.div
              key="interaction-hint"
              data-testid="interaction-hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.3 } }}
              className="backdrop-blur-sm bg-white/5 border border-white/10 px-4 py-2 rounded-full"
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse" />
                <span className="text-[10px] tracking-[0.2em] uppercase text-white/55 font-extralight">
                  {isMobile ? t.interactionHintMobile : t.interactionHint}
                </span>
              </div>
            </motion.div>
          ) : (
            <button
              key="interaction-hint-recall"
              data-testid="interaction-hint-recall"
              aria-label={isMobile ? t.interactionHintMobile : t.interactionHint}
              onClick={() => setHintVisible(true)}
              className="pointer-events-auto whisper-btn min-h-11 min-w-11 inline-flex items-center justify-center text-xs font-extralight"
            >
              ?
            </button>
          )}
        </AnimatePresence>
      </footer>
    </div>
  );
}
