// The recorded still behind the loading veil and the static fallback (#24).
//
// Provenance is part of the contract (TICKETS.md, ticket 08): a static image
// that stands in for the scene must record which scene version it came from,
// and must never be passed off as newer art. Ticket 11 (#29) re-made this
// still from the 01/02 art (see public/materials/entry-still-v1.SOURCE.txt for
// the commit, epoch, and capture command). `version` is what the UI stamps
// into data-still-source.
import type { CSSProperties } from 'react';
import { COLORS } from './colors';

export const ENTRY_STILL = {
  src: 'materials/entry-still-v1.jpg',
  version: 'entry-still-v1',
  sourceEpoch: '2026-09-12T00:00:00Z',
  capturedOn: '2026-09-18',
  sourceSceneCommit: 'd601df1',
} as const;

// The one backdrop for every place the still holds the screen — the loading
// veil and the static fallback share it, so the two never drift apart.
// import.meta.env exists only under Vite; the guard keeps the constants barrel
// importable from plain Node (the unit runner), matching lib/captureMode.ts.
const BASE_URL = typeof import.meta.env === 'undefined' ? '/' : import.meta.env.BASE_URL;

export const ENTRY_STILL_BACKDROP: CSSProperties = {
  background: COLORS.DEEP_SPACE,
  backgroundImage: `url(${BASE_URL}${ENTRY_STILL.src})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
};
