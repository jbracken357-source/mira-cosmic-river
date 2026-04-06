# Mira Cosmic River - Evaluation Rubric

## Scoring Scale
- **1-2**: Critical failure (broken, unusable)
- **3-4**: Significant issues (works but problematic)
- **5-6**: Functional (works, meets basic requirements)
- **7-8**: Good quality (polished, thoughtful)
- **9-10**: Exceptional (exceeds expectations, delightful)

---

## 1. Functionality (30 points)

### 1.1 Core Visualization (10 points)
- [ ] Binary star system renders correctly
- [ ] Mira A displays as pulsating red giant
- [ ] Mira B displays as smaller white dwarf
- [ ] Orbital motion is smooth and continuous
- [ ] Material stream connects both stars

### 1.2 Visual Modes (10 points)
- [ ] GLOW mode renders with bloom emphasis
- [ ] WAVE mode shows space-time distortion
- [ ] PARTICLES mode displays matter transfer
- [ ] Mode transitions are smooth
- [ ] Each mode has distinct visual identity

### 1.3 Controls & Interactivity (10 points)
- [ ] Parameter sliders respond in real-time
- [ ] Mode toggle works correctly
- [ ] Language switch toggles EN/CH
- [ ] Animation pause/play functions
- [ ] Camera controls work (drag, zoom, reset)

---

## 2. Design & Aesthetics (25 points)

### 2.1 Visual Quality (10 points)
- [ ] Color palette matches spec (no generic gradients)
- [ ] Typography uses Cinzel/Inter/JetBrains Mono
- [ ] Glow effects are cinematic, not garish
- [ ] Background depth feels like deep space
- [ ] Overall aesthetic is cohesive and intentional

### 2.2 Animation & Motion (10 points)
- [ ] Intro animation is orchestrated (not instant)
- [ ] Transitions use spring physics (not linear)
- [ ] Timing feels slow and elegant (300-500ms)
- [ ] Micro-interactions on hover/click
- [ ] Reduced motion preference is respected

### 2.3 Layout & Composition (5 points)
- [ ] Visual hierarchy is clear
- [ ] Controls are well-positioned
- [ ] Information density is balanced
- [ ] Focal point is the binary system

---

## 3. Craft & Code Quality (20 points)

### 3.1 Code Organization (10 points)
- [ ] File structure matches spec
- [ ] Components are well-separated
- [ ] TypeScript types are comprehensive
- [ ] No hardcoded values (uses design tokens)
- [ ] ES module exports used correctly

### 3.2 Performance (5 points)
- [ ] Runs at 60fps
- [ ] No console errors
- [ ] Memory usage is reasonable
- [ ] Bundle size is optimized

### 3.3 Accessibility (5 points)
- [ ] ARIA labels on interactive elements
- [ ] Keyboard navigation works
- [ ] Reduced motion support
- [ ] High contrast support

---

## 4. Responsiveness (15 points)

### 4.1 Desktop (5 points)
- [ ] Full control panel visible
- [ ] Optimal viewing angle
- [ ] All features accessible

### 4.2 Tablet (5 points)
- [ ] Collapsible controls
- [ ] Touch interactions work
- [ ] No horizontal scroll

### 4.3 Mobile (5 points)
- [ ] Bottom sheet or compact controls
- [ ] Touch-friendly sizes
- [ ] Performance maintained

---

## 5. Originality & Delight (10 points)

### 5.1 Uniqueness (5 points)
- [ ] Not a generic 3D demo
- [ ] Has distinctive visual identity
- [ ] Feels like a cohesive experience

### 5.2 Delight Factors (5 points)
- [ ] Surprising details
- [ ] Thoughtful touches
- [ ] Memorable experience

---

## Deductions

- **-5**: Console errors or warnings
- **-5**: Broken functionality
- **-3**: Generic AI-slop aesthetics (purple gradients, Inter-only typography)
- **-3**: Missing accessibility features
- **-2**: Performance issues
- **-2**: Hardcoded values instead of design tokens

---

## Critical Checks (Pass/Fail)

- [ ] WebGL works on load
- [ ] No white screen on startup
- [ ] Language switch works
- [ ] All three modes accessible
- [ ] At least one parameter adjustable

**If any critical check fails, score cannot exceed 50.**