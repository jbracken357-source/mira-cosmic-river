import { useEffect } from 'react';
import { useBinaryStar } from './useBinaryStar';

// The shared intentional-input clock. Only deliberate manipulation restamps it:
// starting a drag (pointerdown), wheel, touch, and keys. Mousemove never counts —
// drifting the cursor across the window is not an instruction to the camera — and
// the auto camera restamps nothing either (Scene reads the clock, it never writes).
// Every restamp also dismisses the epilogue in the same event, so the first input
// interrupts immediately instead of waiting for a poll tick.
//
// Returning from the background restarts the idle run from zero rather than cashing
// in the time the tab spent hidden (no catch-up epilogue, no camera lurch).
export function useIntentionalInput() {
  useEffect(() => {
    const note = () => useBinaryStar.getState().noteIntentionalInput();
    const onVisibility = () => {
      if (!document.hidden) note();
    };

    window.addEventListener('pointerdown', note);
    window.addEventListener('wheel', note, { passive: true });
    window.addEventListener('touchstart', note, { passive: true });
    window.addEventListener('keydown', note);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('pointerdown', note);
      window.removeEventListener('wheel', note);
      window.removeEventListener('touchstart', note);
      window.removeEventListener('keydown', note);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}
