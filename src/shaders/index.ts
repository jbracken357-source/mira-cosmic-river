// Shader exports for Mira Cosmic River
// Central export point for all custom shaders

export {
  NOISE_GLSL,
  MiraA_Shader,
  Atmosphere_Shader,
} from './miraA';

export {
  TailVertexShader,
  TailFragmentShader,
  createTailMaterial,
} from './tail';

export {
  AccretionDisk_Shader,
} from './accretionDisk';
