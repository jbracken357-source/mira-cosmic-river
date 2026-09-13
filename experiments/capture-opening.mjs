import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  const assets = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().includes('/materials/')) assets.push({ url: response.url(), status: response.status() }); });
  await page.addInitScript(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 4 });
  });
  await page.goto('http://127.0.0.1:5187/', { waitUntil: 'networkidle' });
  await page.getByTestId('skip-cinematic').waitFor();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'docs/visual-direction/evidence/opening-near.png' });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'docs/visual-direction/evidence/opening-pullback.png' });
  await page.getByTestId('explore-ui').waitFor({ timeout: 30000 });
  await page.screenshot({ path: 'docs/visual-direction/evidence/opening-far.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/visual-direction/evidence/production-portrait.png' });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/visual-direction/evidence/production-landscape.png' });
  const report = { errors, assets, horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) };
  await writeFile('docs/visual-direction/evidence/production-check.json', JSON.stringify(report, null, 2));
  if (errors.length || assets.length !== 2 || assets.some(asset => asset.status !== 200) || report.horizontalOverflow) throw new Error(JSON.stringify(report));
  console.log('PASS: production build loads both WebP assets, opening hands off to explore, portrait/landscape switch without JS errors or horizontal overflow.');
} finally {
  await browser.close();
}
