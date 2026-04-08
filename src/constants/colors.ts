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
  DEEP_SPACE: '#0a0612',
  VOID_BLACK: '#050208',

  // Star colors
  STELLAR_ORANGE: '#ff6b35',
  STELLAR_ORANGE_DIM: '#cc5529',
  WARM_GLOW: '#ffaa55',
  NEBULA_VIOLET: '#a78bfa',
  NEBULA_VIOLET_DIM: '#8b6fe8',
  WHITE_DWARF_BLUE: '#60a5fa',
  SOLAR_WHITE: '#fef3c7',

  // UI colors
  GLASS_BASE: 'rgba(255, 255, 255, 0.05)',
  GLASS_BORDER: 'rgba(255, 255, 255, 0.1)',
  GLASS_HIGHLIGHT: 'rgba(255, 255, 255, 0.15)',

  // Three.js compatible colors (0x format)
  THREE: {
    DEEP_SPACE: 0x0a0612,
    STELLAR_ORANGE: 0xff6b35,
    WARM_GLOW: 0xffaa55,
    NEBULA_VIOLET: 0xa78bfa,
    WHITE_DWARF_BLUE: 0x60a5fa,
    SOLAR_WHITE: 0xfef3c7,
  },
} as const;

// Emotion labels for each color (for documentation and UI reference)
export const COLOR_INFO: Record<keyof typeof COLORS, ColorWithEmotion | null> = {
  DEEP_SPACE: {
    hex: '#0a0612',
    emotion: 'Eternal Silence / 永恒的寂静',
  },
  VOID_BLACK: {
    hex: '#050208',
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
