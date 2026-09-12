import { useState, useCallback, useEffect } from 'react';
import { Scene } from './components/Scene';
import { CinematicOverlay, InfoCards, ClosingMessage } from './components/UI';
import type { StarName } from './components/UI/InfoCards';
import { useBinaryStar } from './hooks';
import { currentSkyState, SKY_REFRESH_INTERVAL_MS } from './lib/starClock';
import './App.css';

export default function App() {
  const [selectedStar, setSelectedStar] = useState<StarName | null>(null);
  const handleSelectStar = useCallback((star: StarName | null) => {
    setSelectedStar(star);
  }, []);

  const sky = useBinaryStar((state) => state.sky);

  // The store already holds a sky read at load. Keeping it fresh has to happen on a timer
  // rather than during a render, because reading the clock is not pure.
  useEffect(() => {
    const refreshSky = () => useBinaryStar.getState().setSky(currentSkyState());
    const timer = setInterval(refreshSky, SKY_REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

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
