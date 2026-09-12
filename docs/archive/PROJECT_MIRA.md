# Mira Cosmic River - Project Specification

**Version:** 2.0  
**Last Updated:** 2026-04-07  
**Status:** Active Development

---

## Executive Summary

Mira Cosmic River is a romantic 3D binary star visualization that merges scientific accuracy with emotional storytelling. Built from the foundation of `mira-demo2`, it enriches the experience with the romantic soul of `mira-binary-waltz` while maintaining 60fps performance across devices.

**Primary Audience:** You and your wife (romantic gesture)  
**Secondary Audience:** Family and friends who may view it  
**Use Case:** Both personal romantic gift AND portfolio showcase

---

## 1. Project Vision

### 1.1 Core Concept

> "In the universe's end, we remain together."

Mira (Omicron Ceti) is a real binary star system 300 light-years from Earth — a red giant pulsating over 332 days, accompanied by a smaller white dwarf companion. They have orbited each other for billions of years and will continue until the end of time.

**Emotional Metaphor:**
- **Mira A (Red Giant)** = One partner — warm, luminous, alive
- **Mira B (White Dwarf)** = The other partner — smaller, devoted, forever following

### 1.2 Design Language: "Stardust & Breath"

| Element | Meaning | Implementation |
|---------|---------|----------------|
| **Stardust** | We are made of star stuff — the cosmic connection | Particle systems, star fields, nebula dust |
| **Breath** | The living rhythm of the star — pulsation as life | UI elements that breathe with Mira A's cycle |
| **Depth** | The vastness of space and time | Layered fog, parallax backgrounds |
| **Finesse** | Elegance through restraint | Thin lines, generous whitespace, asymmetric balance |

### 1.3 Emotional Color Map

| Color | Hex | Emotion | Usage |
|-------|-----|---------|-------|
| Deep Space | `#0a0612` | 永恒的寂静 (Eternal Silence) | Background |
| Stellar Orange | `#ff6b35` | 炽热的生命 (Burning Life) | Mira A core |
| Warm Glow | `#ffaa55` | 温柔的守护 (Gentle Protection) | Mira A atmosphere |
| Nebula Violet | `#a78bfa` | 神秘的引力 (Mysterious Gravity) | Mira B, accretion |
| Starlight White | `#fef3c7` | 纯净的爱 (Pure Love) | Labels, highlights |

---

## 2. Feature Prioritization

### P0 - Must Have (Core Romantic Experience)

| Feature | Description | Source |
|---------|-------------|--------|
| Binary star 3D scene | Mira A + Mira B with orbital motion | All |
| **GLOW visual mode** | Bloom-heavy, ethereal, romantic | demo2 |
| Bloom post-processing | Essential for ethereal feel | All |
| **Romantic copy** | "红巨星如你... 伴星如我..." / "The red giant, like you..." | binary-waltz |
| Language toggle (EN/CN) | Full UI translation | binary-waltz |
| OrbitControls | Drag to rotate, scroll to zoom | All |
| Orbit ring visualization | Shows orbital path | demo2 |
| Color customization | Both stars adjustable | demo2 |

### P1 - Should Have (Visual Enhancement)

| Feature | Description | Source |
|---------|-------------|--------|
| WAVE mode | Mass transfer stream visualization | demo2 |
| PARTICLES mode | Particle tail/shockwave effect | demo2 |
| Turbulence slider | Affects star surface intensity | demo2 |
| Orbit speed slider | Control animation pace | demo2 |
| Background stars + sparkles | Depth and context | All |
| Frosted glass UI | `backdrop-blur-3xl bg-[#0a0612]/60` | All |
| Holographic star labels | Glassmorphism labels on hover | demo2 |
| Camera choreography | 2.5s slow reveal on load | cosmic-river spec |

### P2 - Cut/Defer (Not Essential)

| Feature | Reason to Cut |
|---------|---------------|
| GAN harness | Scope creep — this is a visualization, not ML research |
| Zustand state management | Overkill for 6 state values — useState suffices |
| IntroAnimation component | Delays first paint, feels like a loading screen |
| 3-tab ControlPanel | VIEW tab is sparse — merge into 2 tabs |
| Chromatic aberration slider | Niche effect, not visually noticeable |
| Complex physics calculations | Circular orbit is visually sufficient |
| Eval rubric / scoring | Process over product |

---

## 3. Visual Design System

### 3.1 Typography

| Element | Font | Size | Weight | Notes |
|---------|------|------|--------|-------|
| Title | Cinzel | 48px (desktop) / 32px (mobile) | 400 | Import from Google Fonts |
| Subtitle | Cinzel | 18px | 400 | Tracking: 0.2em |
| Body | Inter | 14px | 400 | UI descriptions |
| Labels | Inter | 10px | 500 | Tracking: 0.15em, uppercase |
| Data | JetBrains Mono | 12px | 400 | Numeric values |

