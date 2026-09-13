import { defineConfig, devices } from '@playwright/test';

// Demo recorder — drives the real admin panel over a hermetic (mocked) API and
// records one video per module for the landing page's Videos block.
// Separate from playwright.config.ts on purpose: `npm run e2e` must not pick
// these up (they are a content pipeline, not a test suite).
const PORT = Number(process.env.DEMO_PORT ?? 5199);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.rec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: './.out',
  use: {
    baseURL,
    actionTimeout: 15_000,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    video: { mode: 'on', size: { width: 1280, height: 800 } },
    trace: 'off',
    screenshot: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
