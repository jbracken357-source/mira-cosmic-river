# Archive

Everything here is Gen 1 material, kept for history and no longer maintained. It does
not describe how the product works today — read `CONTEXT.md`, `docs/adr/`, and the
open issues instead.

Archived 2026-09-12 with the repositioning recorded in
[ADR-0001](../adr/0001-reposition-from-gift-to-daily-companion.md): the product moved
from "a one-off gift" to "a living sky you come back to daily". The documents below are
written from the gift framing and their plans (three visual modes, parameter sliders,
a 15-second intro on every visit) were explicitly rejected by that decision.

| Item | What it was |
|---|---|
| `PROJECT_MIRA.md` | Original product brief ("romantic gift, also a portfolio piece") |
| `product-direction.md` | The GAN-pivot brief that reframed it as a love letter; source of the palette and anti-slop directives that survived |
| `spec.md`, `eval-rubric.md`, `generator-state.md` | The GAN design loop: design gaps, scoring rubric, and iteration log up to v8 |
| `VISUAL_DESIGN.md` | Gen 1 visual specification |
| `IMPLEMENTATION_PLAN.md`, `SESSION_COMPLETE.md`, `FINAL_REPORT.md` | Gen 1 build plans and wrap-up reports |
| `REMAINING.md` | Gen 1's open polish list. Its still-live items were absorbed into the current tickets (visual quality → #4, interaction → #5, phase legibility → #6) |
| `capture.js`, `test-mobile.js` | Ad-hoc screenshot and mobile probe scripts, superseded by the Playwright suite |
| `screenshots/` | Root-level iteration screenshots (v1–v6) from the visual tuning sessions |

Some of Gen 1's *decisions* still hold and are therefore not archived: the colour
palette, the typography roles, the single-experience stance (no modes, no sliders), and
the non-negotiable "the tail is the emotional core". Those live on in the code and in
the current tickets.
