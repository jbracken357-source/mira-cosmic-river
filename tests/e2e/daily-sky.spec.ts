import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  MIRA_MAXIMUM_EPOCH_MS,
  MIRA_PERIOD_DAYS,
  MIRA_RISE_DAYS,
} from '../../src/lib/starClock';

const DAY_MS = 86_400_000;

// Capture parks the fades, but a slow software upload can still be mid-mipmap when a
// fixed pause ends. The second visit then hits the browser cache and lands on the map
// while the first visit is still the procedural star, so the two canvases disagree.
async function waitForMappedStars(page: Page) {
  const deadline = Date.now() + 20_000;
  let ready = false;
  while (Date.now() < deadline) {
    ready = await page.evaluate(async () => {
      const r3f = await import('/node_modules/.vite/deps/@react-three_fiber.js');
      const canvas = document.querySelector('canvas');
      const root = canvas ? r3f._roots.get(canvas) : undefined;
      if (!root) return false;
      let companion = false;
      let giant = false;
      root.store.getState().scene.traverse((obj: { material?: { uniforms?: Record<string, { value?: unknown }> } }) => {
        const uniforms = obj.material?.uniforms;
        if (!uniforms?.uSurfaceReady || uniforms.uSurfaceReady.value !== 1 || !uniforms.uSurfaceMap?.value) return;
        if (uniforms.intensity) companion = true;
        if (uniforms.uColorCore) giant = true;
      });
      return companion && giant;
    });
    if (ready) return;
    await page.waitForTimeout(200);
  }
  expect(ready).toBe(true);
}

async function settledCanvas(page: Page) {
  // The readiness uniform flips in useFrame, and that frame's draw is what puts
  // the uploaded map on the canvas. Read past that present, then accept the shot
  // once two reads agree.
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  const canvas = page.locator('canvas');
  let previous = await canvas.screenshot({ animations: 'disabled' });
  for (let i = 0; i < 8; i += 1) {
    await page.waitForTimeout(200);
    const next = await canvas.screenshot({ animations: 'disabled' });
    if (next.equals(previous)) return next;
    previous = next;
  }
  return previous;
}
const MINIMUM_EPOCH_MS =
  MIRA_MAXIMUM_EPOCH_MS + (MIRA_PERIOD_DAYS - MIRA_RISE_DAYS) * DAY_MS;

// `?capture=1` freezes every time-driven uniform and the camera (dev-only capture mode),
// `?quality=low` keeps software rendering cheap, and `?epoch=` pins the star clock to the
// night under test — together they make one date fully reproducible across visits.
async function visitSky(page: Page, epochMs: number, capture: boolean) {
  await page.goto(
    `/?quality=low&epoch=${Math.round(epochMs / 1000)}${capture ? '&capture=1' : ''}`,
  );
  const root = page.locator('[data-sky-brightness]');
  await expect(root).toBeVisible({ timeout: 20000 });
  await expect(page.locator('canvas')).toBeVisible();
  return {
    phase: Number(await root.getAttribute('data-sky-phase')),
    brightness: Number(await root.getAttribute('data-sky-brightness')),
    density: Number(await root.getAttribute('data-sky-density')),
  };
}

test.describe('Daily sky', () => {
  test('the same night is reproducible down to the canvas pixels', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('mira:seen-opening', '1');
    });
    const visit = async () => {
      // Registered before the navigation so the texture loads cannot race past.
      const materials = Promise.all([
        page.waitForResponse((r) => r.url().endsWith('/materials/river-density-v1.webp')),
        page.waitForResponse((r) => r.url().endsWith('/materials/surface-density-v2.webp')),
        page.waitForResponse((r) => r.url().endsWith('/materials/companion-surface-density-v1.webp')),
      ]);
      // A mid-cycle date: no milestone window, so the hint overlay never enters the frame.
      const sky = await visitSky(page, Date.UTC(2026, 8, 12), true);
      await materials;
      await page.getByTestId('explore-ui').waitFor({ timeout: 30000 });
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await waitForMappedStars(page);
      return { sky, shot: await settledCanvas(page) };
    };

    const first = await visit();
    const second = await visit();

    expect(second.sky).toEqual(first.sky);
    expect(second.shot.equals(first.shot)).toBe(true);
  });

  test('a distant date changes the river within bounds', async ({ page }) => {
    const atMaximum = await visitSky(page, MIRA_MAXIMUM_EPOCH_MS, false);
    const atMinimum = await visitSky(page, MINIMUM_EPOCH_MS, false);

    // A faint Mira lets the river settle denser; a bright one spreads it thinner.
    expect(atMinimum.density).toBeGreaterThan(atMaximum.density);
    // A modulation, not a different river: the swing stays within ±10% and near 1.
    expect(atMinimum.density - atMaximum.density).toBeLessThan(0.1);
    expect(atMaximum.density).toBeGreaterThan(0.9);
    expect(atMinimum.density).toBeLessThan(1.1);
  });

  test('returning to the foreground re-reads the star clock', async ({ page }) => {
    const root = page.locator('[data-sky-brightness]');
    await visitSky(page, MIRA_MAXIMUM_EPOCH_MS, false);
    await expect(root).toHaveAttribute('data-sky-brightness', '1.0000');

    // Move the dev-only clock pin to another night, then fire the return-to-foreground
    // signal the app listens to. ?epoch= is re-read on every clock access, so this is
    // exactly "the wall clock moved on while the tab was away".
    await page.evaluate((epochSeconds) => {
      history.replaceState(null, '', `/?quality=low&epoch=${epochSeconds}`);
      document.dispatchEvent(new Event('visibilitychange'));
    }, Math.round(MINIMUM_EPOCH_MS / 1000));

    await expect(root).toHaveAttribute('data-sky-brightness', '0.0000');
  });
});
