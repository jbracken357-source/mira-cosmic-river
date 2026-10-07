import { useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useBinaryStar, useMobile } from '../../hooks';
import { TRANSLATIONS } from '../../constants/translations';
import { EASE, INFO_CARD } from '../../constants/animation';
import { phaseReadout } from '../../lib/starClock';

export type StarName = 'miraA' | 'miraB' | 'tail';

interface InfoCardsProps {
  selectedStar: StarName | null;
  onSelectStar: (star: StarName | null) => void;
}

export default function InfoCards({ selectedStar, onSelectStar }: InfoCardsProps) {
  const language = useBinaryStar((state) => state.language);
  const sky = useBinaryStar((state) => state.sky);
  const t = TRANSLATIONS[language];
  const isMobile = useMobile();
  const reduceMotion = Boolean(useReducedMotion());
  // #20: enter 180–240ms / exit 120–180ms; reduced motion fades instantly and
  // never displaces (no y offset at all).
  const enterDur = reduceMotion ? 0 : INFO_CARD.ENTER;
  const exitDur = reduceMotion ? 0 : INFO_CARD.EXIT;
  const riseEnter = reduceMotion ? 0 : isMobile ? 24 : 8;
  const riseExit = reduceMotion ? 0 : isMobile ? 16 : 6;
  const readout = phaseReadout(sky);
  const daysToMax = Math.round(readout.daysToNextMaximum);
  const daysToMin = Math.round(readout.daysToNextMinimum);
  const phaseLine =
    readout.milestone === 'maximum' || daysToMax === 0
      ? t.phaseAtMaximum
      : readout.milestone === 'minimum' || daysToMin === 0
        ? t.phaseAtMinimum
        : readout.direction === 'brightening'
          ? t.phaseDaysToMax.replace('{n}', String(daysToMax))
          : t.phaseDaysToMin.replace('{n}', String(daysToMin));

  // Focus bookkeeping (#20): the card is non-modal (no focus lock), but opening it
  // moves focus onto the card so Esc and Tab start from a sensible place, and
  // closing returns focus to whatever opened it (canvas click → body, which is a
  // no-op; keyboard trigger → the trigger button). The focus happens in the ref
  // callback, not an effect: with AnimatePresence mode="wait", switching directly
  // from one card to another mounts the new card only after the old one exits, and
  // an effect would fire while the ref still points at the leaving node.
  const returnFocusRef = useRef<Element | null>(null);
  const hadCardRef = useRef(false);
  const prevStarRef = useRef<StarName | null>(null);

  const handleCardRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    // The return target is captured on the FIRST open only; a card-to-card switch
    // keeps the original entry so closing still lands back where reading started.
    if (!hadCardRef.current) returnFocusRef.current = document.activeElement;
    hadCardRef.current = true;
    node.focus();
  }, []);

  useEffect(() => {
    if (!selectedStar && prevStarRef.current) {
      const el = returnFocusRef.current;
      if (el instanceof HTMLElement && el.isConnected) el.focus();
      returnFocusRef.current = null;
      hadCardRef.current = false;
    }
    prevStarRef.current = selectedStar;
  }, [selectedStar]);

  // Esc closes from anywhere while a card is open; the listener only exists then.
  useEffect(() => {
    if (!selectedStar) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSelectStar(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedStar, onSelectStar]);

  // The first line says the relationship; the science paragraph follows whole (#89).
  // The tail's first line is the road sentence (#91): 「走过的路，留成一条光河。」
  const cardData: Record<StarName, { title: string; firstLine: string | null; desc: string; color: string; accent: string }> = {
    miraA: {
      title: t.miraA,
      firstLine: t.miraAFirstLine,
      desc: t.miraADesc,
      color: 'from-orange-500/20',
      accent: 'border-orange-400/40',
    },
    miraB: {
      title: t.miraB,
      firstLine: t.miraBFirstLine,
      desc: t.miraBDesc,
      color: 'from-blue-400/20',
      accent: 'border-blue-300/40',
    },
    tail: {
      title: t.tailLabel,
      firstLine: t.tailFirstLine,
      desc: t.tailDesc,
      color: 'from-violet-500/20',
      accent: 'border-violet-400/40',
    },
  };

  const card = selectedStar ? (
    <motion.div
      key={selectedStar}
      ref={handleCardRef}
      tabIndex={-1}
      role="region"
      aria-label={cardData[selectedStar].title}
      data-testid="info-card"
      initial={{ opacity: 0, y: riseEnter }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: riseExit, transition: { duration: exitDur, ease: EASE.OUT } }}
      transition={{ duration: enterDur, ease: EASE.OUT }}
      className={
        isMobile
          ? 'relative z-20 pointer-events-auto w-full'
          : 'absolute top-24 left-4 md:left-14 z-20 pointer-events-auto max-w-xs md:max-w-sm'
      }
    >
      <div
        className={`relative bg-gradient-to-br ${cardData[selectedStar].color} to-transparent backdrop-blur-md border ${cardData[selectedStar].accent} shadow-[0_18px_50px_rgba(0,0,0,0.5)] ${
          isMobile
            ? 'rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]'
            : 'rounded-lg p-4 md:p-5'
        }`}
      >
        <button
          data-testid="info-card-close"
          aria-label={t.tonightClose}
          onClick={() => onSelectStar(null)}
          className="absolute top-1 right-1 min-h-11 min-w-11 inline-flex items-center justify-center text-white/45 hover:text-white/85 transition-colors text-xl leading-none"
        >
          ×
        </button>

        <h3 className="font-display text-xl md:text-2xl text-white/90 mb-2 tracking-wide">
          {cardData[selectedStar].title}
        </h3>

        {cardData[selectedStar].firstLine && (
          <p
            data-testid="info-card-first-line"
            className="text-xs md:text-sm text-white/80 font-extralight leading-relaxed mb-2 text-pretty"
          >
            {cardData[selectedStar].firstLine}
          </p>
        )}

        <p
          data-testid="info-card-science"
          className="text-xs md:text-sm text-white/65 font-extralight leading-relaxed mb-4 text-pretty"
        >
          {cardData[selectedStar].desc}
        </p>

        {selectedStar === 'miraA' && (
          <div className="mb-1">
            <p
              data-phase-days-to-max={daysToMax}
              data-phase-days-to-min={daysToMin}
              data-phase-direction={readout.direction}
              data-phase-milestone={readout.milestone}
              className="text-xs md:text-sm text-white/75 font-extralight leading-relaxed"
            >
              {phaseLine}
            </p>
            {readout.milestone === 'none' && (
              <p className="text-[10px] tracking-[0.15em] uppercase text-white/35 font-extralight mt-1">
                {readout.direction === 'brightening' ? t.phaseBrightening : t.phaseFading}
              </p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  ) : null;

  if (isMobile) {
    return (
      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-stretch pointer-events-none">
        <AnimatePresence mode="wait">{card}</AnimatePresence>
      </div>
    );
  }

  return <AnimatePresence mode="wait">{card}</AnimatePresence>;
}
