import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {defineConfig, Plugin} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

const CONFIG_DIR = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));
const APP_VERSION = '3.1.0';
const DEFAULT_RELEASE_NOTES = [
  'সব মোবাইল ডিভাইসে স্বয়ংক্রিয় অ্যাপ আপডেট সিস্টেম (Zero-Stuck Auto-Update ও দ্রুত SW ক্যাশ সিঙ্ক)',
  'লোকেশন ও পূর্বের সফল সার্ভিস ইতিহাস অনুযায়ী সেরা টেকনিশিয়ান সাজেস্ট সিস্টেম',
  'স্টাফ QR আইডি কার্ড, দৈনিক/মাসিক/বাৎসরিক QR PDF স্টেটমেন্ট এবং অ্যাপ পোর্টাল কন্ট্রোল'
];

function createAutoUpdateBuildPlugin(buildId: string, buildTime: string): Plugin {
  const versionPayload = JSON.stringify(
    {
      version: APP_VERSION,
      buildId,
      buildTime,
      releaseNotes: DEFAULT_RELEASE_NOTES,
    },
    null,
    2
  );

  return {
    name: 'dip-bhola-auto-update-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const origin = req.headers.origin;
        const urlPath = (req.url || '').split('?')[0];
        if (
          origin &&
          (urlPath.endsWith('manifest.json') ||
            urlPath.endsWith('manifest.webmanifest') ||
            urlPath.endsWith('.png') ||
            urlPath.endsWith('.svg'))
        ) {
          res.setHeader('Access-Control-Allow-Origin', origin);
          res.setHeader('Access-Control-Allow-Credentials', 'true');
          res.setHeader('Vary', 'Origin');
        }
        next();
      });

      server.middlewares.use('/version.json', (_req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.end(versionPayload);
      });
    },
    closeBundle() {
      const distDir = path.resolve(CONFIG_DIR, 'dist');
      if (!fs.existsSync(distDir)) return;

      try {
        fs.writeFileSync(path.join(distDir, 'version.json'), versionPayload, 'utf-8');
      } catch (err) {
        console.warn('Auto-update version.json write warning:', err);
      }
    },
  };
}

export default defineConfig(() => {
  const buildId = `${APP_VERSION}-${Date.now()}`;
  const buildTime = new Date().toISOString();

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        manifestFilename: 'manifest.json',
        useCredentials: true,
        includeAssets: [
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
          'icon-48.png',
          'icon-72.png',
          'icon-96.png',
          'icon-144.png',
          'icon-192.png',
          'icon-512.png',
          'icon-maskable-192.png',
          'icon-maskable-512.png',
        ],
        manifest: {
          id: '/',
          name: 'DIP BHOLA NETWORK - হিসাব খাতা ও স্টাফ মনিটরিং',
          short_name: 'DIP BHOLA',
          description:
            'DIP BHOLA NETWORK এর কেন্দ্রীয় দৈনিক আয়-ব্যয় হিসাব, স্টাফ মনিটরিং, গ্রাহক অভিযোগ এবং ক্যাশ বুক পরিচালন ব্যবস্থা।',
          theme_color: '#020c1b',
          background_color: '#020c1b',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          scope: '/',
          categories: ['business', 'finance', 'productivity'],
          icons: [
            {
              src: '/icon-48.png',
              sizes: '48x48',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icon-72.png',
              sizes: '72x72',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icon-96.png',
              sizes: '96x96',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icon-144.png',
              sizes: '144x144',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icon-maskable-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: [
            'assets/aistudio/**',
            'default_backup.json',
            'assets/vendor-xlsx-*.js',
            'assets/vendor-pdf-*.js',
            'assets/vendor-charts-*.js',
          ],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/version\.json/,
            /^\/manifest\.json/,
            /^\/sw\.js/,
            /^\/registerSW\.js/,
            /^\/assets\//
          ],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /\/assets\/.*\.(?:js|css)$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'app-lazy-assets-cache',
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html',
        },
      }),
      createAutoUpdateBuildPlugin(buildId, buildTime),
    ],
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION),
      __APP_BUILD_ID__: JSON.stringify(buildId),
      __APP_BUILD_TIME__: JSON.stringify(buildTime),
    },
    resolve: {
      alias: {
        '@': path.resolve(CONFIG_DIR, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (id.includes('xlsx')) return 'vendor-xlsx';
              if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf';
              if (id.includes('firebase')) return 'vendor-firebase';
              if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
              if (id.includes('lucide-react')) return 'vendor-icons';
              if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react';
            }
            return undefined;
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
