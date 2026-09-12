import type { RefObject } from 'react';
import * as THREE from 'three';
import { Atmosphere_Shader, makeAtmosphereUniforms } from '../../shaders/miraA';

interface GlowShellProps {
  /** Radius of the shell, in world units. */
  shellRadius: number;
  /**
   * Radius of the star the shell wraps, if there is one. Omit for a shell with nothing inside
   * it — a haze in open space — where the glow then peaks at the centre of the shell instead
   * of building towards a silhouette.
   */
  coreRadius?: number;
  /** Colour of the glow. The star's own light scattered in its outer layers, or the haze's. */
  color: string;
  opacity: number;
  /** Exponential rate at which the glow dies away between the limb and the shell edge. */
  falloff: number;
  /** Radius pulse of the star inside, if it has one (fraction of its radius). */
  pulseAmp?: number;
  /** Parent-owned material ref, for the per-frame uniforms (time, and the real clock). */
  materialRef?: RefObject<THREE.ShaderMaterial | null>;
}

// Back-facing unit sphere, additively blended over whatever is behind it.
export default function GlowShell({
  shellRadius,
  coreRadius,
  color,
  opacity,
  falloff,
  pulseAmp,
  materialRef,
}: GlowShellProps) {
  return (
    <mesh scale={shellRadius}>
      <sphereGeometry args={[1, 32, 24]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={Atmosphere_Shader.vertexShader}
        fragmentShader={Atmosphere_Shader.fragmentShader}
        uniforms={makeAtmosphereUniforms({
          color,
          shellRadius,
          coreRadius,
          opacity,
          falloff,
          pulseAmp,
        })}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        transparent={true}
        depthWrite={false}
      />
    </mesh>
  );
}
