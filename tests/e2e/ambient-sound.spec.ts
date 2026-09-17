import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Ambient sound (#22, ADR-0004): default silent, honest states, gesture-gated
// autoplay, single graph, failure with retry, background suspend/resume.
//
// Seams: the dev-only data-ambient-state attribute on the app wrapper (same
// pattern as data-sky-*) and the dev-only window.__miraAmbient probe
// (contextsCreated / liveContexts / contextState), so specs observe UI state and
// the real AudioContext instead of reaching into internals.

interface AmbientProbe {
  created: number;
  live: number;
  state: string;
}

async function gotoExplore(page: Page, preference: 'on' | 'off' = 'off') {
  await page.addInitScript((pref) => {
    localStorage.setItem('mira:seen-opening', '1');
    localStorage.removeItem('mira:found-tail');
    if (pref === 'on') localStorage.setItem('mira:ambient-sound', '1');
    else localStorage.removeItem('mira:ambient-sound');
  }, preference);
  await page.goto('/?quality=low');
  await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('loading')).toHaveCount(0);
  // The pose attribute lands at the end of the first completed frame: the scene
  // is really running before any sound assertion is made.
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });
}

const wrapper = (page: Page) => page.locator('[data-sky-phase]');
const toggle = (page: Page) => page.getByTestId('ambient-toggle');

async function probe(page: Page): Promise<AmbientProbe> {
  return page.evaluate(() => {
    const p = (window as unknown as Record<string, never>).__miraAmbient as {
      contextsCreated: () => number;
      liveContexts: () => number;
      contextState: () => string;
    };
    return { created: p.contextsCreated(), live: p.liveContexts(), state: p.contextState() };
  });
}

