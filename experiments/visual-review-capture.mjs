// Visual review capture: screenshots of every UI state at desktop + mobile viewports.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = 'http://127.0.0.1:5173';
const OUT = fileURLToPath(new URL('../docs/visual-qa/current-review/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const errors = [];

async function capture(page, name) {
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log('captured', name);
}

function watch(page, tag) {
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${tag}] console.${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[${tag}] pageerror: ${e.message}`));
}

const browser = await chromium.launch({ headless: true });

// ---------- Desktop 1440x900, first visit (full cinematic) ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  watch(page, 'desktop');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await capture(page, '01-desktop-cinematic-caption');
  await page.waitForSelector('[data-testid="cinematic-overlay"] h1', { timeout: 30000 });
  await page.waitForTimeout(1200);
  await capture(page, '02-desktop-cinematic-final');
  // The intro completes on its own right after the final text; skip may already be gone.
  const skip = page.locator('[data-testid="skip-cinematic"]');
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await page.waitForSelector('[data-testid="explore-ui"]', { timeout: 30000 });
  await page.waitForTimeout(2500);
  await capture(page, '03-desktop-explore');

  // Tail info card via the footer hint
  await page.click('[data-testid="tail-hint"]');
  await page.waitForSelector('[data-testid="info-card"]');
  await page.waitForTimeout(800);
  await capture(page, '04-desktop-info-tail');
  await page.click('[data-testid="info-card"] button');
  await page.waitForTimeout(600);

  // Try clicking Mira A (red giant) — sweep a few points near center
  let opened = null;
  outer: for (const [fx, fy] of [[0.5, 0.5], [0.45, 0.5], [0.55, 0.5], [0.5, 0.45], [0.5, 0.55], [0.4, 0.5], [0.6, 0.5], [0.42, 0.55], [0.58, 0.45]]) {
    await page.mouse.click(1440 * fx, 900 * fy);
    await page.waitForTimeout(700);
    opened = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="info-card"] h3');
      return card ? card.textContent : null;
    });
    if (opened) break outer;
  }
  if (opened) {
    console.log('star card opened:', opened);
    await capture(page, '05-desktop-info-star');
    await page.click('[data-testid="info-card"] button');
    await page.waitForTimeout(600);
  } else {
    console.log('no star card opened by center clicks');
  }

  // English explore view
  await page.click('[data-testid="explore-ui"] header button:last-child');
  await page.waitForTimeout(1200);
  await capture(page, '06-desktop-explore-en');
  await ctx.close();
}

// ---------- Mobile 390x844, direct entry (seen opening) ----------
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  watch(page, 'mobile');
  await page.addInitScript(() => localStorage.setItem('mira:seen-opening', '1'));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="explore-ui"]');
  await page.waitForTimeout(2500);
  await capture(page, '07-mobile-explore');

  await page.tap('[data-testid="tail-hint"]');
  await page.waitForSelector('[data-testid="info-card"]');
  await page.waitForTimeout(800);
  await capture(page, '08-mobile-info-tail');
  await ctx.close();
}

// ---------- Mobile, first visit cinematic ----------
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  watch(page, 'mobile-cinematic');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await capture(page, '09-mobile-cinematic-caption');
  await page.waitForSelector('[data-testid="cinematic-overlay"] h1', { timeout: 30000 });
  await page.waitForTimeout(1200);
  await capture(page, '10-mobile-cinematic-final');
  await ctx.close();
}

await browser.close();

console.log('\n--- console/page errors ---');
console.log(errors.length ? errors.join('\n') : '(none)');
