// Color palette constants for Mira Cosmic River
// Deep space sci-fi aesthetic with romantic poetic elements
// Each color includes emotion labels from binary-waltz UX.md

// Color with emotion metadata
export interface ColorWithEmotion {
  hex: string;
  emotion: string; // Format: "English / 中文"
}

// Helper to extract hex from ColorWithEmotion
export function getHex(color: ColorWithEmotion | string): string {
  return typeof color === 'string' ? color : color.hex;
}

// Color palette - string values for backward compatibility
// Emotion labels available via COLOR_INFO
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

  // Three.js compatible colors (0x format)
  THREE: {
    DEEP_SPACE: 0x060308,
    STELLAR_ORANGE: 0xff6b35,
    WARM_GLOW: 0xffaa55,
    NEBULA_VIOLET: 0xa78bfa,
    WHITE_DWARF_BLUE: 0x60a5fa,
    SOLAR_WHITE: 0xfef3c7,
  },
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


// Emotion labels for each color (for documentation and UI reference)
export const COLOR_INFO: Record<keyof typeof COLORS, ColorWithEmotion | null> = {
  DEEP_SPACE: {
    hex: '#060308',
    emotion: 'Eternal Silence / 永恒的寂静',
  },
  VOID_BLACK: {
    hex: '#030105',
    emotion: 'Infinite Void / 无限虚空',
  },
  STELLAR_ORANGE: {
    hex: '#ff6b35',
    emotion: 'Burning Life / 炽热的生命',
  },
  STELLAR_ORANGE_DIM: {
    hex: '#cc5529',
    emotion: 'Smoldering Ember / 余烬微光',
  },
  WARM_GLOW: {
    hex: '#ffaa55',
    emotion: 'Gentle Protection / 温柔的守护',
  },
  NEBULA_VIOLET: {
    hex: '#a78bfa',
    emotion: 'Mysterious Gravity / 神秘的引力',
  },
  NEBULA_VIOLET_DIM: {
    hex: '#8b6fe8',
    emotion: 'Distant Mystery / 遥远的神秘',
  },
  WHITE_DWARF_BLUE: {
    hex: '#60a5fa',
    emotion: 'Devoted Light / 忠诚的光芒',
  },
  SOLAR_WHITE: {
    hex: '#fef3c7',
    emotion: 'Pure Love / 纯净的爱',
  },
  // Added with the star and background texture pass (#4): the palette entries below carry no
  // emotion label of their own — they are shades of the same few feelings above.
  MIRA_A_CORE: null,
  MIRA_A_SURFACE: null,
  MIRA_A_ATMOSPHERE_DENSE: null,
  MIRA_A_ATMOSPHERE_HAZE: null,
  MIRA_B_CORE: null,
  MIRA_B_CORONA: null,
  ACCRETION_DISK: null,
  ACCRETION_DISK_HOT: null,
  GLASS_BASE: null,
  GLASS_BORDER: null,
  GLASS_HIGHLIGHT: null,
  THREE: null,
} as const;

// Convert hex to Three.js color number
export function hexToThreeColor(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

// Generate color variants for gradients
export function getColorVariants(baseHex: string): {
  primary: string;
  dim: string;
  bright: string;
} {
  // Simple brightness adjustments
  const r = parseInt(baseHex.slice(1, 3), 16);
  const g = parseInt(baseHex.slice(3, 5), 16);
  const b = parseInt(baseHex.slice(5, 7), 16);

  const dim = `#${Math.round(r * 0.8).toString(16).padStart(2, '0')}${Math.round(g * 0.8).toString(16).padStart(2, '0')}${Math.round(b * 0.8).toString(16).padStart(2, '0')}`;
  const bright = `#${Math.min(255, Math.round(r * 1.2)).toString(16).padStart(2, '0')}${Math.min(255, Math.round(g * 1.2)).toString(16).padStart(2, '0')}${Math.min(255, Math.round(b * 1.2)).toString(16).padStart(2, '0')}`;

  return { primary: baseHex, dim, bright };
}
