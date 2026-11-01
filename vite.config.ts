import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    // two games, one engine: Tasty World at / and 2040 (Halcyon City) at /2040
    rollupOptions: { input: { main: 'index.html', y2040: '2040/index.html' } },
  },
  worker: { format: 'es' },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/icon.svg'],
      manifest: {
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
        navigateFallbackDenylist: [/^\/2040/],
      },
    }),
  ],
});
