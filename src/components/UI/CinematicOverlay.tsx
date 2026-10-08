import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useBinaryStar, useMobile, useEntryReadiness, useTonightSave } from '../../hooks';
import { TRANSLATIONS } from '../../constants/translations';
import { TRANSITIONS } from '../../constants/animation';
import { openingSegment } from '../../lib/openingTimeline';
import { topBarVisibility } from '../../lib/topBarVisibility';
import { rememberFlag, rememberedFlag } from '../../lib/rememberedFlag';
import type { StarName } from './InfoCards';
import AmbientToggle from './AmbientToggle';
import LowerEdge from './LowerEdge';
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

  const handleLookMyself = () => {
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
      {/* Top-right control cluster during the opening: 环境音 and 语言 stay through
          the whole sequence, and 「我自己看」 (#90) leaves it early. The leave button
          wears a quiet pill so it never reads as a sibling of the bare language
          switch beside it. */}
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] pointer-events-auto z-50 flex items-center gap-5 md:gap-7">
        <AmbientToggle />
        <button
          data-testid="look-myself"
          onClick={handleLookMyself}
          className="whisper-btn min-h-11 px-4 inline-flex items-center justify-center text-[11px] md:text-xs font-extralight tracking-widest border border-white/15 rounded-full hover:border-white/35"
        >
          {t.lookMyself}
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
            exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : TRANSITIONS.CAPTION_EXIT } }}
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
            data-testid="final-title"
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
              data-testid="opening-subtitle"
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
  const manipulated = useBinaryStar((state) => state.exploreManipulated);
  const awayFromMainView = useBinaryStar((state) => state.awayFromMainView);
  const tonightOpen = useTonightSave((state) => state.phase !== 'idle');
  const t = TRANSLATIONS[language];
  const isMobile = useMobile();
  const reduceMotion = Boolean(useReducedMotion());

  // The epilogue is the emotional close: the whole interface lets go of the screen,
  // first intentional input (which ends the epilogue) brings it back.
  const epilogueHush = epilogueVisible;
  // While a panel owns the viewer's attention the ambient hints step aside — the
  // mobile bottom sheet would sit on top of them anyway.
  const hintsQuiet = tonightOpen || (isMobile && cardOpen);

  // 顶栏 (#90): the quiet first look holds 环境音, 语言 and 完整开场 only; the
  // visit's first drag or zoom graduates 暂停 and 今晚的 Mira, and 主视角 exists
  // only while the camera is off the main view.
  const bar = topBarVisibility({ manipulated, awayFromMainView });

  // The interaction hint leaves once the viewer has actually manipulated the scene
  // (drag/zoom land on the canvas; presses on UI buttons do not count). 学会 is
  // remembered across visits like the seen-opening flag — and once learned, no
  // 「?」 recall ever takes the hint's place (#90). The same first manipulation
  // graduates the quiet top bar for this visit. Once the flag is on, gestures
  // never write storage again — the read-back guard keeps them to a cheap lookup.
  const [hintDismissed, setHintDismissed] = useState(() => hasLearnedControls());
  useEffect(() => {
    const note = (event: Event) => {
      if (!(event.target instanceof HTMLCanvasElement)) return;
      if (!hasLearnedControls()) persistLearnedControls();
      setHintDismissed(true);
      useBinaryStar.getState().noteExploreManipulation();
    };
    window.addEventListener('pointerdown', note, { passive: true });
    window.addEventListener('wheel', note, { passive: true });
    window.addEventListener('touchstart', note, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', note);
      window.removeEventListener('wheel', note);
      window.removeEventListener('touchstart', note);
    };
  }, []);

  return (
    <div
      data-testid="explore-ui"
      className="relative z-10 flex h-dvh w-full pointer-events-none select-none overflow-hidden"
    >
      {/* 顶栏: the exit is the epilogue's own budget (#90, TRANSITIONS.
          TOP_BAR_EPILOGUE_EXIT, 0.3–0.5s); the slower return (TRANSITIONS.
          TOP_BAR_EPILOGUE_RETURN) comes after the interrupt. CSS takes the
          duration from the destination state, so one property carries both. */}
      <header
        data-testid="top-bar"
        style={{
          transitionDuration: epilogueHush
            ? `${TRANSITIONS.TOP_BAR_EPILOGUE_EXIT * 1000}ms`
            : `${TRANSITIONS.TOP_BAR_EPILOGUE_RETURN * 1000}ms`,
        }}
        className={`absolute top-0 left-0 right-0 px-4 md:px-14 pt-[max(1rem,env(safe-area-inset-top))] pb-4 md:pb-8 flex items-center justify-between transition-opacity ${
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
          {bar.returnToView && (
            <button
              data-testid="return-to-view"
              onClick={() => useBinaryStar.getState().requestReturnToExplore()}
              className="pointer-events-auto whisper-btn min-h-11 min-w-11 inline-flex items-center justify-center text-[11px] md:text-xs font-extralight tracking-widest uppercase"
            >
              {t.returnToView}
            </button>
          )}
          {bar.tonightSave && <TonightSave />}
          <AmbientToggle />
          {bar.pause && (
            <button
              data-testid="pause-toggle"
              aria-pressed={!isPlaying}
              aria-label={isPlaying ? t.pause : t.resume}
              onClick={() => useBinaryStar.getState().setPlaying(!isPlaying)}
              className="pointer-events-auto whisper-btn min-h-11 min-w-11 inline-flex items-center justify-center text-[11px] md:text-xs font-extralight tracking-widest uppercase"
            >
              {isPlaying ? t.pause : t.resume}
            </button>
          )}
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

      {/* Bottom hint — the lower edge (#88) holds the closing line of the full
          cinematic; the interaction pill sits above it so the line keeps the row.
          The row's fade shares the top bar's slower return budget (TRANSITIONS.
          TOP_BAR_EPILOGUE_RETURN): the interface leaves with the epilogue and
          comes back with it, one duration for both directions. */}
      <footer
        style={{ transitionDuration: `${TRANSITIONS.TOP_BAR_EPILOGUE_RETURN * 1000}ms` }}
        className={`absolute bottom-0 left-0 right-0 px-8 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-8 pt-2 flex flex-col items-center gap-3 transition-opacity ${
          epilogueHush || hintsQuiet ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        {/* Keyboard entry to the two stars and the tail (#20, #88): the canvas
            itself is not focusable, so these triggers stay screen-reader reachable
            and only become visible when tabbed to. */}
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
          <button
            data-testid="star-trigger-tail"
            onClick={() => onSelectStar('tail')}
            className="min-h-11 min-w-11 inline-flex items-center justify-center backdrop-blur-sm bg-white/5 border border-white/10 px-4 rounded-full text-[10px] tracking-[0.2em] uppercase text-white/55 font-extralight hover:text-white/85 transition-colors"
          >
            {t.tailLabel}
          </button>
        </div>
        <AnimatePresence mode="wait">
          {hintDismissed ? null : (
            <motion.div
              key="interaction-hint"
              data-testid="interaction-hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : TRANSITIONS.INTERACTION_HINT_EXIT } }}
              className="backdrop-blur-sm bg-white/5 border border-white/10 px-4 py-2 rounded-full"
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse" />
                <span className="text-[10px] tracking-[0.2em] uppercase text-white/55 font-extralight">
                  {isMobile ? t.interactionHintMobile : t.interactionHint}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* 终幕那句 lives at the lower edge; the milestone hint borrows the row. */}
        <LowerEdge />
      </footer>
    </div>
  );
}
