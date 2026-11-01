import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        popup: fileURLToPath(new URL('./src/index.html', import.meta.url)),
        content: fileURLToPath(
          new URL('./src/scripts/content.ts', import.meta.url),
        ),
      },
      output: { entryFileNames: '[name].js' },
    },
  },
});
