import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 640;

/**
 * Detects if the current device is mobile based on screen width.
 * Returns true if window.innerWidth < 640px.
 */
export function useMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    // SSR-safe: default to false on server
    if (typeof window === 'undefined') return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}
