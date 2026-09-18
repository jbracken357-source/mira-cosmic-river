import { Component, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Scene } from './components/Scene';
import { CinematicOverlay, InfoCards, ClosingMessage, MilestoneHint, SceneFallback } from './components/UI';
import type { StarName } from './components/UI/InfoCards';
import { hasFoundTail, persistFoundTail, useBinaryStar, useEntryReadiness, useIntentionalInput, initAmbientSound, useAmbientSound } from './hooks';
import { currentSkyState } from './lib/starClock';
import { dailySkyCoupling } from './lib/riverLighting';
import './App.css';

// If the canvas dies during creation (the probe passed but the real context
// still failed), the whole entry degrades to the static fallback instead of a
// white page.
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    useEntryReadiness.getState().noteSceneAccess('create-failed');
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function App() {
  const [selectedStar, setSelectedStar] = useState<StarName | null>(null);
  const [showTailFound, setShowTailFound] = useState(false);
  const handleSelectStar = useCallback((star: StarName | null) => {
    if (star === 'tail' && !hasFoundTail()) {
      persistFoundTail();
      setShowTailFound(true);
    } else if (star !== 'tail') {
      setShowTailFound(false);
    }
    setSelectedStar(star);
    // Reading a card holds the idle takeover; the hold ends when the card closes.
    useBinaryStar.getState().setCardOpen(star !== null);
  }, []);

  useIntentionalInput();
  // The ambient sound shell (visibility, gestures, the one graph). Idempotent.
  useEffect(() => initAmbientSound(), []);

  // Re-read the star clock when the tab returns to the foreground (#27): the sky the
  // viewer comes back to is tonight's sky, not the sky the tab was opened with. No
  // polling — the sky moves on a daily scale; the no-catch-up motion policy on the same
  // return path belongs to advanceTime, which this does not touch.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) useBinaryStar.getState().setSky(currentSkyState());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const language = useBinaryStar((state) => state.language);
  // Keep the document language honest with the copy on screen (#20).
  useEffect(() => {
    document.documentElement.lang = language === 'ch' ? 'zh-CN' : 'en';
  }, [language]);

  useEffect(() => {
    if (!showTailFound) return;
    const id = window.setTimeout(() => setShowTailFound(false), 4500);
    return () => window.clearTimeout(id);
  }, [showTailFound]);

  const sky = useBinaryStar((state) => state.sky);
  const introComplete = useBinaryStar((state) => state.introComplete);
  const autoCamera = useBinaryStar((state) => state.autoCamera);
  const epilogueVisible = useBinaryStar((state) => state.epilogueVisible);
  const ambientPhase = useAmbientSound((state) => state.phase);
  const entryGate = useEntryReadiness((state) => state.gate);
  const sceneAccess = useEntryReadiness((state) => state.sceneAccess);
  if (!introComplete && selectedStar !== null) setSelectedStar(null);
  if (!introComplete && showTailFound) setShowTailFound(false);

  // Replay (or any return to the opening) also releases the reading-card idle hold.
  // External-store writes belong in an effect, not in the render pass above.
  useEffect(() => {
    if (!introComplete) useBinaryStar.getState().setCardOpen(false);
  }, [introComplete]);

  const sceneAvailable = sceneAccess !== 'unavailable';

  return (
    <>
      {sceneAvailable && (
        <SceneBoundary>
          <Scene onSelectStar={handleSelectStar} />
        </SceneBoundary>
      )}
      <div
        // Which sky the viewer opened into, readable without sampling pixels.
        data-sky-phase={sky.pulsationPhase.toFixed(4)}
        data-sky-brightness={sky.brightness.toFixed(4)}
        data-sky-orbital-phase={sky.orbitalPhase.toFixed(4)}
        // The daily river density (#27), readable without sampling pixels.
        data-sky-density={dailySkyCoupling(sky).density.toFixed(4)}
        // Viewer-control observability for e2e: who owns the camera right now.
        data-auto-camera={autoCamera}
        data-epilogue={epilogueVisible ? 'true' : 'false'}
        // Entry readiness (#24): what the cinematic gate is waiting on, if anything.
        data-entry-gate={entryGate}
        // Ambient sound (#22): the honest phase, dev-only like data-camera-pose.
        {...(!import.meta.env.PROD ? { 'data-ambient-state': ambientPhase } : {})}
        className="relative w-full h-dvh overflow-hidden pointer-events-none"
      >
        {sceneAvailable && (
          <>
            <CinematicOverlay onSelectStar={handleSelectStar} />
            <InfoCards
              selectedStar={selectedStar}
              onSelectStar={handleSelectStar}
              showTailFound={showTailFound}
            />
            <ClosingMessage />
            <MilestoneHint />
          </>
        )}
      </div>
      {!sceneAvailable && <SceneFallback reason="webgl-unavailable" />}
      {sceneAccess === 'lost' && <SceneFallback reason="context-lost" />}
    </>
  );
}
