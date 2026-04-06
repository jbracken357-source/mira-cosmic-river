import { useState, useEffect, useRef } from 'react';
import { useBinaryStar } from './useBinaryStar';
import { ANIMATION } from '../constants';

export function useAnimation() {
  const introComplete = useBinaryStar((state) => state.introComplete);
  const setIntroComplete = useBinaryStar((state) => state.setIntroComplete);
  const animationRef = useRef<number | null>(null);

  // Handle intro animation completion
  useEffect(() => {
    if (!introComplete) {
      animationRef.current = window.setTimeout(() => {
        setIntroComplete(true);
      }, ANIMATION.INTRO_STAGGER.COMPLETE);
    }

    return () => {
      if (animationRef.current !== null) {
        window.clearTimeout(animationRef.current);
      }
    };
  }, [introComplete, setIntroComplete]);

  return {
    introComplete,
    introProgress: introComplete ? 1 : 0,
  };
}

// Animation helper for calculating intro delays
export function getIntroDelay(
  phase: keyof typeof ANIMATION.INTRO_STAGGER
): number {
  return ANIMATION.INTRO_STAGGER[phase] / 1000; // Convert to seconds for Framer Motion
}

// Animation helper for determining if an element should be visible
export function useIntroVisibility(
  phase: keyof typeof ANIMATION.INTRO_STAGGER
): boolean {
  const introComplete = useBinaryStar((state) => state.introComplete);
  const startTime = ANIMATION.INTRO_STAGGER[phase];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // If intro is already complete, visibility is determined immediately
    if (introComplete) {
      // Use a micro-delay to avoid cascading renders
      const microDelay = window.requestAnimationFrame(() => {
        setVisible(true);
      });
      return () => window.cancelAnimationFrame(microDelay);
    }

    const timer = window.setTimeout(() => {
      setVisible(true);
    }, startTime);

    return () => window.clearTimeout(timer);
  }, [introComplete, startTime]);

  return visible;
}