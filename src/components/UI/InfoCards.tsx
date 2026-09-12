import { motion, AnimatePresence } from 'framer-motion';
import { useBinaryStar } from '../../hooks';
import { TRANSLATIONS } from '../../constants/translations';
import { EASE } from '../../constants/animation';

export type StarName = 'miraA' | 'miraB' | 'tail';

interface InfoCardsProps {
  selectedStar: StarName | null;
  onSelectStar: (star: StarName | null) => void;
  showTailFound: boolean;
}

export default function InfoCards({ selectedStar, onSelectStar, showTailFound }: InfoCardsProps) {
  const language = useBinaryStar((state) => state.language);
  const timeSpeed = useBinaryStar((state) => state.parameters.timeSpeed);
  const setParameter = useBinaryStar((state) => state.setParameter);
  const t = TRANSLATIONS[language];

  const cardData: Record<StarName, { title: string; desc: string; color: string; accent: string }> = {
    miraA: {
      title: t.miraA,
      desc: t.miraADesc,
      color: 'from-orange-500/20',
      accent: 'border-orange-400/40',
    },
    miraB: {
      title: t.miraB,
      desc: t.miraBDesc,
      color: 'from-blue-400/20',
      accent: 'border-blue-300/40',
    },
    tail: {
      title: t.tailLabel,
      desc: t.tailDesc,
      color: 'from-violet-500/20',
      accent: 'border-violet-400/40',
    },
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {selectedStar && (
          <motion.div
            key={selectedStar}
            data-testid="info-card"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.5, ease: EASE.OUT }}
            className="absolute top-24 left-4 md:left-8 z-20 pointer-events-auto max-w-xs md:max-w-sm"
          >
            <div
              className={`bg-gradient-to-br ${cardData[selectedStar].color} to-transparent backdrop-blur-md border ${cardData[selectedStar].accent} rounded-lg p-4 md:p-5`}
            >
              {/* Close button */}
              <button
                onClick={() => onSelectStar(null)}
                className="absolute top-2 right-2 text-white/30 hover:text-white/60 transition-colors text-lg leading-none"
              >
                ×
              </button>

              {/* Title */}
              <h3 className="font-display text-xl md:text-2xl text-white/90 italic mb-2">
                {cardData[selectedStar].title}
              </h3>

              {/* Description */}
              <p className="text-xs md:text-sm text-white/60 font-extralight leading-relaxed mb-4">
                {cardData[selectedStar].desc}
              </p>

              {/* Time Speed slider — only on tail card */}
              {selectedStar === 'tail' && (
                <div className="flex items-center gap-3">
                  <span className="text-[9px] tracking-[0.2em] uppercase text-white/30 font-extralight">
                    {t.timeSpeed}
                  </span>
                  <input
                    type="range"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={timeSpeed}
                    onChange={(e) => setParameter('timeSpeed', parseFloat(e.target.value))}
                    className="flex-1 h-[2px] bg-white/10 rounded-full appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-3
                      [&::-webkit-slider-thumb]:h-3
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-orange-400/80
                      [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(255,107,53,0.5)]"
                  />
                  <span className="text-[10px] text-white/40 font-mono w-8 text-right">
                    {timeSpeed.toFixed(1)}x
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showTailFound && (
          <motion.p
            data-testid="tail-found"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: EASE.OUT }}
            className="absolute bottom-20 left-0 right-0 z-20 flex justify-center pointer-events-none text-white/45 text-sm italic font-extralight tracking-wide"
          >
            {t.tailFound}
          </motion.p>
        )}
      </AnimatePresence>
    </>
  );
}
