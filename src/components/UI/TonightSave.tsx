import { useEffect } from 'react';
import { useBinaryStar, useTonightSave } from '../../hooks';
import { TRANSLATIONS } from '../../constants/translations';

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
  const open = useTonightSave((state) => state.open);
  const close = useTonightSave((state) => state.close);
  const toggleDate = useTonightSave((state) => state.toggleDate);
  const togglePhrase = useTonightSave((state) => state.togglePhrase);
  const save = useTonightSave((state) => state.save);
  const retry = useTonightSave((state) => state.retry);

  const flowOpen = phase !== 'idle';

  useEffect(() => {
    if (!flowOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flowOpen, close]);

  return (
    <>
      <button
        data-testid="tonight-save"
        aria-label={t.tonightSave}
        onClick={open}
        className="pointer-events-auto min-h-11 min-w-11 inline-flex items-center justify-center text-white/30 text-xs font-extralight tracking-widest uppercase hover:text-white/60 transition-colors"
      >
        {t.tonightSave}
      </button>

      {flowOpen && (
        <div
          data-testid="tonight-panel"
          data-tonight-phase={phase}
          role="dialog"
          aria-label={t.tonightSave}
          className="pointer-events-auto absolute bottom-24 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,26rem)] backdrop-blur-md bg-black/55 border border-white/10 rounded-xl p-4 flex flex-col gap-3"
        >
          {previewUrl && (
            <img
              data-testid="tonight-preview"
              src={previewUrl}
              alt={t.tonightSave}
              className="w-full rounded-lg border border-white/5"
            />
          )}

          {phase === 'failed' && (
            <p data-testid="tonight-failure" className="text-red-300/70 text-xs font-extralight tracking-wide">
              {failure === 'context-lost' ? t.tonightSceneLost : t.tonightFailed}
            </p>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <button
                data-testid="tonight-toggle-date"
                aria-pressed={overlays.date}
                onClick={toggleDate}
                className={`min-h-11 inline-flex items-center text-[10px] font-extralight tracking-widest uppercase transition-colors ${
                  overlays.date ? 'text-white/70' : 'text-white/30 hover:text-white/60'
                }`}
              >
                {t.tonightAddDate}
              </button>
              <button
                data-testid="tonight-toggle-phrase"
                aria-pressed={overlays.phrase}
                onClick={togglePhrase}
                className={`min-h-11 inline-flex items-center text-[10px] font-extralight tracking-widest uppercase transition-colors ${
                  overlays.phrase ? 'text-white/70' : 'text-white/30 hover:text-white/60'
                }`}
              >
                {t.tonightAddPhrase}
              </button>
            </div>

            <div className="flex items-center gap-4">
              {phase === 'failed' ? (
                <button
                  data-testid="tonight-export"
                  onClick={retry}
                  className="min-h-11 inline-flex items-center text-orange-200/70 text-xs font-extralight tracking-widest uppercase hover:text-orange-200 transition-colors"
                >
                  {t.tonightRetry}
                </button>
              ) : (
                <button
                  data-testid="tonight-export"
                  disabled={phase === 'capturing' || phase === 'exporting'}
                  onClick={save}
                  className="min-h-11 inline-flex items-center text-white/60 text-xs font-extralight tracking-widest uppercase hover:text-white/85 transition-colors disabled:text-white/25"
                >
                  {phase === 'exporting' ? t.tonightSaving : phase === 'success' ? t.tonightSaved : t.tonightDownload}
                </button>
              )}
              <button
                data-testid="tonight-close"
                onClick={close}
                className="min-h-11 min-w-11 inline-flex items-center justify-center text-white/30 text-xs font-extralight tracking-widest hover:text-white/60 transition-colors"
              >
                {t.tonightClose}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
