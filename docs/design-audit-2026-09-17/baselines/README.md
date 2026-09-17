# Screenshot baselines

Reproducible captures of the main scene for before/after comparison (ticket 01).

## How it works

The app's dev-only capture mode (`src/lib/captureMode.ts`) freezes everything that would
otherwise vary between runs:

- **Date** — `?epoch=2026-09-12T00:00:00Z` pins the star clock (dev-only, like the
  existing epoch pinning). Capture mode implies this epoch when `?epoch=` is absent.
- **Random seeds** — already fixed in code: StarField `mulberry32(0x5eed1a)`, the tail
  LCG seed 17, MaterialStream's index hash.
- **Camera** — `?cam=default|near|az90|az180|az270` is re-applied every frame;
  auto-rotate and damping are off, mouse influence is zeroed.
- **Animation phase** — every time-driven uniform (`uTime`, twinkle phases, stream flow,
  the decorative orbit) is parked at `CAPTURE_TIME = 8` seconds.
- **Quality tier** — the harness pins `navigator.deviceMemory`/`hardwareConcurrency` to 8,
  which resolves to the `high` tier; viewport 1440×900 at deviceScaleFactor 1.
- **DOM overlay** — the harness injects CSS disabling animations/transitions.

Capture mode is gated by `import.meta.env.PROD`; production builds are unaffected, and
with the params absent the app behaves exactly as before.

## Commands

```sh
node experiments/capture-baseline.mjs <label>   # write baselines/<label>/ (own dev server)
node experiments/verify-baseline.mjs            # capture twice, assert pixel equality
```

`verify-baseline.mjs` exits non-zero unless two back-to-back captures are pixel-identical
(max per-pixel channel diff 0). Run it after any change that could affect rendering.

## View set

`default`, `near` (近景), `az90`, `az180`, `az270`, `portrait` (390×844),
`reduced-motion`. Each set carries a `manifest.json` with epoch, seeds, resolved camera
poses, viewport, dpr, quality tier and the git commit it was captured at.

- `before/` — the current visuals, captured when the harness was introduced (no visual
  changes yet).
