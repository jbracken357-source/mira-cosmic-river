import { COLORS, ENTRY_STILL, TRANSLATIONS } from '../../constants';
import { useBinaryStar } from '../../hooks';

// The static fallback (#24): shown when WebGL is unavailable or the context is
// lost. It is deliberately not explorable — the recorded still holds the place,
// honest copy says so, and retry (a reload) is the only action. The still's
// source scene version is stamped into data-still-source so the provenance is
// inspectable from the page itself (ticket 11 re-makes the still on new art).
export default function SceneFallback({ reason }: { reason: 'webgl-unavailable' | 'context-lost' }) {
  const language = useBinaryStar((state) => state.language);
  const t = TRANSLATIONS[language];
  return (
    <div
      data-testid="scene-fallback"
      data-fallback-reason={reason}
      data-still-source={ENTRY_STILL.version}
      className="fixed inset-0 z-20 flex items-center justify-center select-none"
      style={{
        background: COLORS.DEEP_SPACE,
        backgroundImage: `url(${import.meta.env.BASE_URL}${ENTRY_STILL.src})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative flex flex-col items-center gap-4 px-8 text-center max-w-md">
        <p className="text-white/85 text-lg font-extralight tracking-wide">
          {reason === 'webgl-unavailable' ? t.sceneUnavailableTitle : t.sceneLostTitle}
        </p>
        <p className="text-white/45 text-sm font-extralight leading-relaxed">
          {reason === 'webgl-unavailable' ? t.sceneUnavailableBody : t.sceneLostBody}
        </p>
        <p className="text-white/25 text-[10px] font-extralight tracking-[0.2em] uppercase">
          {t.stillCaption.replace('{version}', ENTRY_STILL.version)}
        </p>
        <button
          data-testid="scene-fallback-retry"
          onClick={() => window.location.reload()}
          className="pointer-events-auto mt-2 min-h-11 px-6 inline-flex items-center justify-center text-white/60 text-xs font-extralight tracking-widest uppercase border border-white/15 rounded-full hover:text-white/85 hover:border-white/30 transition-colors"
        >
          {t.sceneRetry}
        </button>
      </div>
    </div>
  );
}
