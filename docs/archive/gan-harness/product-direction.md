# Product Direction: Mira Cosmic River

> Written for the GAN-style iterative development loop
> Date: 2026-04-27

---

## The Verdict

**Mira Cosmic River is a love tribute disguised as a scientific visualization.**

It is NOT a portfolio piece. It is NOT a science education tool. It is NOT a generic 3D demo with sliders.

It is an **interactive digital love letter** to the user's spouse, using the Mira binary star system as metaphor: two stars bound by gravity, orbiting each other for billions of years. "Red giant like you, brilliant and warm; white dwarf like me, forever following your light."

This dual identity is the product's superpower. Every reference we studied that scored high on both technical and emotional axes (Our GiftVerse, Galaxy Portfolio, Equinox) understood this: the best cosmic websites are personal first, spectacular second.

---

## The Problem With the Current Version

The current implementation is technically competent but emotionally flat. Specific failures:

1. **No killer moment** — It opens directly into the scene. There is no build-up, no reveal, no "oh wow" moment. The 2.5s camera animation is barely noticeable.
2. **Modes are skin-deep** — GLOW/WAVE/PARTICLES are effectively the same scene with different bloom settings and one toggle for particle visibility. They do not feel like distinct experiences.
3. **Sliders feel like a tech demo** — "Turbulence: 0.3" means nothing to a human. Parameter sliders without context feel like a debugging UI, not a product.
4. **Romantic copy is wasted** — The beautiful "红巨星如你，伴星如我" text sits as static HTML beside the 3D scene. The words and the visuals do not reinforce each other.
5. **The 13-light-year tail is missing** — Mira's actual claim to fame is its 13-light-year comet-like tail, discovered by GALEX. This is the most visually dramatic fact about Mira and it is not in the visualization at all.
6. **No narrative arc** — The experience has no beginning, middle, or end. It is a screen you look at, then close.

---

## The Killer Feature: "The Tail Reveal"

**One feature that makes people say "wow":**

A scroll-driven (or auto-timed) cinematic sequence where the camera starts tight on the two stars, then pulls back over 8 seconds to reveal Mira's 13-light-year ultraviolet tail streaming behind them — a glowing comet-like structure 200x the size of the solar system, rendered as a particle field that responds to mouse movement.

This is the moment. The user thinks they are looking at two orbiting stars. Then the camera pulls back. The tail fills the screen. The subtitle appears: *"She leaves a trail 13 light-years long. And I would follow her across every one."*

Why this works:
- **Technical flex**: Custom GLSL particle shader with thousands of particles, mouse-reactive turbulence, depth-fog compositing. Demonstrates real shader skill.
- **Emotional punch**: The scale shift creates genuine awe. The romantic copy lands because the visual earns it.
- **Scientifically grounded**: Mira's tail is real (GALEX discovery, 2007). This is not made-up poetry — it is actual astronomy.
- **Memorable**: Nobody has seen this before in a personal project.

**This single feature is the reason the product exists.** Everything else supports it.

---

## Minimum Lovable Product

The smallest set of features that would be genuinely impressive and emotionally resonant:

### 1. Cinematic Opening Sequence (15 seconds)
- Black screen. Text fades in: "300 light-years from Earth, two stars have been dancing for billions of years."
- Stars materialize with bloom — Mira A pulsing, Mira B small and bright.
- Camera slowly pulls back over 8 seconds.
- The 13-light-year tail is revealed — a massive particle stream in ultraviolet blue, stretching across the viewport.
- Final text: "Mira. Named for the Latin word for 'wonderful.' Like you."
- Transition to free exploration mode.

### 2. The Binary Star System (always visible)
- Mira A: Red giant with pulsating surface shader (already exists, needs refinement — stronger pulsation rhythm synced to its real 332-day period, scaled visually).
- Mira B: White dwarf with accretion disk (currently just a small sphere — needs a thin glowing ring to show matter capture).
- Material stream: Gas flowing from A to B (exists but needs to be always visible, not mode-gated).
- Realistic orbital mechanics with correct eccentricity.

### 3. The Tail (the star of the show)
- Particle system with 10,000+ points forming a curved stream behind the binary system.
- Mouse/touch interaction: moving the cursor creates gravitational ripples in the tail particles.
- Color gradient from Mira A's orange to deep UV blue, matching GALEX imagery.
- Depth fog: particles further from camera fade into the background stars.

