import { useState, useEffect } from 'react';
import { isTallFrame } from '../lib/portraitFraming';

const MOBILE_BREAKPOINT = 640;

const isPhoneWidth = () => window.innerWidth < MOBILE_BREAKPOINT;
const readTallFrame = () => isTallFrame(window.innerWidth, window.innerHeight);

// Re-reads one window measurement whenever the window is resized.
function useWindowFlag(read: () => boolean): boolean {
  const [flag, setFlag] = useState<boolean>(() => {
    // SSR-safe: default to false on server
    if (typeof window === 'undefined') return false;
    return read();
  });

  useEffect(() => {
    const check = () => {
      setFlag(read());
    };

    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [read]);

  return flag;
}

/**
 * Detects if the current device is mobile based on screen width.
 * Returns true if window.innerWidth < 640px.
 */
export function useMobile(): boolean {
  return useWindowFlag(isPhoneWidth);
}

/**
 * Detects the tall frame through the scene's own rule (isTallFrame), not the
 * phone-width rule above: a 568×320 landscape phone is narrow but not tall.
 */
export function usePortrait(): boolean {
  return useWindowFlag(readTallFrame);
}
