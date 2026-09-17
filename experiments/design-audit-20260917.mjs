import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'docs/design-audit-2026-09-17';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];
try {
  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce', isMobile: name === 'mobile', hasTouch: name === 'mobile' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('mira:seen-opening', '1'));
    await page.goto('http://127.0.0.1:5189/?epoch=2026-09-17', { waitUntil: 'networkidle' });
    await page.getByTestId('explore-ui').waitFor();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/${name}.png` });
    const resources = await page.evaluate(async () => {
      const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js');
      const s = _roots.get(document.querySelector('canvas')).store.getState();
      const gl = s.gl.getContext();
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return { renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), layers: s.scene.getObjectByName('river-veil').children.length, dpr: s.gl.getPixelRatio(), overflow: document.documentElement.scrollWidth > innerWidth,
        buttons: [...document.querySelectorAll('button')].map(b => ({ text:b.textContent, width:b.getBoundingClientRect().width, height:b.getBoundingClientRect().height })), fontResources: performance.getEntriesByType('resource').filter(r => /fonts/.test(r.name)).map(r=>r.name) };
    });
    await page.getByTestId('tail-hint').click();
    await page.getByTestId('info-card').waitFor();
    await page.screenshot({ path: `${out}/${name}-card.png` });
    await page.keyboard.press('Escape');
    const escapeClosesCard = !(await page.getByTestId('info-card').isVisible());
    if (!escapeClosesCard) await page.getByTestId('info-card').locator('button').click();
    if (name === 'desktop') {
      await page.mouse.move(700,400); await page.mouse.down(); await page.mouse.move(1060,530,{steps:15}); await page.mouse.up();
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${out}/desktop-rotated.png` });
    }
    report.push({ name, resources, escapeClosesCard, errors });
    await page.close();
  }
} finally { await browser.close(); }
writeFileSync(`${out}/evidence.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