### 3.2 UI Components

#### Control Panel Structure (Simplified to 2 Tabs)

```
┌─────────────────────────────────────┐
│  SYSTEM        │  ENVIRONMENT       │
├─────────────────────────────────────┤
│                                     │
│  MIRA A (Red Giant)                 │
│  ├─ Primary Color [slider]          │
│  └─ Turbulence  [slider]            │
│                                     │
│  MIRA B (White Dwarf)               │
│  ├─ Secondary Color [slider]        │
│  └─ Orbit Speed   [slider]          │
│                                     │
│  ENVIRONMENT                        │
│  ├─ Particle Density [slider]       │
│  └─ Bloom Intensity  [slider]       │
│                                     │
│  DISPLAY MODE                       │
│  [GLOW] [WAVE] [PARTICLES]          │
│                                     │
└─────────────────────────────────────┘
```

#### Slider Component Spec

```
Label (10px, uppercase, white/60)          Value (10px, mono, orange/80)
│                                          │
▼──────────────────────●─────────▶         │
       Track (white/10)   Fill (orange gradient)
                         ● Thumb (white, hover: scale-125)
```

### 3.3 Romantic Copy (From binary-waltz PRD)

**English:**
```
Title: Mira - The Binary Waltz
Subtitle: Together, Until the End of Time

Description:
This is Mira (Omicron Ceti), a binary star system 
that has danced together for billions of years.

The red giant, like you, burns bright and magnificent; 
the companion, like me, forever follows your light.

No matter how the universe changes, 
we orbit each other until the end of time.

Interaction: Drag to Rotate · Scroll to Zoom · Feel the Eternity
```

**中文:**
```
标题：Mira - 双星共舞
副标题：在宇宙的尽头，我们依然相伴

描述：
这是蒭藁增二 (Mira)，一对已共舞数十亿年的双星。

红巨星如你，炽热而耀眼；伴星如我，永远追随你的光芒。

无论宇宙如何变迁，我们始终彼此环绕，直到时间的尽头。

交互：拖拽旋转 · 滚轮缩放 · 感受永恒
```

---

## 4. Technical Architecture

### 4.1 File Structure

```
src/
├── components/
│   ├── Scene.tsx              # Main 3D canvas, post-processing
│   ├── UI.tsx                 # Hero, footer, language toggle
│   └── ControlPanel.tsx       # 2 tabs, 6-8 sliders
├── shaders/
│   ├── miraA.ts               # Red giant surface shader
│   ├── atmosphere.ts          # Halo glow shader
│   ├── stream.ts              # Mass transfer stream
│   └── starTail.ts            # Particle trail shader
├── constants/
│   ├── colors.ts              # Color palette with emotion labels
│   ├── translations.ts        # EN/CN copy
│   └── physics.ts             # Orbital constants
├── types.ts                   # TypeScript definitions
├── App.tsx                    # Root component (useState, not Zustand)
└── main.tsx                   # Entry point
```

### 4.2 State Management

**Use React `useState` in App.tsx** — Zustand is overkill for this scale.

```typescript
interface UIState {
  language: 'EN' | 'CH';
  mode: 'GLOW' | 'WAVE' | 'PARTICLES';
  starA: { colorCore: string; colorSurface: string; turbulence: number };
  starB: { color: string; orbitSpeed: number; accretionOpacity: number };
  cosmos: { starCount: number; starSpeed: number; bloomIntensity: number };
  view: { zoom: number; autoRotateSpeed: number };
}
```

### 4.3 Performance Budget

| Target | Frame Time | Triangle Budget | Particle Budget | Post-Processing |
|--------|------------|-----------------|-----------------|-----------------|
| Desktop | <16ms (60fps) | <60K tris | <5,000 | Bloom (levels=3) + Noise |
| Mobile | <33ms (30fps) | <20K tris | <2,000 | Bloom only (levels=2) |

**Key Optimizations:**
- MiraA sphere: **64x64 segments** (not 128x128)
- Bloom levels: **3-4** (not 8)
- Chromatic aberration: **disabled** (minimal visual benefit)
- Mobile detection: reduce particles by 60%

---

## 5. Implementation Plan (3-5 Sessions)

### Session 1: Foundation (P0 Items)

| Task | Files | Duration |
|------|-------|----------|
| 1.1 Restore romantic copy | `constants/translations.ts`, `UI.tsx` | 30 min |
| 1.2 Fix Bloom levels (8→3) | `Scene.tsx` | 10 min |
| 1.3 Reduce sphere segments (128→64) | `MiraA.tsx` | 10 min |
| 1.4 Verify demo2 shaders work | All shaders | 30 min |
| 1.5 Add emotion labels to colors | `constants/colors.ts` | 15 min |

### Session 2: UX Refinement (P1 Items)

