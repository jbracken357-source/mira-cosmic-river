// The recorded still behind the loading veil and the static fallback (#24).
//
// Provenance is part of the contract (TICKETS.md, ticket 08): a static image
// that stands in for the scene must record which scene version it came from,
// and must never be passed off as newer art. This still was captured from the
// pre-01/02 scene (see public/materials/entry-still-v1.SOURCE.txt for the
// commit, epoch, and capture command); ticket 11 (#29) re-makes it once the
// new art lands. `version` is what the UI stamps into data-still-source.
export const ENTRY_STILL = {
  src: 'materials/entry-still-v1.jpg',
  version: 'entry-still-v1',
  sourceEpoch: '2026-09-12T00:00:00Z',
  capturedOn: '2026-09-17',
  sourceSceneCommit: '9273c7c',
} as const;
