import { expect, test } from '@playwright/test';
// @ts-expect-error テスト用ヘルパーはJavaScriptで記述している。
import { bundle } from './helpers/bundle.mjs';

let script: string;
test.beforeAll(async () => {
  script = await bundle('src/scripts/page-backdrop.ts', 'PageBackdrop');
});

test('retains detected backgrounds when surfaces override their appearance', async ({
  page,
}) => {
  await page.setContent(`<style>
    main { background:red; }
    main::before { content:''; background:blue; }
  </style><main class="bg-c_layer.surfaceHighEm"><div id="player"><video></video></div></main>`);
  await page.addScriptTag({ content: script });
  const result = await page.evaluate(() => {
    const queryRequired = <T extends Element>(selector: string): T => {
      const element = document.querySelector<T>(selector);
      if (!element) throw new Error(`Missing test element: ${selector}`);
      return element;
    };
    const main = queryRequired<HTMLElement>('main');
    const player = queryRequired<HTMLElement>('#player');
    const api = window as unknown as {
      PageBackdrop: new (
        p: Element,
        v: Element,
      ) => {
        update(root: Element, enabled: boolean, force?: boolean): void;
        destroy(): void;
      };
    };
    const backdrop = new api.PageBackdrop(
      player,
      queryRequired<HTMLVideoElement>('video'),
    );
    const scans = [];
    for (let i = 0; i < 4; i++) {
      backdrop.update(document.body, true, true);
      scans.push({
        backdrop: main.getAttribute('data-nico-ambient-backdrop'),
        effects: main.getAttribute('data-nico-ambient-effects'),
        pseudo: getComputedStyle(main, '::before').backgroundColor,
      });
    }
    backdrop.destroy();
    return {
      scans,
      restored: getComputedStyle(main, '::before').backgroundColor,
    };
  });
  expect(result.scans).toEqual(
    Array(4).fill({
      backdrop: 'surface',
      effects: 'clear-pseudos',
      pseudo: 'rgba(0, 0, 0, 0)',
    }),
  );
  expect(result.restored).toBe('rgb(0, 0, 255)');
});

test('fullscreen surface ancestry ends at the active root', async ({
  page,
}) => {
  await page.setContent(
    '<main class="bg-c_layer.surfaceHighEm"><div id="player" class="bg-c_layer.surfaceHighEm"><video></video><section class="bg-c_layer.surfaceHighEm"></section></div></main>',
  );
  await page.addScriptTag({ content: script });
  const states = await page.evaluate(() => {
    const queryRequired = <T extends Element>(selector: string): T => {
      const element = document.querySelector<T>(selector);
      if (!element) throw new Error(`Missing test element: ${selector}`);
      return element;
    };
    const player = queryRequired<HTMLElement>('#player');
    const api = window as unknown as {
      PageBackdrop: new (
        p: Element,
        v: Element,
      ) => { update(root: Element, enabled: boolean): void; destroy(): void };
    };
    const backdrop = new api.PageBackdrop(
      player,
      queryRequired<HTMLVideoElement>('video'),
    );
    const read = () =>
      ['main', '#player', 'section'].map((selector) =>
        queryRequired(selector).getAttribute('data-nico-ambient-backdrop'),
      );
    backdrop.update(document.body, true);
    const normal = read();
    backdrop.update(player, true);
    const fullscreen = read();
    const blur = getComputedStyle(player).backdropFilter;
    backdrop.update(document.body, true);
    const returned = read();
    backdrop.destroy();
    return { normal, fullscreen, blur, returned, restored: read() };
  });
  expect(states.normal).toEqual(['surface', 'clear', 'clear']);
  expect(states.fullscreen).toEqual([null, 'surface', 'clear']);
  expect(states.blur).toContain('blur(48px)');
  expect(states.returned).toEqual(states.normal);
  expect(states.restored).toEqual([null, null, null]);
});
