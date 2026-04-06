# Mira Cosmic River - Product Specification

## Overview

Mira Cosmic River is a cinematic 3D binary star system visualization that merges scientific accuracy with romantic aesthetics. The experience showcases Mira (Omicron Ceti), the prototypical long-period variable star, in its gravitational dance with its binary companion Mira B.

## Design System

### Color Palette
- **Primary Background**: Deep space black `#0a0612`
- **Star Primary (Mira A)**: Stellar orange `#ff6b35` with warm glow
- **Star Secondary (Mira B)**: Nebula violet `#a78bfa`
- **Accents**: White dwarf blue `#60a5fa`, solar white `#fef3c7`
- **UI Surfaces**: Frosted glass with `rgba(255,255,255,0.05)` base

### Typography
- **Display**: Cinzel (headings, titles) - elegant serif for cosmic grandeur
- **Body**: Inter (descriptions, labels) - clean readability
- **Data**: JetBrains Mono (parameters, numbers) - technical precision

### Visual Effects
- Bloom post-processing for stellar glow
- Atmospheric scattering shaders
- Orbit trails with particle streams
- Smooth spring-based animations (300-500ms)

## Core Features (Sprint 1 - Must Have)

### 1. 3D Binary Star Visualization
- **Mira A**: Large red giant with pulsating atmosphere, warm orange glow
- **Mira B**: Smaller white dwarf companion, blue-white glow
- **Orbital mechanics**: Accurate elliptical orbit visualization
- **Material streams**: Gas flowing from Mira A to Mira B

### 2. Three Visual Modes
- **GLOW mode**: Emphasizes stellar luminosity and bloom effects
- **WAVE mode**: Shows gravitational wave distortions in space-time
- **PARTICLES mode**: Displays particle streams representing matter transfer

### 3. Interactive Controls
- Real-time parameter adjustment:
  - Star color (hue shift for both stars)
  - Turbulence intensity
  - Orbit speed multiplier
  - Bloom intensity
  - Particle density
- Mode toggle buttons
- Language switch (EN/CH)

### 4. Cinematic Intro Animation
- 2.5 second orchestrated reveal:
  - Fade in from black
  - Stars emerge with scale animation
  - UI slides in from edges
  - Staggered text reveals

### 5. Responsive UI
- Desktop: Full control panel on right side
- Tablet: Collapsible sidebar
- Mobile: Bottom sheet with tabbed controls
- Touch-friendly interaction sizes

## Technical Requirements

### Performance Targets
- Initial load: < 3 seconds
- Frame rate: 60fps on mid-range devices
- GPU memory: < 500MB
- Bundle size: < 2MB gzipped

### Browser Support
- Chrome 90+, Firefox 88+, Safari 15+, Edge 90+
- WebGL 2.0 required
- Fallback message for unsupported browsers

### Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation support
- Reduced motion preference support
- High contrast mode support

## File Structure

```
src/
  components/
    Scene/
      Scene.tsx           # Main 3D scene container
      MiraA.tsx           # Primary star component
      MiraB.tsx           # Companion star component
      OrbitRing.tsx       # Orbital path visualization
      MaterialStream.tsx  # Gas/particle flow between stars
      Stars.tsx           # Background star field
      index.ts            # Barrel export
    UI/
      ControlPanel.tsx    # Main control interface
      ModeToggle.tsx      # Visual mode selector
      ParameterSlider.tsx # Reusable slider component
      LanguageSwitch.tsx  # EN/CH toggle
      IntroAnimation.tsx  # Cinematic intro sequence
      index.ts            # Barrel export
  hooks/
    useBinaryStar.ts      # Star system state management
    useAnimation.ts       # Animation orchestration
    useParameters.ts      # Parameter state
  shaders/
    miraA.glsl            # Red giant shader
    atmosphere.glsl       # Atmospheric scattering
    stream.glsl           # Material stream shader
    orbitRing.glsl        # Orbital trail shader
    starTail.glsl         # Particle trail shader
  constants/
    colors.ts             # Color palette
    animation.ts          # Timing constants
    physics.ts            # Physical constants
  types.ts                # TypeScript type definitions
  App.tsx                 # Root component
  main.tsx               # Entry point
  index.css               # Global styles with Tailwind
```

## Interaction Design

### Mouse/Touch Interactions
- **Drag**: Rotate camera around the binary system
- **Scroll/Pinch**: Zoom in/out
- **Double-click**: Reset camera to default position
- **Hover on star**: Highlight with info tooltip

### Keyboard Shortcuts
- `Space`: Toggle animation pause/play
- `1/2/3`: Switch visual modes
- `R`: Reset all parameters
- `L`: Toggle language

## Data Model

```typescript
interface StarSystemState {
  mode: 'glow' | 'wave' | 'particles';
  language: 'en' | 'ch';
  isPlaying: boolean;
  introComplete: boolean;
}

interface StarParameters {
  primaryColor: number;      // Hue 0-360
  secondaryColor: number;    // Hue 0-360
  turbulence: number;        // 0-1
  orbitSpeed: number;        // 0.1-3.0x
  bloomIntensity: number;    // 0-2
  particleDensity: number;   // 100-10000
}
```

## Success Criteria

1. Users can view and interact with a beautiful 3D binary star system
2. All three visual modes render correctly with distinct aesthetics
3. Parameters adjust in real-time with smooth transitions
4. Language switching works without page reload
5. Animation performs at 60fps on target devices
6. Accessibility audit passes with no critical issues