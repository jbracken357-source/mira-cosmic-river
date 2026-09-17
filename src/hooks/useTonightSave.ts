// 今晚的 Mira (#23) shell: owns the one snapshot, applies the pure machine's
// effects (lib/tonightSave), and does the only DOM/canvas work of the feature —
// composing the offscreen 2D export and handing the file to the browser.
//
// Snapshot timing: the machine emits 'capture' synchronously inside the viewer's
// press, and this shell runs it in the same task — a forced render followed
// immediately by the read. The renderer keeps preserveDrawingBuffer off, so a read
// in any later task could return a blank frame; reading in the press's own task is
// what makes the snapshot honest (and keeps the permanent cost at zero).
//
// No stacking, by construction: one module-level machine, one snapshot slot, and
// the machine only honours 'open' from idle and 'export' from preview/success.

import { create } from 'zustand';
import {
  fitExportSize,
  formatTonightDate,
  initialTonightSaveState,
  tonightFilename,
  tonightPhrase,
  transition,
} from '../lib/tonightSave';
import type {
  TonightOverlays,
  TonightSaveEffect,
  TonightSaveEvent,
  TonightSaveFailure,
  TonightSavePhase,
  TonightSaveState,
} from '../lib/tonightSave';
import type { Language } from '../constants/translations';
import { useBinaryStar } from './useBinaryStar';

// The locked frame: pixels as pressed (backing resolution), plus the save moment's
// date and language — a snapshot outlives later language switches and clock ticks.
export interface TonightSnapshot {
  dataUrl: string;
  width: number;
  height: number;
  takenAt: Date;
  language: Language;
}

export type TonightFrameResult =
  | { dataUrl: string; width: number; height: number }
  | 'context-lost'
  | null;

// Imperative bridge into the Canvas (the ambientSpace pattern from #22): Scene
// fills this once mounted, the save flow reads it in the press's own task. Null
// until the scene is up.
export const tonightFrame: { capture: (() => TonightFrameResult) | null } = { capture: null };

interface TonightSaveStore {
  phase: TonightSavePhase;
  failure: TonightSaveFailure | null;
  overlays: TonightOverlays;
  previewUrl: string | null;
  capturedAt: Date | null;
  open: () => void;
  close: () => void;
  toggleDate: () => void;
  togglePhrase: () => void;
  save: () => void;
  retry: () => void;
}

let machine: TonightSaveState = initialTonightSaveState();
let snapshot: TonightSnapshot | null = null;
// Dev-only e2e seam (same gate as ?epoch=): forces the next compose to fail so the
// failure/retry path is reachable on demand.
let failNextExport = false;

export const useTonightSave = create<TonightSaveStore>(() => ({
  phase: machine.phase,
  failure: null,
  overlays: machine.overlays,
  previewUrl: null,
  capturedAt: null,
  open: () => dispatch('open'),
  close: () => dispatch('close'),
  toggleDate: () => dispatch('toggle-date'),
  togglePhrase: () => dispatch('toggle-phrase'),
  save: () => dispatch('export'),
  retry: () => dispatch('retry'),
}));

function publish(previewUrl: string | null) {
  useTonightSave.setState({
    phase: machine.phase,
    failure: machine.failure,
    overlays: machine.overlays,
    previewUrl,
    capturedAt: snapshot?.takenAt ?? null,
  });
  // The saving hold (#21's documented extension point): while the flow is open the
  // idle takeover stays off, so the locked frame is never reframed behind the panel.
  useBinaryStar.getState().setTonightSaveOpen(machine.phase !== 'idle');
}

function dispatch(event: TonightSaveEvent) {
  const { state, effects } = transition(machine, event);
  machine = state;
  for (const effect of effects) applyEffect(effect);
  publish(useTonightSave.getState().previewUrl);
}

function applyEffect(effect: TonightSaveEffect) {
  switch (effect.type) {
    case 'capture':
      captureNow();
      break;
    case 'export':
      void exportNow();
      break;
    case 'discard':
      snapshot = null;
      useTonightSave.setState({ previewUrl: null, capturedAt: null });
      break;
  }
}

