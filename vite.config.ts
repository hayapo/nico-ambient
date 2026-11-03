import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const development = mode === 'development';
  const developmentOutput = fileURLToPath(
    new URL('./dist-dev', import.meta.url),
  );
  return {
    root: 'src',
    publicDir: '../public',
    base: './',
    plugins: development
      ? [
          {
            name: 'nico-ambient-development-manifest',
            async writeBundle() {
              const manifestPath = `${developmentOutput}/manifest.json`;
              const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
              manifest.name = 'Nico Ambient [DEV]';
              manifest.action.default_title = 'Nico Ambient [DEV]';
              for (const size of Object.keys(manifest.icons)) {
                manifest.icons[size] = `icons/icon-${size}-dev.png`;
              }
              for (const size of Object.keys(manifest.action.default_icon)) {
                manifest.action.default_icon[size] =
                  `icons/icon-${size}-dev.png`;
              }
              await writeFile(
                manifestPath,
                `${JSON.stringify(manifest, null, 2)}\n`,
              );
              const { buildDevelopmentIcons } = await import(
                './scripts/build-development-icons.mjs'
              );
              await buildDevelopmentIcons(developmentOutput);
            },
          },
        ]
      : [],
    build: {
      outDir: development ? '../dist-dev' : '../dist',
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
  };
});
