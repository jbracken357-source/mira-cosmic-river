import { defineConfig, devices } from '@playwright/test';

const PORT = 5175;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  // Generous: the opening sequence alone runs 15s of wall clock, and CI renders in software.
  timeout: 60000,
  // One dev server and one WebGL context at a time keeps the suite honest on CI runners.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // The star clock is a pure module: it needs neither a browser nor the dev server, so it
    // runs in Node on its own rather than pulling in a unit runner.
    { name: 'unit', testDir: './tests/unit' },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  reporter: [['html'], ['junit', { outputFile: 'test-results/junit.xml' }]],
});
