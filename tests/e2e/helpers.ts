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