| Task | Files | Duration |
|------|-------|----------|
| 2.1 Simplify ControlPanel (3→2 tabs) | `ControlPanel.tsx` | 30 min |
| 2.2 Rename slider labels poetically | `ControlPanel.tsx` | 15 min |
| 2.3 Add camera choreography | `Scene.tsx` | 45 min |
| 2.4 Implement language toggle properly | `UI.tsx`, `translations.ts` | 30 min |

### Session 3: Mobile & Polish

| Task | Files | Duration |
|------|-------|----------|
| 3.1 Add mobile detection | `Scene.tsx`, utilities | 30 min |
| 3.2 Responsive UI (tablet/mobile) | `ControlPanel.tsx`, `UI.tsx` | 45 min |
| 3.3 Performance testing | Browser DevTools | 30 min |

### Session 4-5 (Optional): Enhancement

| Task | Files | Duration |
|------|-------|----------|
| 4.1 WAVE mode stream refinement | `stream.ts`, `Scene.tsx` | 60 min |
| 4.2 PARTICLES mode density tuning | `starTail.ts` | 30 min |
| 4.3 Ambient sound option | New audio module | 60 min |

---

## 6. Acceptance Criteria

### 6.1 Functional

- [ ] Binary star system renders correctly
- [ ] All 3 visual modes (GLOW/WAVE/PARTICLES) work
- [ ] Language toggle switches EN/CN without reload
- [ ] All sliders respond in real-time
- [ ] Camera controls work (drag, zoom)
- [ ] Romantic copy displays correctly

### 6.2 Visual

- [ ] Color palette matches spec (no generic gradients)
- [ ] Typography uses Cinzel/Inter/JetBrains Mono
- [ ] Glow effects are cinematic, not garish
- [ ] Background depth feels like deep space
- [ ] UI has frosted glass aesthetic

### 6.3 Performance

- [ ] Desktop: Stable 60fps (RTX 3060 or equivalent)
- [ ] Mobile: 30fps+ (mid-range Android/iOS)
- [ ] No console errors or warnings
- [ ] Initial load <3 seconds

### 6.4 Emotional

- [ ] Copy feels romantic, not clinical
- [ ] Color emotions are reflected in implementation
- [ ] Experience feels like a "love letter" not a "tech demo"
- [ ] Partner understands the metaphor without explanation

---

## 7. References

### 7.1 Source Projects

| Project | Location | Role |
|---------|----------|------|
| mira-binary-waltz | `projects/mira-binary-waltz/` | Romantic vision, copy, color emotions |
| mira-demo2 | `projects/mira-demo2/Mira-Demo2/` | Shader implementations, post-processing |
| mira-cosmic-river | `projects/mira-cosmic-river/` | Architecture, accessibility spec |

### 7.2 Scientific References

- **Mira (蒭藁增二)**: Binary system ~300 light-years from Earth
- **Mira A**: Red giant, pulsation period ~332 days
- **Mira B**: White dwarf, accreting matter from Mira A
- **UV Bow Shock**: 13-light-year tail discovered by NASA GALEX

### 7.3 Design Inspirations

- NASA GALEX Mira ultraviolet imaging
- Hubble binary star photography
- Film: *Interstellar* (space aesthetics)
- Game: *Outer Wilds* (romantic cosmic storytelling)

---

## 8. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Particle system too slow | High | LOD: reduce count on mobile, disable effects |
| Bloom looks flat/garish | Medium | Tune threshold (0.2) and radius (0.4-0.8) |
| Copy feels generic | Medium | Use binary-waltz PRD verbatim — it's proven |
| Mobile performance poor | High | Aggressive LOD, optional post-processing toggle |
| Over-engineering creep | Medium | Stick to P0/P1 — defer all P2 |

---

## Appendix A: Multi-Agent Review Summary

Four specialized agents reviewed this project:

| Agent | Key Finding | Top Recommendation |
|-------|-------------|-------------------|
| **Visual/UX** | demo2 has best shaders; binary-waltz has best soul | Merge demo2 shaders + binary-waltz copy |
| **Performance** | Bloom levels=8 is 3x overkill | Reduce to levels=3, save 1.5ms GPU |
| **Features** | cosmic-river over-engineered | Cut Zustand, 3-tab panel, GAN harness |
| **Romance** | demo2/cosmic-river lost emotional core | Restore "红巨星如你... 伴星如我..." |

---

## Appendix B: Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-07 | Build from demo2, not cosmic-river | demo2 has superior shader implementations |
| 2026-04-07 | Cut Zustand, use useState | 6 state values don't justify external store |
| 2026-04-07 | Simplify 3 tabs → 2 tabs | VIEW tab was sparse, poor UX |
| 2026-04-07 | Remove IntroAnimation | Delays first paint, feels like loading screen |
| 2026-04-07 | Keep all 3 visual modes | Each serves distinct emotional purpose |
