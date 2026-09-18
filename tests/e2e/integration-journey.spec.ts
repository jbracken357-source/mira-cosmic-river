import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// 全体验集成 (#29, ticket 11): one continuous journey through every capability in the
// order a returning viewer actually lives them — first visit plays the full cinematic,
// the reload enters directly, free exploration hands over instantly, an info card holds
// the idle takeover while it is read, ambient sound starts on its own toggle, tonight's
// frame saves from the live view, idle drift returns the camera and brings the epilogue,
// one keystroke interrupts it, and replaying the opening neither stacks audio nor breaks
// the landing. Each leg is covered in depth by its own suite; this test proves the legs
// compose — the seams between features are where integration breaks.
//
// Anti-flake for software-rendered CI: `?quality=low`, the dev-only cinematic/idle
// overrides compress the wall clock, every wait polls an observable attribute, and the
// pose attribute proves frames are really running before anything is asserted.

// Mid-decline date (no milestone window, so the milestone hint stays out of the frame);
// pinned so both navigations of the journey show the same night.
const EPOCH = '2026-09-12T00%3A00%3A00Z';
const JOURNEY =
  `/?quality=low&cinematic-scale=2&epoch=${EPOCH}` +
  '&idle-resume=1200&idle-ramp=600&idle-epilogue=4200&idle-lead=600';
// Explore framing on a landscape viewport (full-opening.spec keeps the same number).
const EXPLORE_POSE = '8.0,7.0,28.0';

async function firstFrame(page: Page) {
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });
}

async function skyAttributes(page: Page) {
  const root = page.locator('[data-sky-phase]');
  return {
    phase: await root.getAttribute('data-sky-phase'),
    brightness: await root.getAttribute('data-sky-brightness'),
    density: await root.getAttribute('data-sky-density'),
  };
}

async function ambientProbe(page: Page) {
  return page.evaluate(() => {
    const p = (window as unknown as { __miraAmbient?: {
      liveContexts(): number;
      contextState(): string;
    } }).__miraAmbient;
    return p ? { live: p.liveContexts(), state: p.contextState() } : { live: -1, state: 'none' };
  });
}

