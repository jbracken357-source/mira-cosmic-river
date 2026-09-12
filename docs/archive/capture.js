import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating to http://localhost:5179...');
  await page.goto('http://localhost:5179', { waitUntil: 'networkidle', timeout: 30000 });

  console.log('Waiting 15 seconds to observe the scene...');
  await new Promise(r => setTimeout(r, 15000));

  console.log('Taking screenshot...');
  await page.screenshot({ path: 'screenshot.png', fullPage: true });
  console.log('Screenshot saved to screenshot.png');

  await browser.close();
})();
