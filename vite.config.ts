import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      'process.env.TURSO_DATABASE_URL': JSON.stringify(env.DATABASE_URL || env.VITE_TURSO_DATABASE_URL || ''),
      'process.env.TURSO_AUTH_TOKEN': JSON.stringify(env.TOKEN_TURSO || env.VITE_TURSO_AUTH_TOKEN || ''),
      'import.meta.env.VITE_TURSO_DATABASE_URL': JSON.stringify(env.DATABASE_URL || env.VITE_TURSO_DATABASE_URL || ''),
      'import.meta.env.VITE_TURSO_AUTH_TOKEN': JSON.stringify(env.TOKEN_TURSO || env.VITE_TURSO_AUTH_TOKEN || ''),
    },
    plugins: [
      react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'favicon.png',
        'logo.webp',
        'pwa/icon-192.png',
        'pwa/icon-512.png',
        'pwa/icon-maskable-512.png',
        'pwa/apple-touch-icon.png',
      ],
      manifest: {
        id: '/',
        name: 'Mega Tehnik Elektronik - Kasir & Cetak Struk Thermal',
        short_name: 'Mega Tehnik',
        description:
          'Mega Tehnik Elektronik - Solusi Elektronik, Terpercaya! Kasir, Manajemen Produk & Cetak Struk Thermal',
        lang: 'id',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        background_color: '#060a17',
        theme_color: '#0D47A1',
        orientation: 'any',
        categories: ['business', 'shopping', 'productivity'],
        icons: [
          { src: 'pwa/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: 'pwa/icon-192.webp', sizes: '192x192', type: 'image/webp' },
          { src: 'pwa/icon-512.webp', sizes: '512x512', type: 'image/webp' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        globIgnores: ['**/Logo*', '**/node_modules/**'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Google Fonts: static, versioned URLs -> cache first (fast startup, offline-safe)
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mega-teknik-google-fonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 3000,
    open: true,
  },
  };
});
