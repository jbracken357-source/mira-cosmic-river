import { test, expect } from '@playwright/test';
import { PHYSICS } from '../../src/constants/physics';
import { JOURNEY, sharedJourney } from '../../src/lib/sharedJourney';
import { tailHeading } from '../../src/lib/tailPath';
import type { Vec3 } from '../../src/lib/tailPath';

// 共同前行 (the shared journey, #86): in free viewing the red giant carries the
// white dwarf slowly forward along the tail's heading. These pin the ticket's
// acceptance criteria as behaviour — the companion's lag (滞后), the red giant's
// answer (回应), the bounded ride that never leaves the framing, and the size
// gap that stays exactly as it was.

const HEADING = tailHeading(PHYSICS.TAIL.length);

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

// Sample one full sway of the ride.
const PHASES = Array.from({ length: 281 }, (_, i) => (i * JOURNEY.period) / 280);

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

  test('the ride is slow and bounded: it journeys, but never leaves the framing', () => {
    // 慢慢往前: the fastest the shared frame ever moves along the heading.
    const topSpeed = (JOURNEY.amplitude * 2 * Math.PI) / JOURNEY.period;
    expect(topSpeed).toBeLessThan(0.15);
    expect(topSpeed).toBeGreaterThan(0.05);

    for (const phase of PHASES) {
      const { base } = sharedJourney(phase, HEADING);
      expect(length(base)).toBeLessThanOrEqual(JOURNEY.amplitude + 1e-9);
    }
    // And it does travel: the reach is a visible share of the framing.
    const reach = Math.max(...PHASES.map((phase) => dot(sharedJourney(phase, HEADING).base, HEADING)));
    expect(reach).toBeCloseTo(JOURNEY.amplitude, 9);
  });

  test('a held phase holds exactly the same pose (pause parks, resume continues)', () => {
    // The phase is the caller's scene clock: freezing it must freeze the ride to
    // the last value, bit for bit, so a resume picks up the held phase.
    for (const phase of [0, 7.5, JOURNEY.period / 3, JOURNEY.period * 0.9]) {
      expect(sharedJourney(phase, HEADING)).toEqual(sharedJourney(phase, HEADING));
    }
  });

  test('phase zero is a true home: the hand-off from the opening never snaps', () => {
    // The full cinematic leaves the pair at the origin; free viewing must pick up
    // from exactly there — no offset on any of the three at phase zero.
    const { base, primary, companion } = sharedJourney(0, HEADING);
    expect(length(base)).toBe(0);
    expect(length(primary)).toBe(0);
    expect(length(companion)).toBe(0);
  });
});

test.describe('the companion’s lag (滞后)', () => {
  test('the white dwarf rides behind the red giant whenever the ride moves forward', () => {
    // The ride moves forward over the first quarter of the sway; sampling densely,
    // the companion must sit behind the red giant along the heading the whole time.
    for (let phase = 0; phase <= JOURNEY.period / 4; phase += 0.5) {
      const { base, primary, companion } = sharedJourney(phase, HEADING);
      const giant = add(base, primary);
      const dwarf = add(base, companion);
      expect(dot(dwarf, HEADING)).toBeLessThan(dot(giant, HEADING) + 1e-12);
    }
  });

  test('the lag reads at the free-viewing distance, without reading numbers', () => {
    // The most the tow ever opens between the pair along the heading. At the
    // explore distance (~29 units) a shift this size is a visible share of the
    // frame — the follower reads as towed, not parked.
    const separations = PHASES.map((phase) => {
      const { base, primary, companion } = sharedJourney(phase, HEADING);
      return Math.abs(dot(add(base, companion), HEADING) - dot(add(base, primary), HEADING));
    });
    expect(Math.max(...separations)).toBeGreaterThan(0.8);
  });

  test('the tow never pulls the pair apart: the dwarf stays within reach of the giant', () => {
    // Reduced motion parks the phase wherever it is; any held pose must still read
    // as companionship — the lag adds less than a unit against the ~4.5-unit orbit.
    for (const phase of PHASES) {
      const { primary, companion } = sharedJourney(phase, HEADING);
      const gap = length([companion[0] - primary[0], companion[1] - primary[1], companion[2] - primary[2]]);
      expect(gap).toBeLessThan(1.2);
    }
  });
});

test.describe('the red giant’s answer (回应)', () => {
  test('it leans back toward the companion whenever the tow opens a gap', () => {
    for (const phase of PHASES) {
      const { base, primary, companion } = sharedJourney(phase, HEADING);
      const gap = dot(base, HEADING) - dot(add(base, companion), HEADING);
      // The answer opposes the gap: pulled ahead, the giant gives back.
      expect(dot(primary, HEADING) * gap).toBeLessThanOrEqual(1e-12);
    }
  });

  test('the answer reads at the free-viewing distance, without reading numbers', () => {
    const gives = PHASES.map((phase) => Math.abs(dot(sharedJourney(phase, HEADING).primary, HEADING)));
    expect(Math.max(...gives)).toBeGreaterThan(0.2);
    // …but it stays an answer, not a second orbit: much smaller than the ride.
    expect(Math.max(...gives)).toBeLessThan(JOURNEY.amplitude / 4);
  });
});
