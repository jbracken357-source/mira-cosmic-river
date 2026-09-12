import { useState, useCallback } from 'react';
import { Scene } from './components/Scene';
import { CinematicOverlay, InfoCards, ClosingMessage } from './components/UI';
import type { StarName } from './components/UI/InfoCards';
import { useBinaryStar } from './hooks';
import './App.css';

export default function App() {
  const [selectedStar, setSelectedStar] = useState<StarName | null>(null);
  const handleSelectStar = useCallback((star: StarName | null) => {
    setSelectedStar(star);
  }, []);

  const sky = useBinaryStar((state) => state.sky);
  const introComplete = useBinaryStar((state) => state.introComplete);
  if (!introComplete && selectedStar !== null) setSelectedStar(null);

  return (
    <>
      <Scene onSelectStar={handleSelectStar} />
      <div
        // Which sky the viewer opened into, readable without sampling pixels.
        data-sky-phase={sky.pulsationPhase.toFixed(4)}
        data-sky-brightness={sky.brightness.toFixed(4)}
        data-sky-orbital-phase={sky.orbitalPhase.toFixed(4)}
        className="relative w-full h-screen overflow-hidden pointer-events-none"
      >
        <CinematicOverlay />
        <InfoCards selectedStar={selectedStar} onSelectStar={handleSelectStar} />
        <ClosingMessage />
      </div>
    </>
  );
}
