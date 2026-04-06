import { motion } from 'framer-motion';
import { useBinaryStar } from '../../hooks';
import type { VisualMode } from '../../types';
import { ANIMATION, COLORS } from '../../constants';

const MODE_LABELS = {
  en: {
    glow: 'GLOW',
    wave: 'WAVE',
    particles: 'PARTICLES',
  },
  ch: {
    glow: '辉光',
    wave: '波动',
    particles: '粒子',
  },
};

const MODE_COLORS: Record<VisualMode, string> = {
  glow: COLORS.STELLAR_ORANGE,
  wave: COLORS.NEBULA_VIOLET,
  particles: COLORS.WHITE_DWARF_BLUE,
};

export default function ModeToggle() {
  const mode = useBinaryStar((state) => state.mode);
  const setMode = useBinaryStar((state) => state.setMode);
  const language = useBinaryStar((state) => state.language);

  const labels = MODE_LABELS[language];

  const modes: VisualMode[] = ['glow', 'wave', 'particles'];

  return (
    <div
      className="flex gap-1"
      role="radiogroup"
      aria-label="Visual Mode"
    >
      {modes.map((m) => (
        <motion.button
          key={m}
          onClick={() => setMode(m)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: ANIMATION.INTRO_STAGGER.MODE_BUTTONS / 1000 + modes.indexOf(m) * 0.1,
            duration: 0.3,
          }}
          className={`px-3 py-1 rounded-lg font-mono text-xs transition-all ${
            mode === m
              ? 'border-2'
              : 'border border-transparent'
          }`}
          style={{
            borderColor: mode === m ? MODE_COLORS[m] : 'transparent',
            backgroundColor: mode === m ? `${MODE_COLORS[m]}33` : COLORS.GLASS_BASE,
            color: mode === m ? MODE_COLORS[m] : COLORS.SOLAR_WHITE,
          }}
          role="radio"
          aria-checked={mode === m}
          aria-label={labels[m]}
        >
          {labels[m]}
        </motion.button>
      ))}
    </div>
  );
}