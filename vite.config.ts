import { defineConfig, type Plugin } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

/**
 * With BUNDLE_BUDGET=1, writes `.vite/chunk-modules.json` (chunk → the
 * modules rendered into it, with their rendered bytes) next to the manifest, so tools/bundle-budget.mjs
 * can check what the landing's set must not carry (AUD-019). Off by default:
 * a normal build does not publish its module paths.
 */
function chunkModulesReport(): Plugin {
  return {
    name: 'buildtrack-chunk-modules',
    apply: 'build',
    generateBundle(_options, bundle) {
      if (process.env.BUNDLE_BUDGET !== '1') return;
      const map: Record<string, Record<string, number>> = {};
      for (const [file, output] of Object.entries(bundle)) {
        if (output.type !== 'chunk') continue;
        map[file] = Object.fromEntries(Object.entries(output.modules).map(([id, info]) => [
          path.relative(__dirname, id).split(path.sep).join('/'),
          info.renderedLength,
        ]));
      }
      this.emitFile({ type: 'asset', fileName: '.vite/chunk-modules.json', source: JSON.stringify(map, null, 1) });
    },
  }
}

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    chunkModulesReport(),
  ],
  server: {
    port: Number(process.env.E2E_PORT ?? 5180),
    strictPort: true,
    proxy: {
      '/api/platform': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:58080',
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/api\/platform(?=\/|$)/, '/platform'),
      },
      '/api': {
        // Overridable so a second local backend (e.g. 58090 while another
        // checkout holds 58080) can sit behind the same relative /api calls —
        // and behind the QuickBooks OAuth callback, which Intuit sends to this
        // origin and the proxy hands to the backend.
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:58080',
        changeOrigin: true,
      },
    },
    // Prevent ERR_CACHE_READ_FAILURE caused by the browser caching stale HMR
    // chunks. Without this header Chrome serves a stale disk-cached module
    // after any hot-module-replacement update, breaking all lazy imports until
    // a hard reload (Ctrl+Shift+R). No-store is dev-only: production builds
    // are served with their own cache headers from the hosting layer.
    headers: {
      'Cache-Control': 'no-store',
    },
  },
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
      // Translations fetched per language and namespace (vitest bundles them).
      '@buildtrack/i18n-locales': path.resolve(__dirname, './src/i18n/locales.ts'),
    },
  },

  build: {
    rollupOptions: {
      output: {
        // AUD-019: the framework the entry needs (React, the router, i18next,
        // Sentry) in a chunk of its own. Its hash only changes when those
        // packages do, so after a deploy that only touched app code a
        // returning visitor re-downloads ~63 KB gzip instead of ~165 KB
        // (measured: evidencia/frontend/aud019-vendor). First visits pay one
        // more request and ~0.3 KB.
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler|react-router|i18next|react-i18next|i18next-browser-languagedetector|@sentry\/[\w-]+)\//.test(id)) return 'vendor';
        },
      },
    },
  },
  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
