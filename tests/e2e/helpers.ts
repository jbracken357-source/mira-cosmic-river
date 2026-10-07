import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Shared e2e seams. Not a spec (helpers.ts matches no testMatch pattern).

// The pinned mid-decline date: no milestone window, so the lower edge (#88) always
// holds the closing line in specs that assert it (the same date integration-journey
// pins for the same reason).
export const MID_DECLINE_EPOCH = '2026-09-12T00%3A00%3A00Z';

// The dev-only idle overrides that compress the 30s/60s viewer-control rules into
// seconds (gated like ?epoch=; production ignores them). Same values as
// viewer-control.spec's SCALED set.
export const IDLE_FAST = '&idle-resume=1000&idle-ramp=800&idle-epilogue=4000&idle-lead=800';

// The tail's keyboard entry (#88): with the treasure-hunt hint gone from the lower
// edge, the scene itself and this sr-only trigger are the tail's doors.
export async function openTailCardViaKeyboard(page: Page) {
  const trigger = page.getByTestId('star-trigger-tail');
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('info-card')).toBeVisible();
}

// A star's keyboard entry, same gesture as the tail's.
export async function openStarCardViaKeyboard(page: Page, star: 'miraA' | 'miraB') {
  const trigger = page.getByTestId(`star-trigger-${star}`);
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('info-card')).toBeVisible();
}

// 第一次拖拽或缩放 (#90): a wheel-zoom on the canvas counts as scene manipulation —
// it graduates the quiet top bar (暂停 and 今晚的 Mira appear) and retires the
// gesture hint. Presses on UI controls never count, which is why the specs drive
// the canvas itself.
export async function manipulateScene(page: Page) {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 120);
}

// 镜头离开主视角 (#90): a real drag that carries the camera off the main view, so
// 「主视角」 appears. Starts from empty sky (upper right) so no click target opens
// a card on the way.
export async function dragOffMainView(page: Page) {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no box');
  const cx = box.x + box.width * 0.8;
  const cy = box.y + box.height * 0.25;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 160, cy + 40, { steps: 8 });
  await page.mouse.up();
}
