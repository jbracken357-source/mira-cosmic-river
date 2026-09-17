// Render ~15s of the ambient sound synthesis (#22) to a WAV, so the viewer can
// listen without opening the app (sound-aesthetics sign-off is ticket #30, not
// this one). The page builds the EXACT graph the app uses — src/lib/ambientGraph.ts
// imported through the vite dev server — inside an OfflineAudioContext, then the
// script encodes the rendered buffer as 16-bit PCM WAV.
//
//   node experiments/render-ambient-sample.mjs
//
// Output: docs/design-audit-2026-09-17/evidence/ambient-sample.wav
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { freePort, startDevServer } from './baseline-harness.mjs';

const SECONDS = 15;
const SAMPLE_RATE = 44100;
const OUT = path.join('docs', 'design-audit-2026-09-17', 'evidence', 'ambient-sample.wav');

// Minimal RIFF/WAVE encoder for a mono float buffer.
function encodeWav(samples, sampleRate) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 26);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buffer;
}

const port = await freePort();
const server = await startDevServer(port);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(server.baseUrl);
  // Render through the app's own module so the sample cannot drift from what ships.
  const samples = await page.evaluate(async ({ seconds, sampleRate }) => {
    const { AMBIENT_BASE_LEVEL, createAmbientGraph } = await import('/src/lib/ambientGraph.ts');
    const { distanceTone } = await import('/src/lib/ambientPreference.ts');
    const context = new OfflineAudioContext(1, seconds * sampleRate, sampleRate);
    const graph = createAmbientGraph(context);
    graph.start();
    // The explore framing distance (~30 units), faded in like the shell does.
    graph.setTone(distanceTone(30));
    graph.master.gain.setTargetAtTime(AMBIENT_BASE_LEVEL * distanceTone(30).gain, 0, 0.3);
    const rendered = await context.startRendering();
    return Array.from(rendered.getChannelData(0));
  }, { seconds: SECONDS, sampleRate: SAMPLE_RATE });

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, encodeWav(Float32Array.from(samples), SAMPLE_RATE));
  console.log(`wrote ${OUT} (${SECONDS}s, ${SAMPLE_RATE} Hz mono)`);
} finally {
  await browser.close();
  server.child.kill();
}
