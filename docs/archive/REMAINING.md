# Mira Cosmic River — Remaining Items

**Last Updated**: 2026-04-28 (after GAN Design v7 fixes)

---

## P1 — Must Do (Visual Impact)

### 1. Tail Visibility in Explore Mode
**Problem**: Tail is clearly visible during cinematic but hard to see in explore mode at further camera distance. Auto-rotate camera also moves the view away from it.
**Options**:
- Adjust explore camera position to frame both the binary stars and the tail
- Add a subtle glow/halo around the tail area for visibility from any angle
- Increase particle size/count further for explore mode
**Priority**: High — the tail is the killer feature

### 2. Mira B Accretion Disk Visibility
**Problem**: Disk is present but hard to see. The product direction calls for a "thin glowing ring with hot spot where matter stream impacts."
**Fix**: Increase disk opacity, add a brighter hot spot at the stream impact point, ensure it's visible from default camera angle.
**Priority**: Medium

### 3. Mira A Atmospheric Glow
**Problem**: The atmosphere halo shader color was darkened to avoid overexposure, but it may be too dark now — the star reads as a flat orange sphere without enough "giant star" glow.
**Fix**: Adjust atmosphere shader to have a wider, softer falloff glow that doesn't clip.
**Priority**: Medium

---

## P2 — Should Do (Experience Polish)

### 4. Close Button Animation on InfoCards
**Problem**: InfoCards appear but could use a more dramatic entrance/exit animation to match the cinematic feel.
**Fix**: Add subtle glow border animation on card open.

### 5. Tail Card Interaction
**Problem**: The tail card is triggerable via invisible click target, but the user needs to know they can click on the tail.
**Fix**: Add a subtle "click me" hint near the tail, or auto-show the tail card briefly after cinematic ends.

### 6. Mira A Pulsation Visual Impact
**Problem**: The pulsation is subtle. The product direction calls for "stronger pulsation rhythm synced to its real 332-day period, scaled visually."
**Fix**: Increase the radius pulse amplitude from 5% to 8-10%, make the color shift more dramatic (brighter = whiter at peak).

---

## P3 — Nice to Have

### 7. Loading Screen
**Problem**: No loading indicator during initial asset load.
**Fix**: Simple "Loading Mira..." text that fades out.

### 8. Stale E2E Tests
**Problem**: Tests reference old UI (control panel, mode buttons, sliders).
**Fix**: Either rewrite for new UI (cinematic → info cards → closing) or remove.

### 9. Closing Message Enhancement
**Problem**: Closing message is just text. Product direction calls for "subtle animation of the two stars drawing closer together."
**Fix**: Add a slow zoom/pull-in camera animation when the closing message appears.

### 10. Background Stars Twinkle Quality
**Problem**: Custom StarField exists but could have more color temperature variation for a richer deep space feel.
**Fix**: Add warm/cool color temperature variation to individual stars.

---

## Done (v7)

- [x] Mira A color: deep red-orange (#ff3d00/#ff8a50)
- [x] Background color: #060308
- [x] Mira B color: cool white (#e0e7ff)
- [x] Tail opacity: fixed via useFrame computation
- [x] Tail rotation: 22 degrees for visibility
- [x] Tail particle size: increased to 8.0
- [x] Cinematic text bug: t.cinematic3
- [x] Tail card clickability: invisible target added
- [x] Unused hue props removed
- [x] TypeScript errors fixed
