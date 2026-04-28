import { useState, useCallback } from 'react';
import { Scene } from './components/Scene';
import { CinematicOverlay, InfoCards, ClosingMessage } from './components/UI';
import type { StarName } from './components/UI/InfoCards';
import './App.css';

export default function App() {
  const [selectedStar, setSelectedStar] = useState<StarName | null>(null);
  const handleSelectStar = useCallback((star: StarName | null) => {
    setSelectedStar(star);
  }, []);

  return (
    <>
      <Scene onSelectStar={handleSelectStar} />
      <div className="relative w-full h-screen overflow-hidden pointer-events-none">
        <CinematicOverlay />
        <InfoCards selectedStar={selectedStar} onSelectStar={handleSelectStar} />
        <ClosingMessage />
      </div>
    </>
  );
}
