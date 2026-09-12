# Generator State

**Last Updated**: 2026-04-28
**Current Iteration**: v8 (GAN Design — remaining issues)

---

## What Was Built (All Iterations)

### Iteration 001: Initial Implementation (2026-04-06)
- Vite 8 + React 19 + TypeScript 6
- Tailwind CSS v4, Three.js r182, R3F 9, R3Drei 10, Postprocessing 3
- Framer Motion 12, Zustand
- Binary star system with custom shaders
- Three visual modes (GLOW/WAVE/PARTICLES)
- 6 parameter sliders
- EN/CH language switching
- Glass-morphism control panel

### Iteration 002: Product Direction Pivot (2026-04-27)
- Removed 3 modes → single cohesive experience
- Removed sliders → info cards on star click
- Added 15s cinematic camera sequence
- Added tail particle system (10,000 particles, mouse-reactive)
- Added custom twinkling StarField
- Added closing message on idle

### Iterations v3-v5: Visual Refinement
- Mira A pulsation shader refinement
- Mira B accretion disk
- Material stream always visible
- Tail shader improvements
- Cinematic text overlay

### Iteration v6: UI Polish
- InfoCards component for star click
- Closing message with Caveat font
- Explore mode UI
- Multiple screenshot verifications

### Iteration v7: GAN Design Fixes (2026-04-28)
**Fixed issues:**
1. **Mira A color** — Changed from yellow/white to deep red-orange (#ff3d00 core, #ff8a50 surface)
2. **Background color** — Darkened to #060308 per product direction
3. **Mira B color** — Changed to #e0e7ff (cool white) per product direction
4. **Tail opacity** — Fixed by computing opacity in useFrame instead of React render cycle
5. **Tail visibility** — Rotated tail group by 22 degrees for better viewing angle
6. **Tail particle size** — Increased from 5.0 to 8.0
7. **Cinematic text bug** — Fixed tail reveal phase using t.cinematic3 instead of t.cinematic2
8. **Tail card clickability** — Added invisible box mesh as click target
9. **Cleaned up unused props** — Removed hue prop from MiraA and MiraB
10. **Fixed TypeScript errors** — Removed unused useCallback import

### Iteration v8: Remaining Issues (2026-04-28)
**Fixed issues:**
1. **Tail visibility in explore mode** — Moved explore camera to [10, 5, 18] looking at [-2, 1, 2] (was [8, 3, 12] at origin). Added subtle ambient orange glow sphere at tail center for visual anchoring.
2. **Stale E2E tests** — Rewrote mira-cosmic.spec.ts for cinematic + info cards flow. Fixed language-test.spec.ts selectors.
3. **Mira B accretion disk visibility** — Increased disk scale from 2.5x to 3.5x, widened ring bounds, raised opacity from 0.7 to 0.9.

---

## Remaining Issues

None — all v7 remaining items addressed.

---

## Dev Server
- Command: `npm run dev`
- Build: `npm run build` (passes cleanly)
