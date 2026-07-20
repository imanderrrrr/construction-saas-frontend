import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // Repairs the broken Node-22+ `localStorage` placeholder that shadows
    // jsdom's Storage — without it, any code path touching localStorage
    // (e.g. dateTime.getBusinessTz) crashes component tests on newer Node.
    // Generalizes the per-file stub from PR #34.
    setupFiles: ['./vitest.setup.ts'],
    // Unit + component tests live under src/. Playwright E2E specs live in
    // ./e2e and must NOT be collected by vitest (they import @playwright/test,
    // which would error under the vitest runner).
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
