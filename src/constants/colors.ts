// Color palette constants for Mira Cosmic River
// Deep space sci-fi aesthetic with romantic poetic elements
export const COLORS = {
  // Primary background
  DEEP_SPACE: '#060308',
  VOID_BLACK: '#030105',

  // Star colors
  STELLAR_ORANGE: '#ff6b35',
  STELLAR_ORANGE_DIM: '#cc5529',
  WARM_GLOW: '#ffaa55',
  NEBULA_VIOLET: '#a78bfa',
  NEBULA_VIOLET_DIM: '#8b6fe8',
  WHITE_DWARF_BLUE: '#60a5fa',
  SOLAR_WHITE: '#fef3c7',

  // Mira A, per the archived product direction: core #ff3d00, surface #ff8a50. The pulsation
  // may brighten or deepen these, but it never leaves the deep red-orange family.
  MIRA_A_CORE: '#ff3d00',
  MIRA_A_SURFACE: '#ff8a50',
  // The two atmosphere shells: a dense layer off the photosphere and a wide thin haze.
  MIRA_A_ATMOSPHERE_DENSE: '#ff5a1e',
  MIRA_A_ATMOSPHERE_HAZE: '#c22a05',

  // Mira B: a hot white dwarf, and the disk of its own accreted material.
  MIRA_B_CORE: '#e0e7ff',
  MIRA_B_CORONA: '#dbe6ff',
  ACCRETION_DISK: '#cfe0ff',
  ACCRETION_DISK_HOT: '#fff0dc',

  // UI colors
  GLASS_BASE: 'rgba(255, 255, 255, 0.05)',
  GLASS_BORDER: 'rgba(255, 255, 255, 0.1)',
  GLASS_HIGHLIGHT: 'rgba(255, 255, 255, 0.15)',
} as const;

// The background sky's spectral classes: colour and how common the class is among the stars
// bright enough to see. Naked-eye skies skew hot — M and K dwarfs vastly outnumber everything
// else, but the ones you can actually pick out are mostly the bright blue-white ones — so the
// weights below sit between the two and the frame gets a real cool half to balance the warm.
// Weights sum to 1.
export const SKY_SPECTRAL: Array<{ rgb: [number, number, number]; weight: number }> = [
  { rgb: [0.62, 0.74, 1.0], weight: 0.13 }, // B - blue-white
  { rgb: [0.76, 0.84, 1.0], weight: 0.21 }, // A - white-blue
  { rgb: [0.94, 0.95, 1.0], weight: 0.15 }, // F - white
  { rgb: [1.0, 0.97, 0.87], weight: 0.17 }, // G - yellow
  { rgb: [1.0, 0.85, 0.62], weight: 0.19 }, // K - orange
  { rgb: [1.0, 0.68, 0.47], weight: 0.15 }, // M - red-orange
];
