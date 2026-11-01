import { resolve } from 'node:path';
import { build } from 'vite';
export async function bundle(entry, expose = '', mocks = {}) {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'test-mocks',
        enforce: 'pre',
        resolveId(id) {
          if (id in mocks) return `\0mock:${id}`;
        },
        load(id) {
          if (id.startsWith('\0mock:')) return mocks[id.slice(6)];
        },
      },
    ],
    build: {
      write: false,
      minify: false,
      lib: { entry: resolve(entry), name: 'TestModule', formats: ['iife'] },
    },
  });
  return (
    (Array.isArray(result) ? result[0] : result).output
      .filter((item) => item.type === 'chunk')
      .map((item) => item.code)
      .join('\n') +
    (expose ? `\nglobalThis.${expose} = TestModule.${expose};` : '')
  );
}
