# Mira Cosmic River - Visual Design System

**Version:** 1.0  
**Source:** Extended from mira-binary-waltz UX.md

---

## 1. Design Language

### 1.1 Core Concept: "Stardust & Breath" (星尘与呼吸)

| Element | Chinese | Meaning | Implementation |
|---------|---------|---------|----------------|
| **Stardust** | 星尘 | We are made of star stuff | Particle systems, star fields, cosmic dust |
| **Breath** | 呼吸 | The living rhythm of the star | UI elements sync with Mira A pulsation |
| **Depth** | 深邃 | The vastness of space-time | Layered fog, parallax, atmospheric perspective |
| **Finesse** | 精致 | Elegance through restraint | Thin lines, whitespace, asymmetric balance |

### 1.2 Layout Principles

```
┌─────────────────────────────────────────────────────────┐
│  [LANG]                                    [Minimal nav]│
│                                                         │
│                                                         │
│                                                         │
│              🌟  3D BINARY STAR SCENE  🌟              │
│                                                         │
│                                                         │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Title: Mira - The Binary Waltz                 │   │
│  │  Subtitle: Together, Until the End of Time      │   │
│  │  (Frosted glass, bottom-center)                 │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Key Principles:**
- **Focal point**: The binary system (center stage)
- **UI as frame**: Controls recede, content dominates
- **Whitespace**: Generous margins, let the scene breathe
- **Asymmetric balance**: Heavy visual weight at bottom, light at top

---

## 2. Color System

### 2.1 Primary Palette

```typescript
export const COLORS = {
  // Background
  DEEP_SPACE: {
    hex: '#0a0612',
    emotion: '永恒的寂静 / Eternal Silence',
    usage: 'Main background, control panel base'
  },
  
  // Mira A (Red Giant)
  STELLAR_ORANGE: {
    hex: '#ff6b35',
    emotion: '炽热的生命 / Burning Life',
    usage: 'Mira A core, primary accent'
  },
  WARM_GLOW: {
    hex: '#ffaa55',
    emotion: '温柔的守护 / Gentle Protection',
    usage: 'Mira A atmosphere, slider fills'
  },
  
  // Mira B (White Dwarf)
  NEBULA_VIOLET: {
    hex: '#a78bfa',
    emotion: '神秘的引力 / Mysterious Gravity',
    usage: 'Mira B, accretion effects'
  },
  WHITE_DWARF: {
    hex: '#fef3c7',
    emotion: '纯净的爱 / Pure Love',
    usage: 'Mira B core, label highlights'
  },
  
  // UI Elements
  UI_GLASS: {
    hex: 'rgba(255, 255, 255, 0.05)',
    emotion: '透明的亲密 / Transparent Intimacy',
    usage: 'Control panel background'
  },
  UI_BORDER: {
    hex: 'rgba(255, 255, 255, 0.1)',
    emotion: '微妙的边界 / Subtle Boundary',
    usage: 'Control panel borders'
  },
  TEXT_PRIMARY: {
    hex: 'rgba(255, 255, 255, 0.95)',
    emotion: '清晰的告白 / Clear Confession',
    usage: 'Title, primary text'
  },
  TEXT_SECONDARY: {
    hex: 'rgba(255, 255, 255, 0.6)',
    emotion: '柔和的低语 / Soft Whisper',
    usage: 'Labels, secondary text'
  },
  TEXT_MUTED: {
    hex: 'rgba(255, 255, 255, 0.3)',
    emotion: '遥远的记忆 / Distant Memory',
    usage: 'Disabled states, hints'
  }
};
```

### 2.2 Gradient Palettes

```typescript
export const GRADIENTS = {
  // Mass transfer stream (Mira A → Mira B)
  MASS_TRANSFER: 'linear-gradient(90deg, #ff8c00 0%, #a78bfa 100%)',
  
  // Particle tail (shock wave)
  PARTICLE_TAIL: 'linear-gradient(180deg, #7B2CBF 0%, #00D4FF 100%)',
  
  // Slider track
  SLIDER_TRACK: 'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.2) 100%)',
  
  // Slider fill (active)
  SLIDER_FILL: 'linear-gradient(90deg, #ff6b35 0%, #ffaa55 100%)'
};
```

### 2.3 Semantic Colors

```typescript
export const SEMANTIC = {
  // Mode buttons
  MODE_ACTIVE: {
    bg: 'bg-orange-500',
    text: 'text-black',
    shadow: 'shadow-lg shadow-orange-500/30'
  },
  MODE_INACTIVE: {
    bg: 'bg-white/5',
    text: 'text-white/40',
    hover: 'hover:bg-white/10 hover:text-white/70'
  },
  
  // Interactive states
  HOVER: {
    scale: 'hover:scale-105',
    border: 'hover:border-orange-400/30',
    bg: 'hover:bg-[#0a0612]/80'
  },
  ACTIVE: {
    border: 'border-orange-400',
    glow: 'shadow-[0_-2px_10px_rgba(255,100,50,0.5)]'
  }
};
```

---

## 3. Typography System

### 3.1 Font Stack

```css
/* Import in index.css or App.tsx */
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

