// Animation hooks - simplified for cinematic experience
// Main cinematic timing is handled in Scene.tsx useFrame loop

import { useBinaryStar } from './useBinaryStar';

export function useAnimation() {
  const introComplete = useBinaryStar((state) => state.introComplete);
  return {
    introComplete,
    introProgress: introComplete ? 1 : 0,
  };
}
