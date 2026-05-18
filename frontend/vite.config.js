import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../', '');
  const port = env.PORT || '8000';

  return {
    plugins: [
      sveltekit(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: false,
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,webmanifest}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [],
        },
      }),
    ],
    server: {
      proxy: {
        '/api': `http://localhost:${port}`,
      },
    },
  };
});
