// Color palette constants for Mira Cosmic River
// Deep space sci-fi aesthetic with romantic poetic elements

export const COLORS = {
  // Primary background
  DEEP_SPACE: '#0a0612',
  VOID_BLACK: '#050208',

  // Star colors
  STELLAR_ORANGE: '#ff6b35',
  STELLAR_ORANGE_DIM: '#cc5529',
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
    NEBULA_VIOLET: 0xa78bfa,
    WHITE_DWARF_BLUE: 0x60a5fa,
    SOLAR_WHITE: 0xfef3c7,
  },
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