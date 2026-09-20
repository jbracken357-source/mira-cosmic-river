// Physical constants for the binary star system
// Based on real Mira (Omicron Ceti) data, simplified for visualization

export const PHYSICS = {
  // Mira A - Red Giant (Long-period variable star)
  MIRA_A: {
    radius: 2.5,           // Visual radius (scaled for display)
    mass: 1.2,             // Solar masses
    temperature: 3000,     // Kelvin (cool red giant)
    luminosity: 9000,      // Solar luminosities (variable)
    pulsationPeriod: 331.96, // Days (mean period)
  },

  // Mira B - White Dwarf companion
  MIRA_B: {
    radius: 0.3,           // Much smaller
    mass: 0.6,             // Solar masses
    temperature: 15000,    // Kelvin (hot white dwarf)
    luminosity: 0.001,     // Very low luminosity
    accretionRate: 0.001,  // Solar masses per year
  },

  // Orbital parameters
  ORBIT: {
    semiMajorAxis: 4.5,    // Visual distance (scaled)
    eccentricity: 0.15,    // Slight ellipse
    inclination: 30,       // Degrees from viewer
    period: 0.5,           // Orbital period (visual seconds)
  },

  // The Tail - Mira's 13-light-year UV bow shock (scaled)
  TAIL: {
    particleCount: 10000,
    particleCountMobile: 3000,
    length: 25,           // Visual length (scaled)
    width: 4,             // Max spread at far end
    curvature: 1.5,       // Upward arc
  },
} as const;

// Calculate orbital position at time t
export function calculateOrbitalPosition(
  time: number,
  config: typeof PHYSICS.ORBIT
): { primary: [number, number, number]; secondary: [number, number, number] } {
  const angle = (time * config.period) % (2 * Math.PI);
  const r = config.semiMajorAxis * (1 - config.eccentricity * config.eccentricity) /
            (1 + config.eccentricity * Math.cos(angle));

  // Mira A position (centered with slight oscillation)
  const primaryOffset = 0.1;
  const primary: [number, number, number] = [
    primaryOffset * Math.cos(angle),
    0,
    primaryOffset * Math.sin(angle),
  ];

  // Mira B position (orbiting around Mira A)
  const inclinationRad = (config.inclination * Math.PI) / 180;
  const secondary: [number, number, number] = [
    r * Math.cos(angle),
    r * Math.sin(angle) * Math.sin(inclinationRad),
    r * Math.sin(angle) * Math.cos(inclinationRad),
  ];

  return { primary, secondary };
}