test.describe('Integration journey', () => {
  test.setTimeout(180000);

  test('first visit → direct entry → explore → card → sound → save → idle → epilogue → interrupt → replay', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const canvas = page.locator('canvas');

    // --- First visit: the full cinematic plays and lands on the explore framing. ---
    await page.addInitScript(() => localStorage.clear());
    await page.goto(JOURNEY);
    await expect(page.getByTestId('cinematic-overlay')).toBeVisible({ timeout: 30000 });
    await firstFrame(page);
    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 45000 });
    // The settle beat lands on the explore framing (the exact-value assertion is
    // full-opening.spec's, without idle overrides); here a small tolerance also admits
    // the fast idle drift that begins the moment the opening hands control back.
    await expect(async () => {
      const [x, y, z] = ((await canvas.getAttribute('data-camera-pose')) ?? '').split(',').map(Number);
      expect(Math.hypot(x - 8, y - 7, z - 28)).toBeLessThan(1);
    }).toPass({ timeout: 15000 });
    const firstNight = await skyAttributes(page);

    // --- Reload: direct entry, the same night, no opening to wait through. ---
    await page.reload();
    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('cinematic-overlay')).toHaveCount(0);
    await firstFrame(page);
    // The pinned date survives the reload: the sky the viewer returns to is tonight's.
    expect(await skyAttributes(page)).toEqual(firstNight);

    // --- Free exploration: a drag owns the camera immediately. ---
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.7, box!.y + box!.height * 0.4, { steps: 12 });
    await page.mouse.up();
    await expect(canvas).not.toHaveAttribute('data-camera-pose', EXPLORE_POSE, { timeout: 10000 });
    await expect(page.locator('[data-auto-camera]')).toHaveAttribute('data-auto-camera', 'off');
    // Load and drag time must not count toward idle: restamp before the next leg.
    await page.keyboard.press('Shift');

    // --- Info card: readable and closable; reading holds the idle takeover. ---
    // The star triggers are the keyboard entry (sr-only until focused, per #20).
    const starTrigger = page.getByTestId('star-trigger-miraA');
    await starTrigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('info-card')).toBeVisible();
    // Past every fast idle threshold (epilogue would land at 4.2s) the card still holds.
    await page.waitForTimeout(5500);
    await expect(page.locator('[data-auto-camera]')).toHaveAttribute('data-auto-camera', 'off');
    await expect(page.locator('[data-epilogue]')).toHaveAttribute('data-epilogue', 'false');
    await page.getByTestId('info-card-close').click();
    await expect(page.getByTestId('info-card')).toHaveCount(0);

    // --- Ambient sound: one toggle, really playing, preference remembered. ---
    await page.getByTestId('ambient-toggle').click();
    await expect(page.locator('[data-ambient-state]')).toHaveAttribute('data-ambient-state', 'playing', { timeout: 10000 });
    await expect(page.getByTestId('ambient-toggle')).toHaveAttribute('aria-pressed', 'true');
    let probe = await ambientProbe(page);
    expect(probe.state).toBe('running');
    expect(probe.live).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem('mira:ambient-sound'))).toBe('1');

    // --- Tonight's frame: locks at press time, camera holds, export is a real image. ---
    await page.getByTestId('tonight-save').click();
    const panel = page.getByTestId('tonight-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-tonight-phase', 'preview');
    await expect(page.getByTestId('tonight-preview')).toBeVisible({ timeout: 15000 });
    // Saving suppresses the idle takeover too — past the resume threshold it stays off.
    await page.waitForTimeout(2000);
    await expect(page.locator('[data-auto-camera]')).toHaveAttribute('data-auto-camera', 'off');
    // Overlay options re-compose the same locked snapshot, never a fresh capture.
    await page.getByTestId('tonight-toggle-date').click();
    await page.getByTestId('tonight-toggle-phrase').click();
    await expect(page.getByTestId('tonight-preview')).toBeVisible();
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.getByTestId('tonight-export').click();
    const download = await downloadPromise;
    expect(await download.suggestedFilename()).toMatch(/^mira-tonight-\d{4}-\d{2}-\d{2}\.png$/);
    const saved = path.join(tmpdir(), `mira-journey-${process.pid}.png`);
    await download.saveAs(saved);
    const bytes = await readFile(saved);
    // PNG magic + non-trivial payload: the file decodes as a real image.
    expect(bytes.length).toBeGreaterThan(10_000);
    expect(bytes.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    await page.getByTestId('tonight-close').click();
    await expect(panel).toHaveCount(0);

    // --- Idle: the slow camera returns, then the epilogue arrives on top of it. ---
    await expect(page.locator('[data-auto-camera]')).toHaveAttribute('data-auto-camera', 'on', { timeout: 15000 });
    await expect(page.locator('[data-epilogue]')).toHaveAttribute('data-epilogue', 'true', { timeout: 15000 });
    await expect(page.getByTestId('epilogue-text')).toBeVisible();

    // --- Interrupt: one keystroke ends the epilogue and takes the camera back. ---
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-epilogue]')).toHaveAttribute('data-epilogue', 'false', { timeout: 5000 });
    await expect(page.locator('[data-auto-camera]')).toHaveAttribute('data-auto-camera', 'off', { timeout: 5000 });

    // --- Replay: the full opening again, audio never stacks, landing unchanged. ---
    await page.getByTestId('replay-opening').click();
    await expect(page.getByTestId('cinematic-overlay')).toBeVisible({ timeout: 10000 });
    probe = await ambientProbe(page);
    expect(probe.live).toBe(1);
    expect(probe.state).toBe('running');
    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 45000 });
    // The fast idle drift may already own the camera after the hand-back; returning to
    // the main view is the explicit way back and eases onto the framing.
    await page.getByTestId('return-to-view').click();
    await expect(async () => {
      const [x, y, z] = ((await canvas.getAttribute('data-camera-pose')) ?? '').split(',').map(Number);
      expect(Math.hypot(x - 8, y - 7, z - 28)).toBeLessThan(1);
    }).toPass({ timeout: 15000 });

    // The whole journey ran without a single page error.
    expect(errors).toEqual([]);
  });
});
