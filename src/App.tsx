import { useState, useCallback, useEffect } from 'react';
import { Scene } from './components/Scene';
import { CinematicOverlay, InfoCards, ClosingMessage, MilestoneHint } from './components/UI';
import type { StarName } from './components/UI/InfoCards';
import { hasFoundTail, persistFoundTail, useBinaryStar, useIntentionalInput } from './hooks';
import { initAmbientSound, useAmbientSound } from './hooks/useAmbientSound';
import './App.css';

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
  if (!introComplete && selectedStar !== null) setSelectedStar(null);
  if (!introComplete && showTailFound) setShowTailFound(false);

  // Replay (or any return to the opening) also releases the reading-card idle hold.
  // External-store writes belong in an effect, not in the render pass above.
  useEffect(() => {
    if (!introComplete) useBinaryStar.getState().setCardOpen(false);
  }, [introComplete]);

  return (
    <>
      <Scene onSelectStar={handleSelectStar} />
      <div
        // Which sky the viewer opened into, readable without sampling pixels.
        data-sky-phase={sky.pulsationPhase.toFixed(4)}
        data-sky-brightness={sky.brightness.toFixed(4)}
        data-sky-orbital-phase={sky.orbitalPhase.toFixed(4)}
        // Viewer-control observability for e2e: who owns the camera right now.
        data-auto-camera={autoCamera}
        data-epilogue={epilogueVisible ? 'true' : 'false'}
        // Ambient sound (#22): the honest phase, dev-only like data-camera-pose.
        {...(!import.meta.env.PROD ? { 'data-ambient-state': ambientPhase } : {})}
        className="relative w-full h-dvh overflow-hidden pointer-events-none"
      >
        <CinematicOverlay onSelectStar={handleSelectStar} />
        <InfoCards
          selectedStar={selectedStar}
          onSelectStar={handleSelectStar}
          showTailFound={showTailFound}
        />
        <ClosingMessage />
        <MilestoneHint />
      </div>
    </>
  );
}
