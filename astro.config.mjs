import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://rexi-movilidad.pages.dev',
  output: 'static',
  build: {
    assets: '_assets'
  },
  // En desarrollo (npm run dev) las llamadas a /api se envían a la API local:
  // en otra terminal corre  cd api && npm run dev
  vite: {
    server: {
      proxy: { '/api': 'http://127.0.0.1:8787' }
    }
  }
});
