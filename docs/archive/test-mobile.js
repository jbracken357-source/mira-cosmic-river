import { test, expect } from '@playwright/test';

test('Mobile LOD detection', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);
  
  // Check for mobile bottom sheet
  const mobileTrigger = page.locator('button:has-text("Settings"), div:has-text("Settings")').first();
  await expect(mobileTrigger).toBeVisible();
  
  console.log('Mobile detection: PASS');
});

test('Desktop LOD detection', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);
  
  // Check for desktop control panel
  const controlPanel = page.locator('.backdrop-blur-3xl').filter({ hasText: 'STAR SYSTEM' }).first();
  await expect(controlPanel).toBeVisible();
  
  console.log('Desktop detection: PASS');
});
