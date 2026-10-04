import { defineConfig, devices } from '@playwright/test';

// Verify routing in the production JS bundle, without deploying. The Vercel
// forwarding contract is covered separately by platformRouting.test.ts.
const port = Number(process.env.E2E_PORT ?? 5188);
export default defineConfig({
  testDir: './e2e',
  testMatch: 'platform-api.spec.ts',
  workers: 1,
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
