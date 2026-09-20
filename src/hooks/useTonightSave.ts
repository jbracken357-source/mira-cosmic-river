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
  fitTonightFontSize,
  formatTonightDate,
  initialTonightSaveState,
  tonightFilename,
  tonightPhrase,
  tonightTextLayout,
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
// The snapshot serial counter lives here (the machine is pure and receives it as an
// event payload): identity only ever moves forward, even across close/reopen.
let nextSnapshotSerial = 1;
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
  dispatch({ type: 'captured', serial: nextSnapshotSerial++ });
  void refreshPreview();
}

// Compose the snapshot plus the enabled overlays on an offscreen 2D canvas. Pure
// scene pixels in, PNG out; the live canvas is never touched.
async function compose(snap: TonightSnapshot, on: TonightOverlays): Promise<HTMLCanvasElement> {
  const image = await loadImage(snap.dataUrl);
  const size = fitExportSize(snap.width, snap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d canvas unavailable');
  ctx.drawImage(image, 0, 0, size.width, size.height);

  if (on.date || on.phrase) {
    const { margin } = tonightTextLayout(size);
    const fontOf = (fontSize: number) =>
      `300 ${fontSize}px Inter, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`;
    const lines: string[] = [];
    if (on.phrase) lines.push(tonightPhrase(snap.language));
    if (on.date) lines.push(formatTonightDate(snap.takenAt, snap.language));
    // Measured, never guessed: the pure policy (lib/tonightSave) shrinks until every
    // line provably fits inside the margins, in both languages.
    const fontSize = fitTonightFontSize(lines, size, (line, at) => {
      ctx.font = fontOf(at);
      return ctx.measureText(line).width;
    });
    const lineHeight = Math.round(fontSize * 1.5);
    ctx.font = fontOf(fontSize);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = Math.round(fontSize * 0.5);
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
  const serial = machine.snapshot;
  const snap = snapshot;
  if (serial === null || !snap) return;
  try {
    const canvas = await compose(snap, machine.overlays);
    // A decode can outlive the flow it started in: a close/reopen (or a fresh
    // capture) moves the serial, and a stale compose must never replace the preview
    // of the snapshot the viewer is actually looking at.
    if (machine.snapshot !== serial) return;
    useTonightSave.setState({ previewUrl: canvas.toDataURL('image/png') });
  } catch {
    // A failed preview compose is not a save failure: the raw frame still shows.
    if (machine.snapshot === serial) useTonightSave.setState({ previewUrl: snap.dataUrl });
  }
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('png encode failed'))), 'image/png');
  });
}

async function exportNow() {
  const snap = snapshot;
  if (!snap) return; // the machine only exports with a locked snapshot
  // Gesture discipline (mobile): exportNow is invoked synchronously from the press,
  // but the blob only exists after async compose — a window.open issued THEN can be
  // killed by Safari's popup blocker. So when the download-attribute path is
  // unavailable, the fallback window opens NOW (blank, inside the gesture) and is
  // navigated to the blob URL once ready. The download path itself stays as-is.
  const needsPopup = !('download' in document.createElement('a'));
  const popup = needsPopup ? window.open('about:blank', '_blank') : null;
  if (needsPopup && popup === null) {
    // The browser refused even the in-gesture window: fail honestly, retryable.
    dispatch('export-failed');
    return;
  }
  try {
    if (failNextExport) {
      failNextExport = false;
      throw new Error('injected export failure');
    }
    const canvas = await compose(snap, machine.overlays);
    // Closed mid-export: the machine already discarded; deliver nothing.
    if (machine.phase !== 'exporting') {
      popup?.close();
      return;
    }
    const blob = await toBlob(canvas);
    if (machine.phase !== 'exporting') {
      popup?.close();
      return;
    }
    deliver(blob, tonightFilename(snap.takenAt), popup);
    dispatch('exported');
  } catch {
    popup?.close();
    dispatch('export-failed');
  }
}

// Hand the viewer the file. The download attribute is the path every current
// browser (mobile included) supports. Where it is genuinely absent (old embedded
// WebViews) the caller has already opened a blank tab inside the press gesture, and
// this navigates it to the image so the system save/share sheet can take over; a
// tab the viewer closed in the meantime is an honest export failure, not a silent
// success. Either way the viewer leaves with the actual pixels, not a success toast.
function deliver(blob: Blob, filename: string, popup: Window | null) {
  const url = URL.createObjectURL(blob);
  if (popup) {
    if (popup.closed) {
      URL.revokeObjectURL(url);
      throw new Error('the viewer closed the preview tab before the file was ready');
    }
    popup.location.href = url;
  } else {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
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
