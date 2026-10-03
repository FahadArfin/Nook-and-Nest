import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// A separate entry: no app state, hosting identity, catalog, or public-tree copy.
export default defineConfig({
  base: '/model-lab/',
  publicDir: false,
  build: {
    outDir: '.generated/model-lab-build',
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL('./model-lab/index.html', import.meta.url)),
    },
  },
});
