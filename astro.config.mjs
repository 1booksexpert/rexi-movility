import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://rexi-movilidad.pages.dev',
  output: 'static',
  build: {
    assets: '_assets'
  }
});