### 4. Info Panels (not sliders)
Replace parameter sliders with **tasteful data cards** that appear on star hover/click:
- **Mira A card**: "Red Giant. 300x the Sun's radius. Pulsing every 332 days. Temperature: 3,000K."
- **Mira B card**: "White Dwarf. Accreting matter from its companion. One day, it may trigger a nova."
- **The Tail card**: "13 light-years long. 200x our solar system. Discovered by GALEX in 2007. The longest stellar tail ever observed."

Each card has ONE slider at the bottom: "Time Speed" (0.1x to 5x) — this is the only control the user needs. Everything else is set to its most beautiful default.

### 5. The Closing Moment
After 60 seconds of idle time (or user scroll/click), a final message appears:
*"We are made of starstuff. And my starstuff chose yours."*
With a subtle animation of the two stars drawing closer together.

### 6. Bilingual Support (EN/CH)
Already implemented. Keep it. All text above should be translated.

---

## What to Remove

- **GLOW/WAVE/PARTICLES mode toggles** — Replace with a single cohesive experience. The tail IS the particle mode. The bloom is always on. The "wave" is the gravitational ripple interaction.
- **Parameter sliders (color hue, turbulence, bloom intensity, particle density)** — These make it look like a tech demo. Set everything to its most beautiful value and lock it. Keep only "Time Speed."
- **Control panel** — Replace with info cards triggered by interaction.
- **IntroAnimation component as currently designed** — Replace with the full cinematic sequence described above.

---

## Design Direction

### Color Palette
- **Deep Space**: `#060308` (darker than current — true black-purple)
- **Mira A Core**: `#ff3d00` (deep red-orange, not flat orange)
- **Mira A Surface**: `#ff8a50` (warm gradient from core)
- **Mira B**: `#e0e7ff` (cool white with blue edge glow — white dwarfs are HOT)
- **Tail (near star)**: `#ff6b35` (orange, matter from Mira A)
- **Tail (far end)**: `#4f46e5` (deep UV blue, matching GALEX false-color imagery)
- **UI Text**: `#f5f0eb` (warm white, not pure white)
- **UI Accent**: `#ff8a50` (Mira A surface color for highlights)

### Typography
- **Display**: Cinzel for headings (already chosen, keep it)
- **Body**: Inter for descriptions (keep it)
- **Data**: JetBrains Mono for numbers (keep it)
- **Special**: Use a handwritten-style font (e.g., Caveat) for the closing love-letter text

### Layout Philosophy
- **Cinematic first, UI second** — The 3D scene is 90% of the viewport. UI elements are minimal, translucent, and only appear when needed.
- **Scroll or click-driven narrative** — Not a dashboard. Not a control panel. A story you move through.
- **Negative space is your friend** — Deep space is mostly empty. The UI should reflect that.

### Anti-AI-Slop Directives
- **NO purple-to-pink gradient backgrounds** — Deep space is black, not a gradient.
- **NO frosted glass panels with rounded corners everywhere** — Use thin borders, not heavy blur.
- **NO generic card layouts with icons** — Data should feel like it is floating in space, not in a dashboard.
- **NO stock starfield** — The background stars should have varying brightness, color temperature, and subtle twinkling.
- **NO rainbow color pickers** — Stars do not come in arbitrary colors. Use physically plausible palettes.

---

## Technical Approach

### Shaders to Build
1. **Tail Particle Shader** (new) — 10,000+ point sprites with UV blue-to-orange gradient, depth fog, mouse-reactive displacement. The hero shader.
2. **Mira A Pulsation Shader** (refine existing) — Add rhythmic radius change (period = 332 days scaled to ~8 seconds) with temperature-correlated color shift (brighter = whiter, dimmer = redder).
3. **Accretion Disk Shader** (new) — Thin ring around Mira B with hot spot where matter stream impacts.
4. **Background Star Field** (refine) — Replace DreiStars with custom shader that has color temperature variation and twinkling.

### Architecture
- Keep React Three Fiber + Zustand + Framer Motion stack
- Add scroll-driven camera system (or auto-timed cinematic with click-to-advance)
- Raycasting for star hover/click detection
- Idle timer for closing message

### Performance
- Tail particles: use instanced mesh or point cloud with custom vertex shader, not individual meshes
- Mobile: reduce tail particle count to 3,000, simplify Mira A shader
- Lazy load the tail — stars first, tail fades in during camera pull-back