test.describe('Ambient sound', () => {
  test('is silent by default and creates no audio context', async ({ page }) => {
    await gotoExplore(page);
    await expect(wrapper(page)).toHaveAttribute('data-ambient-state', 'off');
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
    expect((await probe(page)).created).toBe(0);
    expect((await probe(page)).state).toBe('none');
  });

  test('toggle on really plays; toggle off releases the context', async ({ page }) => {
    await gotoExplore(page);

    await toggle(page).click();
    await expect(wrapper(page)).toHaveAttribute('data-ambient-state', 'playing');
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
    expect((await probe(page)).state).toBe('running');
    expect((await probe(page)).live).toBe(1);

    await toggle(page).click();
    await expect(wrapper(page)).toHaveAttribute('data-ambient-state', 'off');
    // The context is released on explicit off, not merely muted.
    await expect.poll(() => probe(page).then((p) => p.state), { timeout: 5000 }).toBe('none');
    expect((await probe(page)).live).toBe(0);
  });

  test('a remembered preference waits for the next gesture and says so', async ({ page }) => {
    await gotoExplore(page, 'on');

    // Honest pending: no context, no playing claim, a visible tap-to-start affordance.
    await expect(wrapper(page)).toHaveAttribute('data-ambient-state', 'pending-gesture');
    await expect(toggle(page)).toContainText(/点按开启|Tap to start/);
    expect((await probe(page)).created).toBe(0);

    // Any real gesture — here a click on the scene itself — starts the sound.
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    await page.mouse.click(box!.x + box!.width - 8, box!.y + box!.height - 8);
    await expect(wrapper(page)).toHaveAttribute('data-ambient-state', 'playing');
    expect((await probe(page)).state).toBe('running');
  });

  test('a denied resume lands in failed with retry, and the scene never breaks', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('mira:seen-opening', '1');
      localStorage.removeItem('mira:ambient-sound');
      const Native = window.AudioContext;
      window.AudioContext = class extends Native {
        resume() {
          if ((window as unknown as Record<string, boolean>).__miraFailResume) {
            return Promise.reject(new DOMException('denied', 'NotAllowedError'));
          }
          return super.resume();
        }
      };
    });
    await page.goto('/?quality=low');
    await expect(page.getByTestId('explore-ui')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('canvas')).toHaveAttribute('data-camera-pose', /.+/, { timeout: 30000 });

    await page.evaluate(() => {
      (window as unknown as Record<string, boolean>).__miraFailResume = true;
    });
    await toggle(page).click();
    await expect(wrapper(page)).toHaveAttribute('data-ambient-state', 'failed');
    await expect(toggle(page)).toContainText(/重试|Retry/);
    // Visuals never blocked: the frame loop is still writing poses.
    const pose = await page.locator('canvas').getAttribute('data-camera-pose');
    expect(pose).toBeTruthy();

    // Retry is a real entry: lift the denial and the same button recovers.
    await page.evaluate(() => {
      (window as unknown as Record<string, boolean>).__miraFailResume = false;
    });
    await toggle(page).click();
    await expect(wrapper(page)).toHaveAttribute('data-ambient-state', 'playing');
    expect((await probe(page)).state).toBe('running');
  });

  test('rapid retoggles never stack a second live context', async ({ page }) => {
    await gotoExplore(page);

    const button = toggle(page);
    for (let i = 0; i < 5; i++) await button.click();
    // Odd count: ends enabled. The invariant is one live context at most.
    await expect(wrapper(page)).toHaveAttribute('data-ambient-state', 'playing');
    expect((await probe(page)).live).toBeLessThanOrEqual(1);
    expect((await probe(page)).live).toBe(1);

    // Replaying the full cinematic must not disturb or duplicate the graph.
    await page.getByTestId('replay-opening').click();
    await expect(page.getByTestId('explore-ui')).toHaveCount(0);
    expect((await probe(page)).live).toBe(1);
    await expect(wrapper(page)).toHaveAttribute('data-ambient-state', 'playing');
  });

  test('background suspends playback; the foreground resumes it without catch-up', async ({ page }) => {
    await gotoExplore(page);
    await toggle(page).click();
    await expect(wrapper(page)).toHaveAttribute('data-ambient-state', 'playing');

    // Headless pages cannot really hide; override the visibility getters and fire
    // the event the shell listens to.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
      Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    // Fade (~0.8s) then suspend.
    await expect.poll(() => probe(page).then((p) => p.state), { timeout: 8000 }).toBe('suspended');

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
      Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => probe(page).then((p) => p.state), { timeout: 8000 }).toBe('running');
    await expect(wrapper(page)).toHaveAttribute('data-ambient-state', 'playing');
  });

  test('the toggle is reachable during the full cinematic and stays gesture-gated', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('mira:seen-opening');
      localStorage.removeItem('mira:ambient-sound');
    });
    await page.goto('/?quality=low');
    await expect(page.getByTestId('cinematic-overlay')).toBeVisible({ timeout: 15000 });

    await expect(toggle(page)).toBeVisible();
    await expect(wrapper(page)).toHaveAttribute('data-ambient-state', 'off');
    await toggle(page).click();
    await expect(wrapper(page)).toHaveAttribute('data-ambient-state', 'playing');
    // The opening keeps running underneath.
    await expect(page.getByTestId('cinematic-overlay')).toBeVisible();
  });

  test('keyboard operation and accessible name in both languages', async ({ page }) => {
    await gotoExplore(page);

    const zhToggle = page.getByRole('button', { name: '环境音' });
    await expect(zhToggle).toBeVisible();
    await zhToggle.focus();
    await page.keyboard.press('Enter');
    await expect(wrapper(page)).toHaveAttribute('data-ambient-state', 'playing');

    // Language switch keeps the name meaningful (and pressed truthful).
    await page.locator('button:has-text("EN")').first().click();
    await expect(page.getByRole('button', { name: 'Ambient sound' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('the toggle keeps a 44px target on a phone-sized viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoExplore(page);

    const box = await toggle(page).boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await toggle(page).click();
    await expect(wrapper(page)).toHaveAttribute('data-ambient-state', 'playing');
  });
});
