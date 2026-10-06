// 共同前行 (the shared journey, #86): in free viewing the red giant carries the
// white dwarf slowly forward along the tail's heading (tailHeading in
// lib/tailPath). The ride is monotonic: it eases in from a standing start,
// creeps at a slow steady pace, and arrives asymptotically at its forward
// reach — 沿去向慢慢往前, never backward, never out of the framing. The white
// dwarf rides the same path a few seconds behind (滞后); a lag applied to a
// monotonic path stays behind at every phase, so the giant always leads. The
// red giant gives back a share of that tow gap (回应), so at the free-viewing
// distance the pair reads as drawn to each other, travelling together — not
// orbiting in place.
//
// The phase is the caller's scene clock (advanceTime), so a pause holds the
// pose, a resume continues from the held phase, reduced motion parks the pair
// in a readable companionship pose, and capture mode pins the ride at the same
// settled phase as every other clock.
import type { Vec3 } from './tailPath';

export const JOURNEY = {
  amplitude: 2.5,   // units of forward reach along the heading (asymptotic)
  timescale: 15,    // scene-clock seconds shaping the ease-in and the arrival
  lagSeconds: 12,   // how far behind the white dwarf rides the same path
  response: 0.3,    // the share of the tow gap the red giant gives back
} as const;

export interface SharedJourney {
  // The shared ride: the home frame of both stars, the tail, the haze, and the
  // click targets — everything that belongs to the journey translates by this.
  base: Vec3;
  // The red giant's own answer to the tow, relative to base.
  primary: Vec3;
  // The white dwarf's lag, relative to base; its visible orbit is the caller's
  // to add on top.
  companion: Vec3;
}

function scaled(v: Vec3, k: number): Vec3 {
  return [v[0] * k, v[1] * k, v[2] * k];
}

// The forward ride: p²/(p²+τ²) climbs monotonically from a standing start (zero
// speed at phase zero) toward an asymptotic arrival at the amplitude. Velocity
// along the heading is never negative, and the framing survives any session.
function travel(p: number): number {
  const t = Math.max(0, p);
  return (JOURNEY.amplitude * t * t) / (t * t + JOURNEY.timescale * JOURNEY.timescale);
}

export function sharedJourney(phase: number, heading: Vec3): SharedJourney {
  const ahead = travel(phase);
  // The white dwarf rides the same path lagSeconds behind — and before the ride
  // has run that long it simply waits at home. Phase zero is therefore a true
  // home for all three offsets: the moment the opening hands over to free
  // viewing, the pair stands exactly where the cinematic left it, and the
  // journey's first seconds are the giant gently pulling away.
  const behind = travel(phase - JOURNEY.lagSeconds);
  // The red giant's answer: it leans back toward its companion by a share of
  // the gap the tow has opened, so its own ride visibly gives where the white
  // dwarf holds back.
  const give = JOURNEY.response * (ahead - behind);
  return {
    base: scaled(heading, ahead),
    primary: scaled(heading, -give),
    companion: scaled(heading, behind - ahead),
  };
}
