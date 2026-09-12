# Implementation Plan - Mira Cosmic River

**Created:** 2026-04-07  
**Timeline:** 3-5 sessions (Medium)  
**Approach:** Build from mira-demo2, enrich with binary-waltz romantic vision

---

## Session Overview

| Session | Focus | Duration | Key Deliverables |
|---------|-------|----------|------------------|
| **Session 1** | Foundation (P0) | 1.5 hours | Romantic copy, performance fixes, shader verification |
| **Session 2** | UX Refinement (P1) | 1.5 hours | Simplified controls, camera choreography |
| **Session 3** | Mobile & Polish | 1.5 hours | Responsive design, performance testing |
| **Session 4-5** | Enhancement (Optional) | 2-3 hours | WAVE/PARTICLE refinement, ambient sound |

---

## Session 1: Foundation (P0 Items)

### Task 1.1: Restore Romantic Copy
**File:** `src/constants/translations.ts` (new), `src/components/UI.tsx`  
**Duration:** 30 minutes

**Action:**
1. Create new `translations.ts` with full binary-waltz copy
2. Replace existing technical text in UI.tsx
3. Verify both EN/CN versions display correctly

**Source (binary-waltz PRD section 6.1):**
```typescript
export const TRANSLATIONS = {
  en: {
    title: 'Mira - The Binary Waltz',
    subtitle: 'Together, Until the End of Time',
    description: [
      'This is Mira (Omicron Ceti), a binary star system that has danced together for billions of years.',
      'The red giant, like you, burns bright and magnificent; the companion, like me, forever follows your light.',
      'No matter how the universe changes, we orbit each other until the end of time.'
    ],
    interaction: 'Drag to Rotate · Scroll to Zoom · Feel the Eternity'
  },
  ch: {
    title: 'Mira - 双星共舞',
    subtitle: '在宇宙的尽头，我们依然相伴',
    description: [
      '这是蒭藁增二 (Mira)，一对已共舞数十亿年的双星。',
      '红巨星如你，炽热而耀眼；伴星如我，永远追随你的光芒。',
      '无论宇宙如何变迁，我们始终彼此环绕，直到时间的尽头。'
    ],
    interaction: '拖拽旋转 · 滚轮缩放 · 感受永恒'
  }
};
```

---

### Task 1.2: Fix Bloom Levels
**File:** `src/components/Scene.tsx`  
**Duration:** 10 minutes

**Action:**
```diff
- <Bloom luminanceThreshold={0.2} mipmapBlur intensity={bloomIntensity} radius={0.8} levels={8} />
+ <Bloom luminanceThreshold={0.2} mipmapBlur intensity={bloomIntensity} radius={0.6} levels={4} />
```

**Impact:** -1.5ms GPU time per frame

---

### Task 1.3: Reduce Sphere Segments
**File:** `src/components/Scene/MiraA.tsx`  
**Duration:** 10 minutes

**Action:**
```diff
- <sphereGeometry args={[radius, 128, 128]} />
+ <sphereGeometry args={[radius, 64, 64]} />
```

**Impact:** -0.3ms GPU time, 32K → 8K triangles (visually indistinguishable)

---

### Task 1.4: Verify Demo2 Shaders
**Files:** `src/shaders/miraA.ts`, `src/shaders/atmosphere.ts`, `src/shaders/stream.ts`  
**Duration:** 30 minutes

**Action:**
1. Port shaders from `mira-demo2/Mira-Demo2/components/MiraSystem.tsx`
2. Ensure turbulence, fresnel, and noise functions work
3. Test in all 3 visual modes (GLOW/WAVE/PARTICLES)

**Key shaders to port:**
- `MiraA_Shader` (lines 9-64) — vertex displacement + fresnel limb
- `Atmosphere_Shader` (lines 67-86) — halo glow
- `Stream_Shader` (lines 89-139) — mass transfer plasma

---

### Task 1.5: Add Emotion Labels to Colors
**File:** `src/constants/colors.ts`  
**Duration:** 15 minutes

**Action:**
```typescript
export const COLORS = {
  DEEP_SPACE: {
    hex: '#0a0612',
    emotion: 'Eternal Silence / 永恒的寂静'
  },
  STELLAR_ORANGE: {
    hex: '#ff6b35',
    emotion: 'Burning Life / 炽热的生命'
  },
  // ... etc
};
```

---

## Session 2: UX Refinement (P1 Items)

### Task 2.1: Simplify ControlPanel (3→2 Tabs)
**File:** `src/components/UI/ControlPanel.tsx`  
**Duration:** 30 minutes

**Action:**
Merge VIEW tab content into SYSTEM and ENVIRONMENT:

```tsx
// OLD: 3 tabs
const tabs = ['SYSTEM', 'COSMOS', 'VIEW'];

// NEW: 2 tabs
const tabs = ['STAR_SYSTEM', 'ENVIRONMENT'];

// Structure:
// STAR_SYSTEM tab:
//   - Mira A (color, turbulence)
//   - Mira B (color, orbit speed)
//   - Display Mode (GLOW/WAVE/PARTICLES buttons)

// ENVIRONMENT tab:
//   - Particle Density
//   - Bloom Intensity
//   - Auto Rotate Speed
```

---

### Task 2.2: Rename Slider Labels Poetically
**File:** `src/components/UI/ControlPanel.tsx`  
**Duration:** 15 minutes

