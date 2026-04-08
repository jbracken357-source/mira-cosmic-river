// Visual modes for the binary star system
export type VisualMode = 'glow' | 'wave' | 'particles';

// Language options
export type Language = 'en' | 'ch';

// Main state interface for the star system
export interface StarSystemState {
  mode: VisualMode;
  language: Language;
  isPlaying: boolean;
  introComplete: boolean;
}

// Adjustable parameters for the visualization
export interface StarParameters {
  primaryColor: number;      // Hue 0-360
  secondaryColor: number;    // Hue 0-360
  turbulence: number;        // 0-1
  orbitSpeed: number;        // 0.1-3.0x
  bloomIntensity: number;    // 0-2
  particleDensity: number;   // 100-10000
}

// Star properties for rendering
export interface StarProperties {
  position: [number, number, number];
  radius: number;
  color: string;
  emissiveIntensity: number;
  pulsateSpeed: number;
}

// Orbit configuration
export interface OrbitConfig {
  semiMajorAxis: number;
  semiMinorAxis: number;
  eccentricity: number;
  period: number;
}

// Parameter slider props
export interface ParameterSliderProps {
  label: string;
  labelZh: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  language: Language;
  formatValue?: (value: number) => string;
}

// Translation dictionary
export interface TranslationDict {
  title: string;
  subtitle: string;
  controls: string;
  modeGlow: string;
  modeWave: string;
  modeParticles: string;
  primaryColor: string;
  secondaryColor: string;
  turbulence: string;
  orbitSpeed: string;
  bloomIntensity: string;
  particleDensity: string;
  play: string;
  pause: string;
  reset: string;
  languageSwitch: string;
}

// Shader uniforms
export interface ShaderUniforms {
  time: number;
  color: string;
  intensity: number;
  turbulence: number;
  [key: string]: string | number;
}