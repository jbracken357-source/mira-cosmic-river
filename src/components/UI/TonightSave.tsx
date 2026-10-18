import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useBinaryStar, useTonightSave } from '../../hooks';
import { TRANSLATIONS } from '../../constants/translations';
import { primaryAction } from '../../lib/tonightSave';

// 今晚的 Mira (#23): a quiet header entry plus the save panel. Pressing the entry
// captures the current frame in that same task (the shell forces one render and
// reads it back at once — preserveDrawingBuffer stays off). The panel is part of
// the save action, not a settings panel: overlay options re-compose the locked
// snapshot, closing discards it, and reopening captures a fresh one.
export default function TonightSave() {
  const language = useBinaryStar((state) => state.language);
  const t = TRANSLATIONS[language];
  const phase = useTonightSave((state) => state.phase);
  const failure = useTonightSave((state) => state.failure);
  const overlays = useTonightSave((state) => state.overlays);
  const previewUrl = useTonightSave((state) => state.previewUrl);
  const starsOffscreen = useTonightSave((state) => state.starsOffscreen);
  const open = useTonightSave((state) => state.open);
  const close = useTonightSave((state) => state.close);
  const toggleDate = useTonightSave((state) => state.toggleDate);
  const togglePhrase = useTonightSave((state) => state.togglePhrase);
  const save = useTonightSave((state) => state.save);
  const retry = useTonightSave((state) => state.retry);
  const recapture = useTonightSave((state) => state.recapture);

  const entryRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const flowOpen = phase !== 'idle';
  const reduceMotion = Boolean(useReducedMotion());

  useEffect(() => {
    if (!flowOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flowOpen, close]);

  // 焦点 (#114): the open panel receives focus so keyboard viewers land inside it,
  // and closing hands focus back to the entry — the panel never traps it, Esc and
  // Tab keep working as anywhere else.
  useEffect(() => {
    if (!flowOpen) return;
    const entry = entryRef.current;
    panelRef.current?.focus();
    return () => entry?.focus();
  }, [flowOpen]);

  // The overlay option chips: a quiet state dot says on/off at a glance, the way
  // the words alone never quite did.
  const optionChip = (active: boolean) =>
    `min-h-11 inline-flex items-center gap-2 text-[10px] font-extralight tracking-widest transition-colors ${
      active ? 'text-white/75' : 'text-white/45 hover:text-white/70'
    }`;
  const optionDot = (active: boolean) =>
    `w-1.5 h-1.5 rounded-full transition-colors ${active ? 'bg-[#fef3c7]/85' : 'bg-white/20'}`;

  // The offscreen row rides the snapshot it describes (#114): shown while a locked
  // frame is on screen, gone with the discard-and-retake flight.
  const offscreenRow = starsOffscreen && (phase === 'preview' || phase === 'success' || phase === 'failed');

  return (
    <>
      <button
        ref={entryRef}
        data-testid="tonight-save"
        aria-label={t.tonightSave}
        onClick={open}
        // 顶栏的句首大写 (#110): #90's "never all-caps MIRA" holds for the whole
        // row now — every control keeps the casing it is written with.
        className="pointer-events-auto whisper-btn min-h-11 min-w-11 inline-flex items-center justify-center text-[11px] md:text-xs font-extralight tracking-widest"
      >
        {t.tonightSave}
      </button>

      {flowOpen && (
        <motion.div
          ref={panelRef}
          data-testid="tonight-panel"
          data-tonight-phase={phase}
          role="dialog"
          aria-label={t.tonightSave}
          tabIndex={-1}
          initial={{ opacity: 0, y: reduceMotion ? 0 : 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-auto fixed left-3 right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-24 z-50 md:w-[min(92vw,26rem)] backdrop-blur-md bg-black/65 border border-white/10 rounded-xl p-4 md:p-5 flex flex-col gap-3 shadow-[0_24px_60px_rgba(0,0,0,0.55)] max-h-[calc(100dvh-1.5rem)] overflow-y-auto focus:outline-none"
        >
          <div className="flex items-center justify-between">
            {/* The panel's own title is the same name — mixed case here too (#90). */}
            <p className="text-[10px] tracking-[0.25em] text-white/45 font-extralight">
              {t.tonightSave}
            </p>
            <button
              data-testid="tonight-close"
              onClick={close}
              className="whisper-btn min-h-11 min-w-11 -mr-2 inline-flex items-center justify-center text-xs font-extralight tracking-widest"
            >
              {t.tonightClose}
            </button>
          </div>

          {previewUrl && (
            <img
              data-testid="tonight-preview"
              src={previewUrl}
              alt={t.tonightSave}
              className="max-h-[38dvh] w-auto mx-auto rounded-lg border border-white/10"
            />
          )}

          {offscreenRow && (
            <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-1">
              <p data-testid="tonight-offscreen" className="text-[10px] tracking-[0.2em] text-white/45 font-extralight">
                {t.tonightOffscreen}
              </p>
              <button
                data-testid="tonight-recapture"
                onClick={recapture}
                className="min-h-11 px-5 rounded-full border border-white/25 text-white/70 text-xs font-extralight tracking-widest hover:bg-white/10 transition-colors"
              >
                {t.tonightRecapture}
              </button>
            </div>
          )}

          {phase === 'failed' && (
            <p data-testid="tonight-failure" className="text-red-300/70 text-xs font-extralight tracking-wide">
              {failure === 'context-lost' ? t.tonightSceneLost : t.tonightFailed}
            </p>
          )}

          <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-1">
            <div className="flex items-center gap-4">
              <button
                data-testid="tonight-toggle-date"
                aria-pressed={overlays.date}
                onClick={toggleDate}
                className={optionChip(overlays.date)}
              >
                <span aria-hidden className={optionDot(overlays.date)} />
                {t.tonightAddDate}
              </button>
              <button
                data-testid="tonight-toggle-phrase"
                aria-pressed={overlays.phrase}
                onClick={togglePhrase}
                className={optionChip(overlays.phrase)}
              >
                <span aria-hidden className={optionDot(overlays.phrase)} />
                {t.tonightAddPhrase}
              </button>
            </div>

            {primaryAction(phase) === 'retry' ? (
              <button
                data-testid="tonight-export"
                onClick={retry}
                className="min-h-11 px-5 rounded-full border border-orange-200/30 text-orange-200/80 text-xs font-extralight tracking-widest hover:bg-orange-200/10 transition-colors"
              >
                {t.tonightRetry}
              </button>
            ) : (
              <button
                data-testid="tonight-export"
                disabled={primaryAction(phase) === 'disabled'}
                onClick={save}
                className="min-h-11 px-5 rounded-full border border-[#fef3c7]/35 bg-[#fef3c7]/15 text-[#fef3c7] text-xs font-extralight tracking-widest hover:bg-[#fef3c7]/25 transition-colors disabled:opacity-40 disabled:hover:bg-[#fef3c7]/15"
              >
                {phase === 'exporting' ? t.tonightSaving : phase === 'success' ? t.tonightSaved : t.tonightDownload}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </>
  );
}
