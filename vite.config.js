import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const apiBaseUrl = env.VITE_API_URL ? new URL(env.VITE_API_URL).origin : 'http://localhost:5000';

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'robots.txt'],
        // Without this the dev server ships no service worker, so Chrome never
        // considers the app installable and never fires `beforeinstallprompt` —
        // the install banner simply can't appear on localhost.
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html',
        },
        manifest: {
          name: 'SGH Crafts ERP',
          short_name: 'SGH ERP',
          description: 'Orders, production, showroom and local sales for SGH Crafts',
          theme_color: '#B8542A',
          background_color: '#FAF8F4',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/dashboard',
          scope: '/',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          shortcuts: [
            { name: 'Collections', url: '/showroom/collections' },
            { name: 'Local orders', url: '/local/orders' },
            { name: 'Production', url: '/factory/production' },
          ],
        },
        workbox: {
          // Bundle is currently ~3 MB; bump the precache limit so the service
          // worker doesn't bail at build time. Long-term we should code-split.
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
          navigateFallback: '/index.html',
          runtimeCaching: [
            {
              // Read-only showroom / catalogue GETs. Writes always hit the
              // network; this gives showroom staff a usable view even when
              // their phone briefly loses signal. Notifications are never
              // cached — a stale bell is worse than an empty one.
              urlPattern: ({ url, request }) =>
                request.method === 'GET' &&
                /\/api\/v1\/(showroom|buyer-catalogue|customers)/.test(url.pathname),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'v1-read-cache',
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
            {
              urlPattern: ({ url, request }) =>
                request.method === 'GET' &&
                /\/api\/v2\/(instances|locations|reports|products)/.test(url.pathname),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'v2-read-cache',
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
            {
              urlPattern: ({ url }) => /\/uploads\//.test(url.pathname),
              handler: 'CacheFirst',
              options: {
                cacheName: 'piece-images',
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: apiBaseUrl, changeOrigin: true },
        '/uploads': { target: apiBaseUrl, changeOrigin: true },
      },
    },
  };
});
