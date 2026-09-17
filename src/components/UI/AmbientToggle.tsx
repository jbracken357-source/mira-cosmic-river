import { useBinaryStar, useAmbientSound } from '../../hooks';
import { TRANSLATIONS } from '../../constants/translations';

// 环境音 toggle (#22): a quiet header button, present in the explore header and
// during the full cinematic. The label is the honest state — off, playing
// (pressed), waiting for a gesture (点按开启), or failed with retry — never a
// playing claim that is not real.
export default function AmbientToggle() {
  const language = useBinaryStar((state) => state.language);
  const phase = useAmbientSound((state) => state.phase);
  const toggle = useAmbientSound((state) => state.toggle);
  const t = TRANSLATIONS[language];

  const label =
    phase === 'pending-gesture' ? t.ambientTapToStart
      : phase === 'enabling' ? t.ambientStarting
        : phase === 'failed' ? t.ambientRetry
          : t.ambientSound;

  return (
    <button
      data-testid="ambient-toggle"
      data-ambient-toggle
      data-ambient-phase={phase}
      aria-pressed={phase !== 'off' && phase !== 'failed'}
      onClick={toggle}
      className={`pointer-events-auto min-h-11 min-w-11 inline-flex items-center justify-center gap-2 text-xs font-extralight tracking-widest uppercase transition-colors ${
        phase === 'playing' ? 'text-white/55 hover:text-white/75' : 'text-white/30 hover:text-white/60'
      }`}
    >
      <span
        aria-hidden
        className={`w-1.5 h-1.5 rounded-full transition-colors ${
          phase === 'playing' ? 'bg-orange-400/70'
            : phase === 'failed' ? 'bg-red-400/60'
              : phase === 'enabling' || phase === 'pending-gesture' ? 'bg-white/30 animate-pulse'
                : 'bg-white/15'
        }`}
      />
      {label}
    </button>
  );
}
