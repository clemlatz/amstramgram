import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../', '');
  const port = env.PORT || '8000';

  return {
    plugins: [sveltekit()],
    server: {
      proxy: {
        '/api': `http://localhost:${port}`,
      },
    },
  };
});
