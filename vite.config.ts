import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';

/**
 * GAME=2040 builds 2040 on its own (npm run build:2040, used by the Vercel project whose Root Directory is 2040/):
 * only its page, served at the root of its own domain, into 2040/dist. Otherwise both games build together, Tasty
 * World at / and 2040 at /2040.
 */
const SOLO = process.env.GAME === '2040';

/** In the solo build, 2040's page is also the site's index.html, so the game opens at the root of its domain. */
const soloIndex = (): Plugin => ({
  name: 'solo-2040-index',
  enforce: 'post',
  generateBundle(_o, bundle) {
    const page = bundle['2040/index.html'];
    if (page?.type === 'asset') this.emitFile({ type: 'asset', fileName: 'index.html', source: page.source });
  },
});

export default defineConfig({
  define: { __SOLO_2040__: JSON.stringify(SOLO) },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    outDir: SOLO ? '2040/dist' : 'dist',
    emptyOutDir: true,
    rollupOptions: { input: SOLO ? { y2040: '2040/index.html' } : { main: 'index.html', y2040: '2040/index.html' } },
  },
  worker: { format: 'es' },
  plugins: [
    ...(SOLO ? [soloIndex()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/icon.svg'],
      manifest: SOLO ? {
        name: '2040 · Halcyon City',
        short_name: '2040',
        description: 'Live, work, eat and dig for secrets in Halcyon City, a rain-soaked voxel metropolis.',
        theme_color: '#07080d',
        background_color: '#07080d',
        display: 'fullscreen',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: 'icons/icon-2040-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-2040-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-2040-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      } : {
        name: 'Tasty World — Street Food Adventure',
        short_name: 'Tasty World',
        description: 'A cozy isometric voxel adventure: travel the world through its street food. First stop, Tokyo.',
        theme_color: '#1d1512',
        background_color: '#1d1512',
        display: 'fullscreen',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // /2040 is its own page: never answer it with Tasty World's
        navigateFallbackDenylist: SOLO ? [] : [/^\/2040/],
      },
    }),
  ],
});
