# Mira Cosmic River - Design Spec (GAN Design Iteration)

> The product direction is defined in `product-direction.md`. This spec covers the remaining design gaps to close.

## Current State

The project has a working 3D binary star system with:
- Mira A (red giant with pulsation shader)
- Mira B (white dwarf with accretion disk)
- 13-light-year tail particle system (mouse-reactive)
- Cinematic 15s opening sequence
- InfoCards on star click
- Closing message on idle
- Bilingual EN/CH

## Design Gaps to Close (from visual audit)

### 1. Mira A Color — Appears Yellow, Not Red
**Problem**: The Mira A shader uses `#881100` core and `#550800` surface, but bloom post-processing overexposes it to yellow/white.
**Fix**: Either darken the shader core colors significantly (use `#330500` / `#1a0200`), or add a luminance clamp in the bloom threshold, or both. The star should read as a deep red giant, not a yellow sun.

### 2. Tail Visibility — Not Visible in Explore Mode
**Problem**: The tail extends in -X direction but the close camera position `[6, 2, 8]` doesn't show it. The tail is likely extending behind the star from the camera's POV.
**Fix**: Adjust tail generation geometry so it's visible from the default camera angle. Consider extending in a direction that crosses the viewport diagonally, or adjust the camera's explore position to show the tail.

### 3. Cinematic Text Bug
**Problem**: Line 86 in CinematicOverlay.tsx uses `t.cinematic2` for the tail reveal phase instead of `t.cinematic3`.
**Fix**: Change to `t.cinematic3`.

### 4. Mira B Positioning
**Problem**: Mira A is at `[0, 0, 0]` (center) but Mira B orbits around it. The cinematic camera's `lookAt: [0, 0, 0]` means Mira B is off-center in the frame.
**Fix**: The orbital mechanics already offset Mira A slightly (`primaryOffset = 0.1`), but consider centering the camera lookAt on the barycenter, or making Mira A the true center with Mira B orbiting.

### 5. Tail Card Clickability
**Problem**: The tail is a particle system with no clickable target. The InfoCard has a `tail` option but nothing triggers it.
**Fix**: Add an invisible mesh or raycasting target near the tail for the tail card to appear.

### 6. Color Palette Alignment with Product Direction
**Problem**: The product-direction.md specifies new colors:
- Deep Space: `#060308` (not `#0a0612`)
- Mira A Core: `#ff3d00` (not current `#881100`)
- Mira B: `#e0e7ff` (not current `#a8d5ff`)
- Tail Near: `#ff6b35`, Tail Far: `#4f46e5` (these match current)

**Fix**: Update colors.ts to match the product direction palette.

## Anti-AI-Slop Directives (from product-direction.md)
- NO purple-to-pink gradient backgrounds
- NO frosted glass panels with rounded corners everywhere — use thin borders
- NO generic card layouts with icons
- NO stock starfield
- NO rainbow color pickers

## Typography
- Display: Cinzel
- Body: Inter
- Data: JetBrains Mono
- Closing: Caveat (handwritten style)