**Action:**
| Technical | Poetic |
|-----------|--------|
| Turbulence | Stellar Breath / 恒星呼吸 |
| Bloom Intensity | Starlight Glow / 星光辉光 |
| Particle Density | Stardust Density / 星尘密度 |
| Orbit Speed | Cosmic Dance / 宇宙之舞 |

---

### Task 2.3: Add Camera Choreography
**File:** `src/components/Scene.tsx`  
**Duration:** 45 minutes

**Action:**
Implement 2.5s orchestrated intro:

```typescript
useFrame((state, delta) => {
  if (!introComplete) {
    // Phase 1: Push in from wide shot (0-1s)
    // Phase 2: Settle to final position (1-2.5s)
    state.camera.position.lerp(finalPosition, 0.01);
    state.camera.lookAt(0, 0, 0);
  }
});
```

---

### Task 2.4: Implement Language Toggle
**File:** `src/components/UI.tsx`, `src/constants/translations.ts`  
**Duration:** 30 minutes

**Action:**
```tsx
<button
  onClick={() => setLanguage(lang === 'en' ? 'ch' : 'en')}
  className="top-4 left-4 ..."
>
  {lang === 'en' ? '中文' : 'EN'}
</button>
```

---

## Session 3: Mobile & Polish

### Task 3.1: Mobile Detection
**File:** `src/hooks/useMobile.ts` (new), `src/components/Scene.tsx`  
**Duration:** 30 minutes

**Action:**
```typescript
// Detect mobile via UA or screen width
const isMobile = window.innerWidth < 640;

// Apply LOD
const particleCount = isMobile ? 1500 : 5000;
const sphereSegments = isMobile ? 32 : 64;
const bloomLevels = isMobile ? 2 : 4;
```

---

### Task 3.2: Responsive UI
**File:** `src/components/UI/ControlPanel.tsx`, `src/components/UI.tsx`  
**Duration:** 45 minutes

**Action:**
```tsx
// Mobile: bottom sheet
<div className="fixed bottom-0 left-0 right-0 md:relative md:w-80">
  {/* Collapsed: mode buttons only */}
  {/* Expanded: full control panel */}
</div>
```

---

### Task 3.3: Performance Testing
**Tool:** Chrome DevTools, Firefox Profiler  
**Duration:** 30 minutes

**Checklist:**
- [ ] Desktop: 60fps stable (RTX 3060 or equivalent)
- [ ] Mobile: 30fps+ (simulate via DevTools)
- [ ] No console errors
- [ ] Memory < 500MB GPU
- [ ] Initial load < 3 seconds

---

## Session 4-5 (Optional): Enhancement

### Task 4.1: WAVE Mode Stream Refinement
**File:** `src/shaders/stream.ts`  
**Duration:** 60 minutes

**Action:**
Enhance mass transfer visualization with:
- Volumetric appearance (scrolling emissive texture)
- Better color gradient (orange → violet)
- Subtle arc animation (follows orbital motion)

---

### Task 4.2: PARTICLES Mode Density Tuning
**File:** `src/components/Scene/StarTail.tsx`  
**Duration:** 30 minutes

**Action:**
- Increase particle count to 8000 for dramatic effect
- Add life-based alpha fading
- Tune flow speed to match orbit period

---

### Task 4.3: Ambient Sound (Nice-to-have)
**File:** `src/hooks/useAmbientSound.ts` (new)  
**Duration:** 60 minutes

**Action:**
- Add optional ambient drone (Hans Zimmer-style organ)
- Muted by default, toggle in UI
- Fade in/out on mode change

---

## Pre-Flight Checklist

Before starting Session 1:

- [ ] `mira-demo2` runs successfully (`npm run dev`)
- [ ] All shader files identified and backed up
- [ ] binary-waltz PRD.md accessible for copy reference
- [ ] Node.js 18+ installed
- [ ] Browser DevTools ready for performance testing

---

## Definition of Done

**Session complete when:**

✅ All P0/P1 tasks for that session are implemented  
✅ No console errors or warnings  
✅ Performance targets met (60fps desktop, 30fps mobile)  
✅ Romantic copy displays correctly in both languages  
✅ Visual modes (GLOW/WAVE/PARTICLES) all functional  

---

## Risk Log

| Risk | Mitigation |
|------|------------|
| Shader porting fails | Keep demo2 fallback, iterate gradually |
| Mobile performance poor | Aggressive LOD, disable post-processing |
| Copy feels generic | Use binary-waltz PRD verbatim — it's proven |
| Over-engineering creep | Stick to P0/P1 — defer all P2 to future |

---

## Post-Session Review

After each session, answer:

1. What shipped?
2. What blocked progress?
3. What needs revision next session?
4. Is the romantic vision intact?

---

## Session Tracking

| Session | Date | Completed | Blocked | Notes |
|---------|------|-----------|---------|-------|
| 1 | TBD | [ ] 1.1 [ ] 1.2 [ ] 1.3 [ ] 1.4 [ ] 1.5 | | |
| 2 | TBD | [ ] 2.1 [ ] 2.2 [ ] 2.3 [ ] 2.4 | | |
| 3 | TBD | [ ] 3.1 [ ] 3.2 [ ] 3.3 | | |
| 4-5 | TBD | [ ] 4.1 [ ] 4.2 [ ] 4.3 | | |