--font-display: 'Cinzel', serif;      /* Titles, emotional impact */
--font-body: 'Inter', sans-serif;     /* Body text, UI labels */
--font-mono: 'JetBrains Mono', mono;  /* Numeric values, data */
```

### 3.2 Type Scale

| Element | Font | Size (Desktop) | Size (Mobile) | Weight | Tracking | Line Height |
|---------|------|----------------|---------------|--------|----------|-------------|
| H1 Title | Cinzel | 48px | 32px | 400 | 0.05em | 1.2 |
| H2 Subtitle | Cinzel | 18px | 16px | 400 | 0.2em | 1.4 |
| Body | Inter | 14px | 13px | 400 | 0 | 1.5 |
| Label (uppercase) | Inter | 10px | 9px | 500 | 0.15em | 1.3 |
| Data/Metric | JetBrains Mono | 12px | 11px | 400 | 0 | 1.4 |

### 3.3 Usage Examples

```tsx
// Title
<h1 className="font-display text-4xl md:text-3xl text-white/95 tracking-wide">
  Mira - The Binary Waltz
</h1>

// Subtitle
<p className="font-display text-lg text-white/60 tracking-[0.2em]">
  Together, Until the End of Time
</p>

// Control Panel Label
<span className="font-sans text-[10px] uppercase tracking-widest text-white/60">
  Turbulence
</span>

// Numeric Value
<span className="font-mono text-[10px] text-orange-400/80">
  {value.toFixed(2)}
</span>
```

---

## 4. UI Components

### 4.1 Control Panel

**Structure:**
```tsx
<div className="w-80 backdrop-blur-3xl bg-[#0a0612]/60 border border-white/10 
                rounded-3xl overflow-hidden shadow-2xl flex flex-col">
  {/* Tab Navigation */}
  <div className="flex border-b border-white/5">
    <button>SYSTEM</button>
    <button>ENVIRONMENT</button>
  </div>
  
  {/* Content Area */}
  <div className="p-6 min-h-[400px]">
    {/* Sliders, toggles, etc. */}
  </div>
  
  {/* Footer Actions */}
  <div className="px-6 pb-6">
    <button>Reset</button>
  </div>
</div>
```

**Animation:**
- Tab transitions: `duration-200` with spring easing
- Hover scale: `hover:scale-105`
- Active indicator: Animated underline with `layoutId`

### 4.2 Slider Component

**Anatomy:**
```
┌──────────────────────────────────────────┐
│  Label              Value                │
│  ─────────────────────────────────────   │
│  ════════●══════════════════▶            │
│     Track   Thumb                        │
└──────────────────────────────────────────┘
```

**Spec:**
- Track height: 4px (1px base + 3px fill)
- Track color: `rgba(255,255,255,0.1)`
- Fill: Orange gradient `#ff6b35 → #ffaa55`
- Thumb: 12px white circle, shadow-lg
- Thumb hover: scale-125
- Input: Invisible full-width overlay for accessibility

### 4.3 Mode Toggle

**Three-button segmented control:**

```tsx
<div className="flex gap-2">
  {modes.map(({ mode, label }) => (
    <button
      className={`flex-1 py-3 rounded-xl text-[10px] tracking-widest 
                  font-medium transition-all ${
        isActive 
          ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/30 scale-105'
          : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
      }`}
    >
      {label}
    </button>
  ))}
</div>
```

### 4.4 Holographic Labels (Star Info)

**Glassmorphism card:**

```tsx
<div className="bg-[#0a0612]/60 backdrop-blur-md border border-white/10 
                p-4 rounded-xl shadow-[0_4px_30px_rgba(0,0,0,0.3)]
                transform-gpu transition-all duration-500 
                hover:scale-105 hover:border-orange-400/30">
  {/* Star info content */}
</div>
```

