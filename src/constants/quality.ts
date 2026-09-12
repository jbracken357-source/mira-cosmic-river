// Quality tiers.
//
// Particle counts, sphere tessellation and post-processing decide how much work the
// GPU does per frame. WebGL in headless CI has no GPU at all: Chromium falls back to
// SwiftShader, where the full scene renders at ~2fps and Playwright's actionability
// checks (which need stable consecutive frames) time out. `?quality=low` asks for the
// light tier so behavioural tests can run anywhere.
//
// When the query is absent, pick a tier from device capability so a mid-range phone
// uses the mobile LOD and dpr 1 rather than the desktop 5000-star / bloom-4 path.
export type QualityTier = 'high' | 'mid' | 'low';

const MOBILE_WIDTH = 640;

export function detectQualityTier(env: {
  qualityQuery: string | null;
  innerWidth: number;
  innerHeight: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}): QualityTier {
  if (env.qualityQuery === 'low') return 'low';
  // deviceMemory is Chrome-only; treat "very constrained" as the light tier.
  if (env.deviceMemory !== undefined && env.deviceMemory <= 2) return 'low';

  // Short side, so a landscape phone still lands on mid even when innerWidth is large.
  const midWidth = Math.min(env.innerWidth, env.innerHeight) < MOBILE_WIDTH;
  const midMem = env.deviceMemory !== undefined && env.deviceMemory <= 4;
  const midCpu = env.hardwareConcurrency !== undefined && env.hardwareConcurrency <= 4;
  if (midWidth || midMem || midCpu) return 'mid';
  return 'high';
}

// The query string cannot change without a reload, so resolve once.
let cachedTier: QualityTier | null = null;

export function resolveQualityTier(): QualityTier {
  if (cachedTier === null) {
    if (typeof window === 'undefined') {
      cachedTier = 'high';
    } else {
      const nav = navigator as Navigator & { deviceMemory?: number };
      cachedTier = detectQualityTier({
        qualityQuery: new URLSearchParams(window.location.search).get('quality'),
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        deviceMemory: nav.deviceMemory,
        hardwareConcurrency: nav.hardwareConcurrency,
      });
    }
  }
  return cachedTier;
}
