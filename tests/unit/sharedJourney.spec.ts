import { test, expect } from '@playwright/test';
import { PHYSICS } from '../../src/constants/physics';
import { JOURNEY, sharedJourney } from '../../src/lib/sharedJourney';
import { tailHeading } from '../../src/lib/tailPath';
import type { Vec3 } from '../../src/lib/tailPath';

// 共同前行 (the shared journey, #86): in free viewing the red giant carries the
// white dwarf slowly forward along the tail's heading. These pin the ticket's
// acceptance criteria as behaviour — monotonic forward travel (沿去向慢慢往前,
// never backward), the companion's lag at every phase (滞后), the red giant's
// answer (回应), the bounded ride that never leaves the framing, and the size
// gap that stays exactly as it was.
//
// The timeline is sampled from home to forty timescales — about four times the
// 99% arrival horizon — so every invariant is proven for the ride's whole life,
// not just the interval that happens to pass.

const HEADING = tailHeading(PHYSICS.TAIL.length);
// 40 × the shaping timescale: the ride stands within 0.1% of its final reach.
const HORIZON = 40 * JOURNEY.timescale;
const PHASES = Array.from({ length: HORIZON + 1 }, (_, i) => i);

function dot(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function length(a: Vec3) {
  return Math.hypot(a[0], a[1], a[2]);
}

function cross(a: Vec3, b: Vec3) {
  return Math.hypot(
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  );
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

// Positions along the heading: the giant and the dwarf as the caller composes
// them (journey base + own offset).
function giantAlong(phase: number) {
  const { base, primary } = sharedJourney(phase, HEADING);
  return dot(add(base, primary), HEADING);
}

function dwarfAlong(phase: number) {
  const { base, companion } = sharedJourney(phase, HEADING);
  return dot(add(base, companion), HEADING);
}

test.describe('the size gap (unchanged by this ticket)', () => {
  test('the red giant stays much larger than the white dwarf', () => {
    expect(PHYSICS.MIRA_A.radius).toBeGreaterThan(PHYSICS.MIRA_B.radius * 5);
  });
});

test.describe('the shared ride', () => {
  test('everything the journey offsets runs along the tail’s heading', () => {
    for (const phase of PHASES) {
      const { base, primary, companion } = sharedJourney(phase, HEADING);
      // Colinear with the heading (or exactly zero): no sideways slip, ever.
      expect(cross(base, HEADING)).toBeCloseTo(0, 9);
      expect(cross(primary, HEADING)).toBeCloseTo(0, 9);
      expect(cross(companion, HEADING)).toBeCloseTo(0, 9);
    }
  });

  test('monotonic forward: the offset along the heading never steps backward', () => {
    let previous = 0;
    for (const phase of PHASES) {
      const along = dot(sharedJourney(phase, HEADING).base, HEADING);
      expect(along).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = along;
    }
  });

  test('eases in from a standing start, then creeps slowly', () => {
    const along = (p: number) => dot(sharedJourney(p, HEADING).base, HEADING);
    // Ease-in: a mid-ride second covers several times what the first second does —
    // the ride leaves home gently instead of stepping.
    expect(along(1) - along(0)).toBeLessThan((along(JOURNEY.timescale) - along(JOURNEY.timescale - 1)) / 3);
    // 慢慢: the fastest the shared frame ever moves along the heading.
    let topSpeed = 0;
    for (let i = 1; i < PHASES.length; i += 1) {
      const step = along(PHASES[i]) - along(PHASES[i - 1]);
      if (step > topSpeed) topSpeed = step;
    }
    expect(topSpeed).toBeLessThan(0.15);
    expect(topSpeed).toBeGreaterThan(0.05);
  });

  test('bounded: the ride never leaves the framing, but does arrive', () => {
    for (const phase of PHASES) {
      const along = dot(sharedJourney(phase, HEADING).base, HEADING);
      expect(along).toBeLessThanOrEqual(JOURNEY.amplitude + 1e-9);
      expect(length(sharedJourney(phase, HEADING).base)).toBeLessThanOrEqual(JOURNEY.amplitude + 1e-9);
    }
    // Soft arrival: by the horizon the ride is within 1% of its forward reach.
    expect(dot(sharedJourney(HORIZON, HEADING).base, HEADING)).toBeGreaterThan(JOURNEY.amplitude * 0.99);
  });

  test('phase zero is a true home: the hand-off from the opening never snaps', () => {
    // (The pause contract is not a property of this pure function: the ride
    // freezes because its caller's clock freezes. advanceTime's hold behaviour —
    // paused, reduced motion, hidden tab — is pinned in
    // tests/unit/captureMode.spec.ts; the capture park is pinned by the
    // daily-sky e2e (two ?capture=1 visits, pixel-identical); the scene wiring
    // by the pause e2e.)
    // The full cinematic leaves the pair at the origin; free viewing must pick up
    // from exactly there — no offset on any of the three at phase zero.
    const { base, primary, companion } = sharedJourney(0, HEADING);
    expect(length(base)).toBe(0);
    expect(length(primary)).toBe(0);
    expect(length(companion)).toBe(0);
  });
});

test.describe('the companion’s lag (滞后)', () => {
  test('the white dwarf rides behind the red giant at every phase of the ride', () => {
    // The whole timeline, not the quarter that happens to pass: home, ease-in,
    // steady creep, arrival, and the long settled tail.
    expect(dwarfAlong(0)).toBeLessThanOrEqual(giantAlong(0) + 1e-12);
    for (let i = 1; i < PHASES.length; i += 1) {
      expect(dwarfAlong(PHASES[i])).toBeLessThan(giantAlong(PHASES[i]));
    }
  });

  test('the lag reads at the free-viewing distance, without reading numbers', () => {
    // The most the tow ever opens between the pair along the heading, as a share
    // of the ride's own reach: the bound is the intent (a visible fraction —
    // retuning JOURNEY must not trip a threshold pinned to today's numbers).
    const separations = PHASES.map((phase) => Math.abs(dwarfAlong(phase) - giantAlong(phase)));
    expect(Math.max(...separations)).toBeGreaterThan(JOURNEY.amplitude * 0.25);
  });

  test('the tow never pulls the pair apart: the dwarf stays within reach of the giant', () => {
    // Reduced motion parks the phase wherever it is; any held pose must still read
    // as companionship — the lag stays within about half the ride's reach against
    // the ~4.5-unit orbit, whatever the constants currently make it.
    for (const phase of PHASES) {
      const { primary, companion } = sharedJourney(phase, HEADING);
      const gap = length([companion[0] - primary[0], companion[1] - primary[1], companion[2] - primary[2]]);
      expect(gap).toBeLessThan(JOURNEY.amplitude * 0.55);
    }
  });
});

test.describe('the red giant’s answer (回应)', () => {
  test('it leans back toward the companion at every phase of the ride', () => {
    // The tow never inverts (the ride is monotonic), so the answer never points
    // forward: pulled ahead, the giant always gives back toward the dwarf.
    for (const phase of PHASES) {
      expect(dot(sharedJourney(phase, HEADING).primary, HEADING)).toBeLessThanOrEqual(1e-12);
    }
  });

  test('the answer reads at the free-viewing distance, without reading numbers', () => {
    // A visible share of the ride's reach, by intent — not today's constants.
    const gives = PHASES.map((phase) => Math.abs(dot(sharedJourney(phase, HEADING).primary, HEADING)));
    expect(Math.max(...gives)).toBeGreaterThan(JOURNEY.amplitude * 0.1);
    // …but it stays an answer, not a second orbit: much smaller than the ride.
    expect(Math.max(...gives)).toBeLessThan(JOURNEY.amplitude / 4);
  });
});