**Content layout:**
```
┌──────────────────────────────┐
│  3,000 K          SURFACE    │
│  ▓▓▓▓▓▓▓▓░░░░░░░░░  80%     │
│  ──────────────────────────  │
│  Mira A    │    Red Giant    │
└──────────────────────────────┘
```

---

## 5. Animation & Motion

### 5.1 Timing Functions

```typescript
export const MOTION = {
  // Spring-based (preferred)
  SPRING: {
    type: 'spring',
    stiffness: 400,
    damping: 25,
    mass: 1
  },
  
  // Fade transitions
  FADE: {
    duration: 0.2,
    ease: [0.4, 0, 0.2, 1] // easeInOut
  },
  
  // Slide transitions
  SLIDE: {
    duration: 0.3,
    ease: [0.25, 0.1, 0.25, 1] // easeOut
  },
  
  // Pulsing (for stars)
  PULSE: {
    repeat: Infinity,
    repeatType: 'reverse',
    duration: 4, // Slow, like breathing
    ease: 'easeInOut'
  }
};
```

### 5.2 Key Animations

**Intro Sequence (2.5s orchestrated):**
1. Background stars fade in (0-0.5s)
2. Mira A emerges with scale (0.5-1.5s)
3. Mira B emerges (1.0-2.0s)
4. UI slides in from edges (1.5-2.5s)
5. Text reveals with stagger (2.0-2.5s)

**Slider Interaction:**
- Thumb hover: scale-125 (100ms)
- Value change: Fill width updates instantly
- Track click: Thumb slides to position (spring)

**Mode Toggle:**
- Active indicator slides (`layoutId` transition)
- Button press: scale-95 then spring back

---

## 6. Accessibility

### 6.1 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 6.2 High Contrast Mode

```css
@media (prefers-contrast: high) {
  .control-panel {
    background: #000;
    border-color: #fff;
  }
  .text-secondary {
    color: rgba(255, 255, 255, 0.9);
  }
}
```

### 6.3 ARIA Labels

```tsx
<button 
  aria-label="Switch to GLOW visual mode"
  aria-pressed={mode === 'glow'}
>
  GLOW
</button>

<input
  type="range"
  aria-label="Adjust stellar turbulence"
  aria-valuemin={0}
  aria-valuemax={1}
  aria-valuenow={turbulence}
/>
```

---

## 7. Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Mobile | < 640px | Control panel becomes bottom sheet, full width |
| Tablet | 640px - 1024px | Control panel collapsible sidebar |
| Desktop | > 1024px | Full control panel, right side |

**Mobile-specific:**
```tsx
<div className="fixed bottom-0 left-0 right-0 
                md:relative md:w-80 
                rounded-t-3xl md:rounded-3xl">
  {/* Collapsed: just mode buttons */}
  {/* Expanded: full control panel */}
</div>
```

---

## 8. Design Tokens (CSS Custom Properties)

```css
:root {
  /* Colors */
  --color-deep-space: #0a0612;
  --color-stellar-orange: #ff6b35;
  --color-warm-glow: #ffaa55;
  --color-nebula-violet: #a78bfa;
  --color-white-dwarf: #fef3c7;
  
  /* UI */
  --ui-glass: rgba(255, 255, 255, 0.05);
  --ui-border: rgba(255, 255, 255, 0.1);
  --ui-text-primary: rgba(255, 255, 255, 0.95);
  --ui-text-secondary: rgba(255, 255, 255, 0.6);
  
  /* Typography */
  --font-display: 'Cinzel', serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  
  /* Motion */
  --motion-spring: cubic-bezier(0.4, 0, 0.2, 1);
  --motion-ease-out: cubic-bezier(0.25, 0.1, 0.25, 1);
  
  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  
  /* Border radius */
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-3xl: 24px;
}
```

---

## 9. Inspiration References

| Source | What to Emulate |
|--------|-----------------|
| NASA GALEX Mira | UV bow shock shape, particle tail flow |
| Interstellar (film) | Black hole Gargantua glow, scale |
| Outer Wilds (game) | Romantic cosmic discovery, gentle UI |
| Stellaris (game) | Star surface detail, atmospheric effects |

---

## 10. Don'ts (Anti-Patterns)

❌ **Never use:**
- Pure black (`#000000`) for backgrounds — use `#0a0612`
- Generic purple-pink gradients everywhere — reserve for particle tail
- Inter font for everything — use Cinzel for titles
- Sharp corners — everything should be rounded (xl to 3xl)
- Solid backgrounds — UI should be frosted glass
- Instant transitions — use spring physics
- More than 4 typefaces per screen