// Runs synchronously inside the press: force one real render (post-processing
// included, via R3F's advance) and read the canvas in the same task.
function captureNow() {
  const grab = tonightFrame.capture ? tonightFrame.capture() : null;
  if (grab === 'context-lost') {
    dispatch('context-lost');
    return;
  }
  if (!grab) {
    dispatch('capture-failed');
    return;
  }
  snapshot = {
    ...grab,
    takenAt: new Date(),
    language: useBinaryStar.getState().language,
  };
  dispatch('captured');
  void refreshPreview();
}

// Compose the snapshot plus the enabled overlays on an offscreen 2D canvas. Pure
// scene pixels in, PNG out; the live canvas is never touched.
async function compose(on: TonightOverlays): Promise<HTMLCanvasElement> {
  if (!snapshot) throw new Error('no snapshot to compose');
  const image = await loadImage(snapshot.dataUrl);
  const size = fitExportSize(snapshot.width, snapshot.height);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d canvas unavailable');
  ctx.drawImage(image, 0, 0, size.width, size.height);

  if (on.date || on.phrase) {
    const minEdge = Math.min(size.width, size.height);
    const margin = Math.max(12, Math.round(minEdge * 0.045));
    const fontSize = Math.max(14, Math.round(minEdge * 0.032));
    const lineHeight = Math.round(fontSize * 1.5);
    ctx.font = `300 ${fontSize}px Inter, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = Math.round(fontSize * 0.5);
    const lines: string[] = [];
    if (on.phrase) lines.push(tonightPhrase(snapshot.language));
    if (on.date) lines.push(formatTonightDate(snapshot.takenAt, snapshot.language));
    lines.forEach((line, index) => {
      ctx.fillText(line, margin, size.height - margin - (lines.length - 1 - index) * lineHeight);
    });
  }
  return canvas;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('snapshot decode failed'));
    image.src = src;
  });
}

async function refreshPreview() {
  try {
    const canvas = await compose(machine.overlays);
    // The flow may have closed (or re-captured) while the image decoded; only a
    // preview that still belongs to the live snapshot may be shown.
    if (machine.snapshot === null || !snapshot) return;
    useTonightSave.setState({ previewUrl: canvas.toDataURL('image/png') });
  } catch {
    // A failed preview compose is not a save failure: the raw frame still shows.
    if (snapshot) useTonightSave.setState({ previewUrl: snapshot.dataUrl });
  }
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('png encode failed'))), 'image/png');
  });
}

async function exportNow() {
  try {
    if (failNextExport) {
      failNextExport = false;
      throw new Error('injected export failure');
    }
    const canvas = await compose(machine.overlays);
    // Closed mid-export: the machine already discarded; deliver nothing.
    if (machine.phase !== 'exporting') return;
    const blob = await toBlob(canvas);
    if (machine.phase !== 'exporting') return;
    deliver(blob, tonightFilename(snapshot!.takenAt));
    dispatch('exported');
  } catch {
    dispatch('export-failed');
  }
}

// Hand the viewer the file. The download attribute is the path every current
// browser (mobile included) supports; where it is genuinely absent (old embedded
// WebViews) the image opens in a new tab so the system save/share sheet can take
// over — either way the viewer leaves with the actual pixels, not a success toast.
function deliver(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  if ('download' in anchor) {
    anchor.download = filename;
    anchor.click();
  } else {
    window.open(url, '_blank');
  }
  // The blob must outlive the navigation/download hand-off; release it later.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Overlay toggles re-compose the same snapshot.
useTonightSave.subscribe((state, previous) => {
  if (state.overlays !== previous.overlays && state.phase !== 'idle' && snapshot) {
    void refreshPreview();
  }
});

// Dev-only e2e seam (same gate as ?epoch= and __miraAmbient): proves the retry
// reuses the same snapshot bytes and lets a spec force an export failure.
if (typeof window !== 'undefined' && !import.meta.env.PROD) {
  (window as unknown as Record<string, unknown>).__miraTonight = {
    failNextExport: () => {
      failNextExport = true;
    },
    snapshotDataUrl: () => snapshot?.dataUrl ?? null,
    phase: () => machine.phase,
  };
}
