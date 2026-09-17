import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Resilient entry (#24, ticket 08): fault injection around the entry path.
//
//   - hung/404 materials must never hold the full cinematic forever (bounded
//     wait, then the procedural fallback path opens the gate);
//   - WebGL unavailable and context lost/restored get the static recorded
//     still + honest copy + retry, never an interactive-posing placeholder;
//   - return visits add no waiting ceremony;
//   - recovery re-registers nothing: one click stays one card, one ambient
//     graph stays one graph.
//
// "Non-empty画面" is asserted by decoding the screenshot and checking the
// luminance is neither flat nor black — never by the mere presence of a canvas.

const APP = '/?quality=low';
const STILL_VERSION = 'entry-still-v1';

const wrapper = (page: Page) => page.locator('[data-entry-gate]');

async function screenshotStats(page: Page): Promise<{ mean: number; stddev: number }> {
  const shot = await page.screenshot();
  return page.evaluate(async (b64) => {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('screenshot decode failed'));
      img.src = `data:image/png;base64,${b64}`;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let sum = 0;
    let sumSq = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      sum += l;
      sumSq += l * l;
    }
    const mean = sum / n;
    return { mean, stddev: Math.sqrt(sumSq / n - mean * mean) };
  }, shot.toString('base64'));
}

function hangMaterials(page: Page) {
  // The request is accepted and never answered — the slow-network case.
  return page.route('**/materials/*.webp', () => new Promise(() => {}));
}

function blockWebGL(page: Page) {
  return page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return original.call(this, type, ...args);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
}

