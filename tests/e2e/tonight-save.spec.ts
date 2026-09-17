import { test, expect } from '@playwright/test';
import type { Download, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// 今晚的 Mira (#23) end-to-end: the save entry locks the current frame at press
// time, the camera holds while the flow is open, export yields a real decodable
// PNG, failure retries the same snapshot, and a lost WebGL context is reported
// honestly. Software WebGL (?quality=low) keeps these runnable anywhere.

interface DecodedPng {
  width: number;
  height: number;
  mean: number;
  stripMean: number;
}

async function directEntry(page: Page, query = '') {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('mira:seen-opening', '1');
  });
  await page.goto(`/?quality=low${query}`);
  await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });
  const canvas = page.locator('canvas');
  // Frames are really running once the pose attribute lands (see phase-readout).
  await expect(canvas).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });
  return canvas;
}

async function openSaveFlow(page: Page) {
  await page.getByTestId('tonight-save').click();
  const panel = page.getByTestId('tonight-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-tonight-phase', 'preview');
  await expect(page.getByTestId('tonight-preview')).toBeVisible({ timeout: 15000 });
  return panel;
}

async function saveDownload(download: Download): Promise<string> {
  const file = path.join(tmpdir(), `mira-e2e-${process.pid}-${Date.now()}.png`);
  await download.saveAs(file);
  return file;
}

