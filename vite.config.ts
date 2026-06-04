import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:58080',
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
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