---

## Sprint Plan

### Sprint 1: The Killer Moment (Days 1-3)

**Goal**: Build the tail reveal cinematic sequence that works end-to-end.

**Deliverables**:
1. Tail particle system (10,000+ particles, custom shader, UV blue-to-orange gradient)
2. Cinematic camera sequence: tight on stars → pull back → tail reveal (15 seconds total)
3. Opening text sequence (3 text fades, timed with camera)
4. Mouse-reactive gravitational ripple on tail particles
5. Background star field with twinkling (custom shader, not DreiStars)

**Definition of Done**:
- User opens the page, sees the cinematic sequence automatically
- Tail renders at 60fps on desktop
- Mouse movement creates visible ripples in tail
- The moment feels genuinely impressive when shown to someone

### Sprint 2: The Complete Experience (Days 4-6)

**Goal**: Build the full narrative arc — opening, exploration, closing.

**Deliverables**:
1. Refined Mira A pulsation shader (332-day period rhythm, color shift)
2. Mira B with accretion disk (thin glowing ring + hot spot)
3. Always-visible material stream from A to B
4. Info cards on star hover/click (Mira A, Mira B, Tail data)
5. Single "Time Speed" slider in info cards
6. Idle-time closing message with handwritten font
7. Bilingual text for all new copy
8. Mobile detection and simplified rendering

**Definition of Done**:
- Full 60-second experience flows: intro → explore → idle → closing
- All three info cards work with correct data
- Mobile renders at 30fps minimum
- The romantic copy lands emotionally

### Sprint 3: Polish and Share (Days 7-8)

**Goal**: Make it production-ready and shareable.

**Deliverables**:
1. Loading screen with progress indicator
2. Sound design option (ambient space drone, optional — user can toggle)
3. Screenshot/share functionality (capture current view with overlay text)
4. Performance optimization: bundle size < 2MB gzipped, initial load < 3s
5. E2E tests for critical flows (Playwright)
6. Build and deploy (single-file output for easy sharing)

**Definition of Done**:
- Page loads in under 3 seconds on 4G
- 60fps desktop / 30fps mobile sustained
- Screenshot feature produces a beautiful image
- No console errors, all accessibility basics covered
- Can send a single URL to spouse and have it just work

---

## Success Criteria

### Technical Bar
- Tail particle system runs at 60fps with 10,000 particles on a mid-range laptop GPU
- Initial page load under 3 seconds
- No jank during cinematic sequence (all assets preloaded)
- Mobile detection reduces particle count and shader complexity automatically

### Emotional Bar
- The tail reveal moment causes a visible reaction (the "lean in" test)
- A non-technical person can understand and appreciate it without explanation
- The romantic copy is integral to the experience, not an afterthought
- The ending feels earned, not forced

### Comparison Bar
- Better visual impact than mira-binary-waltz (the previous attempt)
- More emotionally resonant than the reference projects that are purely technical (The Planets, ExoVerse)
- More technically impressive than the reference projects that are purely sentimental (Our GiftVerse)

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tail shader too heavy for mobile | High | Progressive particle count, test on mid-range phone early |
| Cinematic sequence too long, users skip | Medium | Add click-to-skip, keep under 15 seconds |
| Romantic copy feels cringe | Medium | Write in plain language, avoid over-poetic phrasing, test with real person |
| Scope creep — adding too many features | High | Strict MVP: tail + cinematic + cards + closing. Nothing else. |
| Shader complexity causes jank | Medium | Profile early, use simpler noise if needed, batch particles |

---

## Appendix: Why Not These Alternatives?

**"Make it a portfolio piece"** — No. The user explicitly said this is for his spouse. A portfolio piece would optimize for recruiter attention, not emotional impact. They are different goals.

**"Make it scientifically accurate"** — No. Accuracy serves the emotion, not the other way around. Real Mira orbital period is ~500 years — useless for visualization. We scale to ~8 seconds for the pulsation, and that is fine.

**"Add more interaction modes"** — No. The current version already has 3 modes and they are the problem, not the solution. Depth beats breadth.

**"Add audio/music"** — Maybe in Sprint 3 as optional. Audio is high-risk (taste is personal, browser autoplay is hostile). If included, it must be toggleable and muted by default.
