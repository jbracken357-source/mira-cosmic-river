// Preserve the visual-fallback evidence for ticket 08 (#24): what the viewer
// actually sees when WebGL is unavailable and when the context is lost.
// Writes docs/design-audit-2026-09-17/evidence/fallback-webgl-unavailable.png
// and fallback-context-lost.png. Behavioural proof lives in
// tests/e2e/resilient-entry.spec.ts; these PNGs are the visual half.
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { DESKTOP_VIEWPORT, freePort, startDevServer } from './baseline-harness.mjs';

const outDir = path.join('docs', 'design-audit-2026-09-17', 'evidence');
const port = await freePort();
const server = await startDevServer(port);
const browser = await chromium.launch({ headless: true });
try {
  await mkdir(outDir, { recursive: true });

  // 1. WebGL unavailable: context creation refused from the very start.
  {
    const context = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem('mira:seen-opening', '1');
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (String(type).startsWith('webgl')) return null;
        return original.call(this, type, ...args);
      };
    });
    await page.goto(`${server.baseUrl}/?quality=low`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('scene-fallback').waitFor();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, 'fallback-webgl-unavailable.png') });
    console.log('fallback-webgl-unavailable.png written');
    await context.close();
  }

  // 2. Context lost mid-exploration: the still takes over with a retry path.
  {
    const context = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('mira:seen-opening', '1'));
    await page.goto(`${server.baseUrl}/?quality=low`);
    await page.getByTestId('explore-ui').waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      gl.getExtension('WEBGL_lose_context').loseContext();
    });
    await page.getByTestId('scene-fallback').waitFor();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, 'fallback-context-lost.png') });
    console.log('fallback-context-lost.png written');
    await context.close();
  }
} finally {
  await browser.close();
  server.child.kill();
}
