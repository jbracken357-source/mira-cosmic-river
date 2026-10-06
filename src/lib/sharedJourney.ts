// 共同前行 (the shared journey, #86): in free viewing the red giant carries the
// white dwarf slowly forward along the tail's heading (tailHeading in
// lib/tailPath). The white dwarf rides the same path a few seconds behind (滞后);
// the red giant gives back a share of that tow gap (回应), so at the free-viewing
// distance the pair reads as drawn to each other, travelling together — not
// orbiting in place.
//
// The ride is a long, bounded sway along the heading rather than a one-way
// departure: the pair visibly journeys, but never leaves the explore framing or
// detaches from the tail they stream. The phase is the caller's scene clock
// (advanceTime), so a pause holds the pose, a resume continues from the held
// phase, reduced motion parks the pair in a readable companionship pose, and
// capture mode pins the ride at the same settled phase as every other clock.
import type { Vec3 } from './tailPath';

export const JOURNEY = {
  period: 140,    // scene-clock seconds for one full sway of the shared ride
  amplitude: 2.5, // units of forward reach along the heading
  lagSeconds: 10, // how far behind the white dwarf rides the same path
  response: 0.22, // the share of the tow gap the red giant gives back
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

export function sharedJourney(
  phase: number,
  heading: Vec3,
  config: typeof JOURNEY = JOURNEY,
): SharedJourney {
  const travel = (p: number) => config.amplitude * Math.sin((p * 2 * Math.PI) / config.period);
  const ahead = travel(phase);
  // The white dwarf rides the same path lagSeconds behind — and before the ride
  // has run that long it simply waits at home. Phase zero is therefore a true
  // home for all three offsets: the moment the opening hands over to free
  // viewing, the pair stands exactly where the cinematic left it, and the
  // journey's first seconds are the giant gently pulling away.
  const behind = travel(Math.max(0, phase - config.lagSeconds));
  // The red giant's answer: it leans back toward its companion by a share of the
  // gap the tow has opened, so its own ride visibly gives where the white dwarf
  // holds back.
  const give = config.response * (ahead - behind);
  return {
    base: scaled(heading, ahead),
    primary: scaled(heading, -give),
    companion: scaled(heading, behind - ahead),
  };
}
