# Mira Cosmic River

An immersive 3D take on the Mira binary star system — a red giant and a white dwarf
orbiting each other 300 light-years away, dragging a comet-like tail 13 light-years
long behind them.

Two stars drawn to each other, travelling together through an immense river of light.
It is a romantic space to return to: beauty, intimacy and scale guide the visuals.
See [the visual decision](docs/adr/0003-romantic-hybrid-visuals.md).

- **Live**: https://mira-cosmic-river.vercel.app
- **Viewer**: the project owner, on desktop and phone
- **The one job of every screen**: make tonight's sky worth a second look

## What makes it worth returning to

**Real-time binding.** Mira A's brightness uses a deterministic approximation based on
its ~332-day cycle. Beyond brightness, local colour temperature and the river's density
now vary subtly with the same cycle — tonight's sky is a little different from last
week's, reproducibly. The visible orbit is a slow artistic animation, not a prediction
of the stars' observed positions. No live astronomy service is required.

**Direct entry.** The full 15-second opening plays on a first visit only. After that the
scene opens straight into the sky, with a very short title fade. The full opening stays
available as a deliberate choice — for showing someone, or just watching it again.

**Ambient sound.** Silent by default. One toggle starts an original synthesised ambient
bed (no voices, no lyrics) that follows the viewing distance; the preference is
remembered, and sound waits politely for a gesture if the browser requires one.

**Tonight's Mira.** The save entry locks the current view at the moment it is pressed —
frame, date, language and phase together — and exports a clean PNG with optional date
and a fixed phrase. No controls in the image, no re-framing.

**The tail.** The 13-light-year ultraviolet wake is the emotional centre of the scene,
discovered by GALEX in 2007, interpreted here as the light left by a shared journey.

Terminology (viewer, replayability, direct entry, full cinematic, ritual moment,
real-time binding, pulsation phase, the tail, info card, ambient sound, tonight's Mira,
epilogue) is defined in [CONTEXT.md](./CONTEXT.md). Please use those words rather than
code jargon.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck (`tsc -b`) then production build |
| `npm run lint` | ESLint |
| `npm run preview` | Serve the production build |
| `npm run test:e2e` | Playwright end-to-end suite (starts its own dev server) |
| `npm run test:e2e:install` | Install the Chromium browser Playwright needs |

`?quality=low` renders a light version of the scene — fewer particles, no bloom, pixel
ratio 1. It exists because CI has no GPU: headless Chromium falls back to software
rendering where the full scene runs at ~2 fps, which is too slow for the end-to-end
suite. Constrained devices can also select it automatically; phones normally use mid.

## How it is put together

React 19 + TypeScript, three.js via react-three-fiber, Zustand for state, Tailwind +
Framer Motion for the interface. Local AI-generated density maps supply fine detail
for the stellar surface and layered river; shaders provide colour, motion and depth.
Procedural material fallbacks keep the scene usable if either image fails to load.
The two WebP maps total about 662 KB; the full concept images are not runtime
backgrounds, and the recorded entry still ships alongside them for slow loads and
draw failures.

```
src/
  components/Scene/   the 3D scene: stars, tail, stream, orbit, star field
  components/UI/      cinematic overlay, info cards, closing message, tonight save
  constants/          palette, physics, timings, translations, quality tiers
  lib/                pure seams, no rendering: star clock, river lighting,
                      pulsation lighting, viewer control, free view camera,
                      quality governor, quality budget, ambient graph, save flow
  shaders/            GLSL sources
  hooks/              store and device hooks
tests/e2e/            Playwright specs (behaviour, not pixels)
tests/unit/           pure-function specs (star clock, river lighting,
                      pulsation lighting, viewer control, free view camera,
                      quality governor, quality budget, save flow,
                      entry readiness)
docs/adr/             decisions worth not re-litigating
docs/archive/         Gen 1 material, kept for history only
```

## Deployment

Pushes to `master` deploy to Vercel automatically. GitHub Actions runs lint, build and
the Chromium end-to-end suite on every pull request and on every push to `master`.
See [ADR-0002](./docs/adr/0002-vercel-github-cicd-over-cloudbase.md) for why Vercel
rather than CloudBase.
