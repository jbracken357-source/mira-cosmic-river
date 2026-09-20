// Per-tier cost table (#26, issue #50): every GPU-side count the scene spends
// lives here, so the descent contract has one owner.
//
// high → mid touches ONLY the costly post-processing (bloom levels) and
// resolution (dpr). The star field, the tail, the stream, the sphere tessellation
// and the river veil keep their full counts. mid → low is where decoration is
// cut, after post-processing is already off (the composer returns null for low).
//
// The governor (lib/qualityGovernor) only ever steps one rung on this ladder;
// it does not encode the costs. Canvas dpr follows the live governed tier
// (r3f can change the pixel ratio without recreating the context). Antialias
// is a context-creation flag and stays on the opening tier — it is not in
// this table.
import type { QualityTier } from '../constants/quality';

export interface QualityBudget {
  starCount: number;
  sphereSegments: number;
  bloomLevels: number;
  tailParticles: number;
  streamParticles: number;
  veilVolumes: number;
  veilAccents: number;
  dpr: number | [number, number];
}

const BUDGET: Record<QualityTier, QualityBudget> = {
  high: {
    starCount: 5000,
    sphereSegments: 64,
    bloomLevels: 4,
    tailParticles: 10000,
    streamParticles: 600,
    veilVolumes: 7,
    veilAccents: 2,
    dpr: [1, 1.5],
  },
  mid: {
    starCount: 5000,
    sphereSegments: 64,
    bloomLevels: 2,
    tailParticles: 10000,
    streamParticles: 600,
    veilVolumes: 7,
    veilAccents: 2,
    dpr: 1,
  },
  // Software-rendered environments (headless CI, very weak devices)
  low: {
    starCount: 300,
    sphereSegments: 16,
    bloomLevels: 1,
    tailParticles: 300,
    streamParticles: 150,
    veilVolumes: 2,
    veilAccents: 0,
    dpr: 1,
  },
};

export function qualityBudget(tier: QualityTier): QualityBudget {
  return BUDGET[tier];
}
