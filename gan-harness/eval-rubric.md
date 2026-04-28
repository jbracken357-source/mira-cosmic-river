# Mira Cosmic River - Design-Focused Evaluation Rubric

## Scoring Scale
- **1-2**: Critical failure (broken, unusable)
- **3-4**: Significant issues (works but problematic)
- **5-6**: Functional (works, meets basic requirements)
- **7-8**: Good quality (polished, thoughtful)
- **9-10**: Exceptional (exceeds expectations, delightful)

---

## 1. Design Quality (weight: 0.35) — 35 points

### 1.1 Color & Light (10 points)
- [ ] Mira A reads as a deep red giant (not yellow/white)
- [ ] Mira B reads as a hot blue-white dwarf
- [ ] Tail gradient: orange near star → UV blue at far end
- [ ] Bloom is cinematic, not garish or overexposed
- [ ] Deep space background feels truly dark (#060308 or darker)
- [ ] No generic purple/pink gradient backgrounds

### 1.2 Typography & Layout (10 points)
- [ ] Cinzel used for display headings
- [ ] Inter used for body text
- [ ] JetBrains Mono for data/numbers
- [ ] Caveat (or similar handwritten) for closing message
- [ ] Text placement respects negative space
- [ ] No dashboard-like card layouts with icons

### 1.3 Visual Identity (10 points)
- [ ] The tail is visible and dramatic in explore mode
- [ ] Stars feel alive (pulsation, glow, atmosphere)
- [ ] Background stars have varying brightness/color/twinkle
- [ ] Material stream is visible connecting the stars
- [ ] Accretion disk on Mira B is visible
- [ ] Overall aesthetic is cohesive and intentional

### 1.4 UI Polish (5 points)
- [ ] UI elements are minimal, translucent, thin borders
- [ ] No heavy frosted glass panels with rounded corners everywhere
- [ ] InfoCards look like they float in space, not a dashboard
- [ ] Interaction hint is subtle and non-intrusive

---

## 2. Originality (weight: 0.30) — 30 points

### 2.1 Creative Leaps (10 points)
- [ ] The tail reveal moment feels genuinely awe-inducing
- [ ] Mouse-reactive gravitational ripples on tail particles
- [ ] Cinematic camera sequence feels like a film, not a tech demo
- [ ] Something that would make a designer say "I haven't seen this before"

### 2.2 Emotional Resonance (10 points)
- [ ] Romantic copy is integral to the experience
- [ ] Text and visuals reinforce each other
- [ ] The closing message feels earned, not forced
- [ ] A non-technical person can appreciate it without explanation

### 2.3 Distinctive Identity (10 points)
- [ ] Not a generic 3D demo with sliders
- [ ] Has a cohesive narrative arc (beginning, middle, end)
- [ ] Feels like a personal tribute, not a portfolio piece
- [ ] Scientifically grounded but emotionally driven

---

## 3. Craft (weight: 0.25) — 25 points

### 3.1 Shader Quality (10 points)
- [ ] Mira A pulsation shader: rhythmic, temperature-correlated color shift
- [ ] Tail particle shader: noise-driven displacement, mouse ripple, depth fog
- [ ] Accretion disk shader: thin ring with hot spot
- [ ] Mira B shader: intense core, blue-white edge glow
- [ ] No shader artifacts or visual glitches

### 3.2 Code Organization (5 points)
- [ ] Components are well-separated (Scene, UI, shaders)
- [ ] TypeScript types are comprehensive
- [ ] Design tokens in constants (no hardcoded values in components)
- [ ] ES module exports used correctly

### 3.3 Performance (5 points)
- [ ] Runs at 60fps on desktop
- [ ] No console errors or warnings
- [ ] Mobile detection reduces complexity
- [ ] Bundle size reasonable

### 3.4 Polish (5 points)
- [ ] Transitions use spring physics (not linear)
- [ ] Timing feels slow and elegant
- [ ] Micro-interactions on hover/click
- [ ] Reduced motion preference respected

---

## 4. Functionality (weight: 0.10) — 10 points

### 4.1 Core Features (5 points)
- [ ] Binary star system renders and orbits
- [ ] Cinematic sequence auto-plays on load
- [ ] Skip button works
- [ ] InfoCards appear on star click
- [ ] Tail card is triggerable
- [ ] Time speed slider works
- [ ] Language switch works
- [ ] Closing message appears on idle

### 4.2 Cinematic Flow (5 points)
- [ ] Phase 1: Dark → stars appear (2s)
- [ ] Phase 2: Pull back camera (8s)
- [ ] Phase 3: Tail reveal (3s)
- [ ] Phase 4: Title text (2.5s)
- [ ] Phase 5: Free exploration

---

## Deductions
- **-5**: Console errors or warnings
- **-5**: Mira A appears yellow instead of red
- **-5**: Tail not visible in explore mode
- **-3**: Generic AI-slop aesthetics (purple gradients, frosted glass overload)
- **-3**: Text bug (wrong translation key)
- **-2**: Tail card not triggerable

**If Mira A is yellow OR tail is invisible, score cannot exceed 7.0.**

---

## Critical Checks (Pass/Fail)
- [ ] WebGL works on load
- [ ] No white screen on startup
- [ ] Language switch works
- [ ] Cinematic sequence plays
- [ ] Stars orbit continuously

**If any critical check fails, score cannot exceed 50.**