// Decode the PNG in-page (createImageBitmap) and measure it: dimensions, mean
// luminance (black-frame guard), and the bottom-left strip where overlay text lands.
async function decodePng(page: Page, file: string): Promise<DecodedPng> {
  const base64 = (await readFile(file)).toString('base64');
  return page.evaluate(async (data) => {
    const blob = await (await fetch(`data:image/png;base64,${data}`)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const lum = (i: number) => 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    let sum = 0;
    for (let i = 0; i < pixels.length; i += 4) sum += lum(i);
    let stripSum = 0;
    let stripCount = 0;
    const stripTop = Math.floor(canvas.height * 0.85);
    const stripRight = Math.floor(canvas.width * 0.5);
    for (let y = stripTop; y < canvas.height; y += 1) {
      for (let x = 0; x < stripRight; x += 1) {
        stripSum += lum((y * canvas.width + x) * 4);
        stripCount += 1;
      }
    }
    return {
      width: bitmap.width,
      height: bitmap.height,
      mean: sum / (pixels.length / 4),
      stripMean: stripSum / stripCount,
    };
  }, base64);
}

async function exportAndDecode(page: Page): Promise<{ decoded: DecodedPng; download: Download }> {
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  await page.getByTestId('tonight-export').click();
  const download = await downloadPromise;
  const decoded = await decodePng(page, await saveDownload(download));
  return { decoded, download };
}

test.describe('Tonight\'s Mira save flow', () => {
  test.setTimeout(120000);

  test('pressing the entry locks the frame and holds the camera while open', async ({ page }) => {
    // Fast idle thresholds (dev override) so the auto camera would resume within a
    // second if the saving hold were not wired.
    const canvas = await directEntry(page, '&idle-resume=600&idle-ramp=500&idle-epilogue=120000&idle-lead=8000');
    await expect(page.locator('[data-auto-camera]')).toHaveAttribute('data-auto-camera', 'on', { timeout: 30000 });

    const panel = await openSaveFlow(page);
    const preview = page.getByTestId('tonight-preview');
    const lockedSrc = await preview.getAttribute('src');
    expect(lockedSrc).toBeTruthy();

    // The saving hold suppresses the idle takeover even with the fast thresholds.
    await expect(page.locator('[data-auto-camera]')).toHaveAttribute('data-auto-camera', 'off');
    await page.waitForTimeout(2000);
    await expect(page.locator('[data-auto-camera]')).toHaveAttribute('data-auto-camera', 'off');

    // A subsequent drag moves the live camera but must never reframe the snapshot.
    const poseBefore = await canvas.getAttribute('data-camera-pose');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height * 0.3;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 140, cy + 40, { steps: 6 });
    await page.mouse.up();
    await expect
      .poll(async () => canvas.getAttribute('data-camera-pose'), { timeout: 15000 })
      .not.toBe(poseBefore);
    expect(await preview.getAttribute('src')).toBe(lockedSrc);
    await expect(panel).toBeVisible();
  });

  test('export delivers a decodable, aspect-true, non-black PNG without UI text', async ({ page }) => {
    const canvas = await directEntry(page);
    await openSaveFlow(page);

    const backing = await canvas.evaluate((el: HTMLCanvasElement) => ({ width: el.width, height: el.height }));
    const { decoded, download } = await exportAndDecode(page);

    expect(download.suggestedFilename()).toMatch(/^mira-tonight-\d{4}-\d{2}-\d{2}\.png$/);
    // Under the 2560 cap and never upscaled: this viewport exports at backing size.
    expect(Math.max(decoded.width, decoded.height)).toBeLessThanOrEqual(2560);
    expect(decoded).toMatchObject({ width: backing.width, height: backing.height });
    // Not a black frame.
    expect(decoded.mean).toBeGreaterThan(0);

    // Overlay options compose onto the SAME snapshot: enable both and export again
    // (the machine allows re-export from success). Same scene pixels, text added —
    // the bottom-left strip must get brighter, and only then.
    await page.getByTestId('tonight-toggle-date').click();
    await page.getByTestId('tonight-toggle-phrase').click();
    const withText = await exportAndDecode(page);
    expect(withText.decoded).toMatchObject({ width: decoded.width, height: decoded.height });
    expect(withText.decoded.stripMean).toBeGreaterThan(decoded.stripMean);
  });

  test('date and phrase compose in both languages and the file still decodes', async ({ page }) => {
    await directEntry(page);
    // zh (the default language)
    await openSaveFlow(page);
    await page.getByTestId('tonight-toggle-date').click();
    await page.getByTestId('tonight-toggle-phrase').click();
    const zh = await exportAndDecode(page);
    expect(zh.decoded.mean).toBeGreaterThan(0);
    await page.getByTestId('tonight-close').click();
    await expect(page.getByTestId('tonight-panel')).toHaveCount(0);

    // en: closing discarded the first snapshot; reopening captures a fresh one.
    await page.locator('button:has-text("EN")').first().click();
    await openSaveFlow(page);
    await page.getByTestId('tonight-toggle-date').click();
    await page.getByTestId('tonight-toggle-phrase').click();
    const en = await exportAndDecode(page);
    expect(en.decoded.mean).toBeGreaterThan(0);
    expect(en.decoded).toMatchObject({ width: zh.decoded.width, height: zh.decoded.height });
  });

  test('rapid repeated presses during export never stack a second download', async ({ page }) => {
    await directEntry(page);
    await openSaveFlow(page);

    const downloads: Download[] = [];
    page.on('download', (download) => void downloads.push(download));
    const exportButton = page.getByTestId('tonight-export');
    await exportButton.click();
    await exportButton.click({ force: true }).catch(() => undefined);
    await exportButton.click({ force: true }).catch(() => undefined);

    await expect(page.getByTestId('tonight-panel')).toHaveAttribute('data-tonight-phase', 'success', { timeout: 30000 });
    // Give any stacked task time to surface before counting.
    await page.waitForTimeout(2500);
    expect(downloads).toHaveLength(1);
  });

  test('an export failure keeps the viewing state and retries the SAME snapshot', async ({ page }) => {
    await directEntry(page);
    await openSaveFlow(page);

    const snapshotBefore = await page.evaluate(
      () => (window as unknown as { __miraTonight: { snapshotDataUrl(): string | null } }).__miraTonight.snapshotDataUrl(),
    );
    expect(snapshotBefore).toBeTruthy();

    await page.evaluate(
      () => (window as unknown as { __miraTonight: { failNextExport(): void } }).__miraTonight.failNextExport(),
    );
    await page.getByTestId('tonight-export').click();
    await expect(page.getByTestId('tonight-panel')).toHaveAttribute('data-tonight-phase', 'failed');
    await expect(page.getByTestId('tonight-failure')).toBeVisible();
    // The scene behind the panel is untouched: still exploring, camera not hijacked.
    await expect(page.getByTestId('explore-ui')).toBeVisible();

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.getByTestId('tonight-export').click(); // retry
    await downloadPromise;
    await expect(page.getByTestId('tonight-panel')).toHaveAttribute('data-tonight-phase', 'success');

    const snapshotAfter = await page.evaluate(
      () => (window as unknown as { __miraTonight: { snapshotDataUrl(): string | null } }).__miraTonight.snapshotDataUrl(),
    );
    expect(snapshotAfter).toBe(snapshotBefore);
  });

  test('a lost WebGL context is reported honestly, never faked as a capture', async ({ page }) => {
    await directEntry(page);
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const gl = (canvas?.getContext('webgl2') ?? canvas?.getContext('webgl')) as
        | (WebGLRenderingContext & { getExtension(name: 'WEBGL_lose_context'): { loseContext(): void; restoreContext(): void } | null })
        | null;
      const ext = gl?.getExtension('WEBGL_lose_context') ?? null;
      (window as unknown as Record<string, unknown>).__miraLoseContext = ext;
      ext?.loseContext();
    });

    // Since #24 the loss is answered by the full-screen recorded still: the
    // viewer is told the scene went dark, and the save flow cannot start over
    // a lost scene — no panel, no preview posing as a live capture.
    const fallback = page.getByTestId('scene-fallback');
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveAttribute('data-fallback-reason', 'context-lost');
    await expect(page.getByTestId('tonight-panel')).toHaveCount(0);
    await expect(page.getByTestId('tonight-preview')).toHaveCount(0);

    // After the context restores, the fallback lifts and the same save flow
    // works on the recovered scene — the loss was a pause, not a broken page.
    await page.evaluate(() => {
      (window as unknown as Record<string, { restoreContext(): void }>).__miraLoseContext.restoreContext();
    });
    await expect(fallback).toHaveCount(0);
    await openSaveFlow(page);
  });
});
