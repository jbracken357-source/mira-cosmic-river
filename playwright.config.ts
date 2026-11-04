import { defineConfig, devices } from '@playwright/test';

const PORT = 5175;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  // Generous: the opening sequence alone runs 15s of wall clock, and CI renders in software.
  timeout: 60000,
  // One dev server and one WebGL context at a time keeps the suite honest on CI runners.
  // fullyParallel only lets `--shard` split at test level (CI runs 4 shards, one runner
  // each); with one worker, the tests in a shard still run one at a time, in file order.
  fullyParallel: true,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Recording every test costs CPU under software GL; the retry records the failure.
    video: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // The star clock is pure, so it runs in Node with no browser and no unit runner of its
    // own. (The shared dev server below still boots for the run as a whole.)
    { name: 'unit', testDir: './tests/unit' },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['html']],
});
