# Mira Cosmic River

An immersive 3D take on the Mira binary star system — a red giant and a white dwarf
orbiting each other 300 light-years away, dragging a comet-like tail 13 light-years
long behind them.

This is not a one-off showpiece. It is meant to be opened again and again: the sky
changes because it is tied to the real clock, not because new content was added.

- **Live**: https://mira-cosmic-river.vercel.app
- **Viewer**: the project owner, on desktop and phone
- **The one job of every screen**: make tonight's sky worth a second look

## What makes it worth returning to

**Real-time binding.** Mira A's brightness follows its real ~332-day pulsation period,
and the two stars sit at their real orbital phase for the current moment. Nothing is
fetched from the network — the position of the sky is computed deterministically from
the clock, so it is the same on every device and reproducible in tests.

**Direct entry.** The full 15-second opening plays on a first visit only. After that the
scene opens straight into the sky, with a very short title fade. The full opening stays
available as a deliberate choice — for showing someone, or just watching it again.

**The tail.** The 13-light-year ultraviolet wake is the emotional centre of the scene,
discovered by GALEX in 2007 and still the longest stellar tail ever observed.

Terminology (viewer, replayability, direct entry, ritual moment, real-time binding,
pulsation phase, the tail, epilogue) is defined in [CONTEXT.md](./CONTEXT.md). Please use
those words rather than code jargon.

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
suite. The suite uses it; normal visitors never see it.

## How it is put together

React 19 + TypeScript, three.js via react-three-fiber, Zustand for state, Tailwind +
Framer Motion for the interface. The star surfaces, accretion disk, material stream,
tail and star field are custom GLSL shaders.

```
src/
  components/Scene/   the 3D scene: stars, tail, stream, orbit, star field
  components/UI/      cinematic overlay, info cards, closing message
  constants/          palette, physics, timings, translations, quality tiers
  shaders/            GLSL sources
  hooks/              store and device hooks
tests/e2e/            Playwright specs (behaviour, not pixels)
docs/adr/             decisions worth not re-litigating
docs/archive/         Gen 1 material, kept for history only
```

## Deployment

Pushes to `master` deploy to Vercel automatically. GitHub Actions runs lint, build and
the Chromium end-to-end suite on every pull request and on every push to `master`.
See [ADR-0002](./docs/adr/0002-vercel-github-cicd-over-cloudbase.md) for why Vercel
rather than CloudBase.