test.describe('Resilient entry', () => {
  test('a healthy first visit opens the gate on the materials path', async ({ page }) => {
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    // Materials load normally: the gate settles on 'materials' and only then
    // does the full cinematic begin.
    await expect(wrapper(page)).toHaveAttribute('data-entry-gate', 'materials', { timeout: 15000 });
    await expect(page.getByTestId('cinematic-overlay')).toBeVisible({ timeout: 15000 });
  });

  test('hung material loads time out into the fallback instead of waiting forever', async ({ page }) => {
    await hangMaterials(page);
    await page.goto(APP, { waitUntil: 'domcontentloaded' });

    // While the materials hang, the opening must not start: the recorded still
    // holds the screen and names its source scene version.
    const loading = page.getByTestId('loading');
    await expect(loading).toBeVisible();
    await expect(loading).toHaveAttribute('data-still-source', STILL_VERSION);
    await expect(wrapper(page)).toHaveAttribute('data-entry-gate', 'waiting');
    await expect(page.getByTestId('cinematic-overlay')).toHaveCount(0);

    // The bound is MATERIALS_TIMEOUT_MS (5s); give it generous room, then the
    // gate must have settled on the fallback path and the opening begun.
    await expect(wrapper(page)).toHaveAttribute('data-entry-gate', 'fallback', { timeout: 15000 });
    await expect(page.getByTestId('cinematic-overlay')).toBeVisible({ timeout: 15000 });

    // The fallback path is a real画面: end the opening and the procedural
    // scene is visibly non-empty.
    await page.getByTestId('skip-cinematic').click();
    await expect(page.getByTestId('explore-ui')).toBeVisible();
    await page.waitForTimeout(500);
    const stats = await screenshotStats(page);
    expect(stats.mean).toBeGreaterThan(1);
    expect(stats.stddev).toBeGreaterThan(1);
  });

  test('missing materials (404) settle the gate promptly on the fallback path', async ({ page }) => {
    await page.route('**/materials/*.webp', (route) => route.fulfill({ status: 404, body: '' }));
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await expect(wrapper(page)).toHaveAttribute('data-entry-gate', 'fallback', { timeout: 15000 });
    await expect(page.getByTestId('cinematic-overlay')).toBeVisible({ timeout: 15000 });
  });

  test('a return visit adds no waiting ceremony even while materials hang', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('mira:seen-opening', '1'));
    await hangMaterials(page);
    await page.goto(APP, { waitUntil: 'domcontentloaded' });

    // Direct entry: explore is up before the gate's timeout can even fire —
    // the gate never blocks a return visit.
    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 4000 });
    await expect(page.getByTestId('loading')).toHaveCount(0);
    await expect(page.getByTestId('cinematic-overlay')).toHaveCount(0);
  });

  test('WebGL unavailable gets an honest static fallback with a working retry', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('mira:seen-opening', '1'));
    await blockWebGL(page);
    await page.goto(APP, { waitUntil: 'domcontentloaded' });

    const fallback = page.getByTestId('scene-fallback');
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveAttribute('data-fallback-reason', 'webgl-unavailable');
    await expect(fallback).toHaveAttribute('data-still-source', STILL_VERSION);
    await expect(fallback).toContainText(/暂时进不去|can’t open right now/);

    // It never poses as explorable: no canvas, no explore UI, no star targets.
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.getByTestId('explore-ui')).toHaveCount(0);
    await expect(page.getByTestId('tail-hint')).toHaveCount(0);

    // The recorded still is a real image, not a black panel.
    const stats = await screenshotStats(page);
    expect(stats.mean).toBeGreaterThan(1);
    expect(stats.stddev).toBeGreaterThan(1);

    // Retry is a real reload (the injected block re-applies, so the fallback
    // honestly returns — the recovery path itself is exercised by the
    // context-lost test below).
    await page.evaluate(() => {
      (window as unknown as Record<string, boolean>).__preRetry = true;
    });
    await page.getByTestId('scene-fallback-retry').click();
    await page.waitForFunction(() => (window as unknown as Record<string, boolean>).__preRetry !== true);
    await expect(fallback).toBeVisible();
  });

  test('context lost shows the still; restore re-enters without doubling anything', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      localStorage.setItem('mira:seen-opening', '1');
      localStorage.removeItem('mira:ambient-sound');
    });
    await page.goto(APP);
    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });
    const canvas = page.locator('canvas');
    await expect(canvas).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });

    // Ambient sound on, so recovery can prove it does not stack a second graph.
    await page.getByTestId('ambient-toggle').click();
    await expect(wrapper(page)).toHaveAttribute('data-ambient-state', 'playing');

    // Really lose the GPU context (the same extension the browser uses).
    const hasLoseContext = await page.evaluate(() => {
      const el = document.querySelector('canvas');
      if (!el) return false;
      const gl = el.getContext('webgl2') ?? el.getContext('webgl');
      const ext = gl?.getExtension('WEBGL_lose_context') ?? null;
      (window as unknown as Record<string, unknown>).__miraLoseContext = ext;
      if (!ext) return false;
      ext.loseContext();
      return true;
    });
    test.skip(!hasLoseContext, 'WEBGL_lose_context is not available in this renderer');

    const fallback = page.getByTestId('scene-fallback');
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveAttribute('data-fallback-reason', 'context-lost');
    await expect(fallback).toHaveAttribute('data-still-source', STILL_VERSION);
    // While lost the still is the画面 — decoded pixels, not a canvas tag.
    const lostStats = await screenshotStats(page);
    expect(lostStats.mean).toBeGreaterThan(1);
    expect(lostStats.stddev).toBeGreaterThan(1);

    // Restore: the live scene comes back on its own — no reload, no remount.
    await page.evaluate(() => {
      ((window as unknown as Record<string, { restoreContext(): void }>).__miraLoseContext).restoreContext();
    });
    await expect(fallback).toHaveCount(0);
    await expect(page.getByTestId('explore-ui')).toBeVisible();

    // Interactions work after restore and are not double-registered:
    // one press of the tail hint opens exactly one card.
    await page.getByTestId('tail-hint').click();
    await expect(page.getByTestId('info-card')).toBeVisible();
    expect(await page.getByTestId('info-card').count()).toBe(1);
    await page.getByTestId('info-card').getByRole('button').click();
    await expect(page.getByTestId('info-card')).toBeHidden();

    // The camera still answers a drag (input listeners alive, exactly once:
    // the pose moves with the drag instead of jumping twice).
    const before = await canvas.getAttribute('data-camera-pose');
    const box = await canvas.boundingBox();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 120, cy + 40, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => canvas.getAttribute('data-camera-pose')).not.toBe(before);

    // The ambient graph survived whole: still one live context, still playing.
    const ambient = await page.evaluate(() => {
      const p = (window as unknown as Record<string, { liveContexts(): number; contextState(): string }>).__miraAmbient;
      return { live: p.liveContexts(), state: p.contextState() };
    });
    expect(ambient.live).toBe(1);
    expect(ambient.state).toBe('running');
    await expect(wrapper(page)).toHaveAttribute('data-ambient-state', 'playing');
  });
});
