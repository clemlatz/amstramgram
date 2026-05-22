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
        injectRegister: 'auto',
        manifest: false,
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.js',
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,webmanifest}'],
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
