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
      className={`pointer-events-auto min-h-11 min-w-11 inline-flex items-center justify-center gap-2 text-[11px] md:text-xs font-extralight tracking-widest uppercase transition-colors ${
        phase === 'playing' ? 'text-white/70 hover:text-white/90' : 'whisper-btn'
      }`}
    >
      {/* The dot is the sound's state, nothing else: a hollow ring when idle, a lit
          pearl when playing, pulsing while starting, red on failure. Geometry never
          changes, so the header does not reflow as the state moves. */}
      <span
        aria-hidden
        className={`w-1.5 h-1.5 rounded-full transition-colors ${
          phase === 'playing' ? 'bg-[#f2d8a8]'
            : phase === 'failed' ? 'bg-red-400/70'
              : phase === 'enabling' || phase === 'pending-gesture' ? 'bg-white/50 animate-pulse'
                : 'border border-white/30'
        }`}
      />
      {label}
    </button>
  );
}
