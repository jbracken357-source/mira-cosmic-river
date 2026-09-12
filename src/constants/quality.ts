// Quality tiers.
//
// Particle counts, sphere tessellation and post-processing decide how much work the
// GPU does per frame. WebGL in headless CI has no GPU at all: Chromium falls back to
// SwiftShader, where the full scene renders at ~2fps and Playwright's actionability
// checks (which need stable consecutive frames) time out. `?quality=low` asks for the
// light tier so behavioural tests can run anywhere; the default path is unchanged.
export type QualityTier = 'high' | 'low';

// The query string cannot change without a reload, so resolve once.
let cachedTier: QualityTier | null = null;

export function resolveQualityTier(): QualityTier {
  if (cachedTier === null) {
    cachedTier =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('quality') === 'low'
        ? 'low'
        : 'high';
  }
  return cachedTier;
}
