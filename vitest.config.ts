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
    // Unit + component tests live under src/. Playwright E2E specs live in
    // ./e2e and must NOT be collected by vitest (they import @playwright/test,
    // which would error under the vitest runner).
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
