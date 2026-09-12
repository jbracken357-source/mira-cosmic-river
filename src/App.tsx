import { useState, useCallback, useEffect } from 'react';
import { Scene } from './components/Scene';
import { CinematicOverlay, InfoCards, ClosingMessage, MilestoneHint } from './components/UI';
import type { StarName } from './components/UI/InfoCards';
import { hasFoundTail, persistFoundTail, useBinaryStar } from './hooks';
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
  }, []);

  useEffect(() => {
    if (!showTailFound) return;
    const id = window.setTimeout(() => setShowTailFound(false), 4500);
    return () => window.clearTimeout(id);
  }, [showTailFound]);

  const sky = useBinaryStar((state) => state.sky);
  const introComplete = useBinaryStar((state) => state.introComplete);
  if (!introComplete && selectedStar !== null) setSelectedStar(null);
  if (!introComplete && showTailFound) setShowTailFound(false);

  return (
    <>
      <Scene onSelectStar={handleSelectStar} />
      <div
        // Which sky the viewer opened into, readable without sampling pixels.
        data-sky-phase={sky.pulsationPhase.toFixed(4)}
        data-sky-brightness={sky.brightness.toFixed(4)}
        data-sky-orbital-phase={sky.orbitalPhase.toFixed(4)}
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
