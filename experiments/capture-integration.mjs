// Manual visual evidence against a running development server; no production hooks.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true });
const report = [];
try {
  for (const mode of ['high', 'rotated', 'mobile', 'fallback']) {
    const page = await browser.newPage({
      viewport: mode === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('mira:seen-opening', '1'));
    if (mode === 'fallback') await page.route('**/materials/*.webp', route => route.fulfill({ status: 404, body: '' }));
    await page.goto(`http://127.0.0.1:5186/?epoch=2026-09-12${mode === 'fallback' ? '&quality=low' : ''}`, { waitUntil: 'networkidle' });
    await page.getByTestId('explore-ui').waitFor();
    if (mode === 'rotated') {
      for (let i = 0; i < 3; i++) {
        await page.mouse.move(700, 400);
        await page.mouse.down();
        await page.mouse.move(1040, 520, { steps: 20 });
        await page.mouse.up();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `docs/visual-direction/evidence/integration-orbit-${i + 1}.png` });
      }
    }
    await page.screenshot({ path: `docs/visual-direction/evidence/integration-${mode}.png` });
    // Inspect the actual mounted GPU resources, rather than a test flag on the page.
    const resources = await page.evaluate(async () => {
      const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js');
      const state = _roots.get(document.querySelector('canvas')).store.getState();
      const veil = state.scene.getObjectByName('river-veil');
      let surfaceReady = 0;
      state.scene.traverse(object => {
        if (object.material?.uniforms?.uSurfaceReady) surfaceReady = object.material.uniforms.uSurfaceReady.value;
      });
      return {
        surfaceReady,
        layers: veil.children.length,
        imageReady: veil.children.map(mesh => mesh.material.uniforms.uReady.value),
        opacity: veil.children.map(mesh => mesh.material.uniforms.uOpacity.value),
        textureSizes: veil.children.map(mesh => {
          const image = mesh.material.uniforms.uMap.value?.image;
          return image ? [image.width, image.height] : null;
        }),
      };
    });
    report.push({ mode, errors, resources });
    await page.close();
  }
  await writeFile('docs/visual-direction/evidence/integration-resources.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
