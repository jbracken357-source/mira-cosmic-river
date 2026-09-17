// Re-capture the three fixed states: mobile final title, desktop epilogue, desktop toast+card.
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const BASE = 'http://127.0.0.1:5173';
const OUT = fileURLToPath(new URL('../docs/visual-qa/current-review/', import.meta.url));

const browser = await chromium.launch({ headless: true });

// 1. Desktop info card + toast spacing
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('mira:seen-opening', '1'));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="explore-ui"]');
  await page.click('[data-testid="tail-hint"]');
  await page.waitForSelector('[data-testid="info-card"]');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}13-desktop-toast-spacing-fixed.png` });
  await ctx.close();
}

// 2. Desktop epilogue with text shadow
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('mira:seen-opening', '1');
    const real = Date.now;
    let patched = false;
    Date.now = () => (patched ? real() + 61000 : real());
    window.__ageClock = () => { patched = true; };
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="explore-ui"]');
  await page.evaluate(() => window.__ageClock());
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `${OUT}14-desktop-epilogue-shadow.png` });
  await ctx.close();
}

// 3. Mobile cinematic final title with text shadow
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="cinematic-overlay"] h1', { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}15-mobile-cinematic-final-shadow.png` });
  await ctx.close();
}

await browser.close();
console.log('done');
