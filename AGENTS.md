# Mira Cosmic River

## Done

- Run `npm run lint`, `npm run build` and `npm run test:unit`. All exit 0.
- For scene or UI changes, also run the e2e specs that cover the change: `npx playwright test --project=chromium <spec>`. CI runs the full e2e suite on the PR (about 7 minutes). Merge only when CI is green.
- Run one e2e process per machine at a time, and do not raise `--workers`. One run uses about 1.4 GB of memory. A second run fails at once on the busy port 5175. Parallel load also makes the timing tests fail.

## Rules

- Use the `CONTEXT.md` vocabulary in UI copy, identifiers, tests, and docs.
- Do not reopen decisions in `docs/adr/` (e.g. ADR-0002: Vercel + GitHub Actions; CloudBase deferred).
- Follow `docs/visual-direction/SPEC.md` for visual work.
