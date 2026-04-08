import { Scene } from './components/Scene';
import { UI, IntroAnimation } from './components/UI';
import './App.css';

export default function App() {
  return (
    <main className="relative w-full h-screen overflow-hidden bg-deep-space">
      {/* 3D Scene */}
      <Scene />

      {/* UI Overlay */}
      <IntroAnimation />
      <UI />
    </main>
  );
}