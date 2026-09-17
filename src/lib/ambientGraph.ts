// The ambient sound itself (#22, ADR-0004): original procedural synthesis, no
// audio files and no third-party material, so provenance is trivial.
//
// Quiet, dark, spacious; no melody, no beat:
//
//   noise bed    looped procedurally filtered noise -> distance-mapped lowpass
//                -> slow swell (LFO on gain) ---------------------------> master
//   low drone    two detuned sines ~54 Hz (a slow beating, not a rhythm)
//                -> slow drift (LFO on gain) ---------------------------> master
//   high air     one very quiet sine ~163 Hz with a slow swell ---------> master
//
//   master -> destination   (the shell owns fades, suspend/resume, and the
//   distance tone; see hooks/useAmbientSound)
//
// Five oscillators, one looping buffer, one filter: the CPU cost is trivial.
// Written against BaseAudioContext so the OfflineAudioContext render in
// experiments/render-ambient-sample.mjs builds the exact same graph.

import { distanceTone, type AmbientTone } from './ambientPreference';

export const AMBIENT_BASE_LEVEL = 0.16;

export interface AmbientGraph {
  master: GainNode;
  start: () => void;
  stop: () => void;
  setTone: (tone: AmbientTone) => void;
}

// Procedural "pink-ish" noise: white noise through a one-pole lowpass, generated
// sample by sample — no recorded material anywhere in the chain.
function makeNoiseBuffer(context: BaseAudioContext, seconds = 4): AudioBuffer {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let smoothed = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    smoothed += 0.03 * (white - smoothed);
    data[i] = smoothed * 3.2;
  }
  return buffer;
}

// A slow LFO driving an AudioParam around its base value (additive depth).
function swell(context: BaseAudioContext, param: AudioParam, hz: number, depth: number): OscillatorNode {
  const lfo = context.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = hz;
  const lfoGain = context.createGain();
  lfoGain.gain.value = depth;
  lfo.connect(lfoGain).connect(param);
  return lfo;
}

export function createAmbientGraph(context: BaseAudioContext): AmbientGraph {
  const master = context.createGain();
  master.gain.value = 0; // the shell fades in
  master.connect(context.destination);

  // Noise bed.
  const noise = context.createBufferSource();
  noise.buffer = makeNoiseBuffer(context);
  noise.loop = true;
  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.Q.value = 0.4;
  const noiseGain = context.createGain();
  noiseGain.gain.value = 0.5;
  const noiseLfo = swell(context, noiseGain.gain, 0.06, 0.18);
  noise.connect(lowpass).connect(noiseGain).connect(master);

  // Low drone: two sines slightly detuned so they beat over ~4 seconds.
  const droneGain = context.createGain();
  droneGain.gain.value = 0.5;
  const droneLfo = swell(context, droneGain.gain, 0.043, 0.14);
  droneGain.connect(master);
  const droneA = context.createOscillator();
  droneA.type = 'sine';
  droneA.frequency.value = 54;
  const droneB = context.createOscillator();
  droneB.type = 'sine';
  droneB.frequency.value = 54.27;
  const droneAGain = context.createGain();
  droneAGain.gain.value = 0.5;
  const droneBGain = context.createGain();
  droneBGain.gain.value = 0.5;
  droneA.connect(droneAGain).connect(droneGain);
  droneB.connect(droneBGain).connect(droneGain);

  // High air: a very quiet partial so the bed is not a single band.
  const airGain = context.createGain();
  airGain.gain.value = 0.05;
  const airLfo = swell(context, airGain.gain, 0.031, 0.03);
  airGain.connect(master);
  const air = context.createOscillator();
  air.type = 'sine';
  air.frequency.value = 162.5;
  air.connect(airGain);

  const sources = [noise, droneA, droneB, air, noiseLfo, droneLfo, airLfo];
  lowpass.frequency.value = distanceTone(0).cutoffHz;

  return {
    master,
    start() {
      const when = context.currentTime;
      for (const source of sources) source.start(when);
    },
    stop() {
      for (const source of sources) {
        try {
          source.stop();
        } catch {
          // Already stopped: stopping twice must never throw through the shell.
        }
        source.disconnect();
      }
      master.disconnect();
    },
    setTone(next: AmbientTone) {
      lowpass.frequency.value = next.cutoffHz;
    },
  };
}
