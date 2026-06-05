import { defineConfig, devices } from '@playwright/test';

// BuildTrack — Playwright E2E config (HERMETIC).
//
// Every spec intercepts `**/api/v1/**` and Paddle at the browser network
// layer (see e2e/support/mock-api.ts), so these tests need NO backend and NO
// real Paddle account — they are deterministic and safe to run in CI. The web
// server is the normal Vite dev server; a dummy Paddle client token is injected
// so the (stubbed) checkout path doesn't throw on the missing-token guard.
//
// This suite is intentionally separate from the vitest unit suite (`npm test`)
// — see the `e2e` npm script and the dedicated E2E GitHub workflow.

const PORT = 5180;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // One worker in CI keeps the single dev server + traces deterministic.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list']],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Dummy values so lib/paddle.ts passes its missing-token guard; the real
    // Paddle.js is intercepted and window.Paddle is stubbed in the specs.
    env: {
      VITE_PADDLE_CLIENT_TOKEN: 'test_e2e_token',
      VITE_PADDLE_ENVIRONMENT: 'sandbox',
    },
  },
});
