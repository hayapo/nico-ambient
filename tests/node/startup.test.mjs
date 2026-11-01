import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { bundle } from '../helpers/bundle.mjs';

const script = await bundle('src/scripts/content.ts', '', {
  './settings':
    'export const SETTINGS_KEY = globalThis.SETTINGS_KEY; export const createSettingsStore = globalThis.createSettingsStore;',
  './player': 'export const findPlayer = globalThis.findPlayer;',
  './mount-player': 'export const mountPlayer = globalThis.mountPlayer;',
});

test('mounts late player on DOM insertion without waiting for polling', async () => {
  const window = new Window({ url: 'https://www.nicovideo.jp/watch/sm9' });
  try {
    const { document } = window;
    document.body.remove();
    let nextFrame;
    window.requestAnimationFrame = (callback) => {
      nextFrame = callback;
      return 1;
    };
    window.cancelAnimationFrame = () => {
      nextFrame = undefined;
    };
    window.setInterval = () => 1; // このテストでは予備のポーリングを実行しない。
    window.chrome = { storage: { onChanged: { addListener() {} } } };
    window.SETTINGS_KEY = 'nicoAmbientSettings';
    window.createSettingsStore = () => ({ load: async () => {} });
    window.findPlayer = () => {
      const video = document.querySelector('video');
      const controls = document.querySelector('#controls');
      return video && controls
        ? { video, controls, player: video.parentElement }
        : undefined;
    };
    let mounts = 0;
    window.mountPlayer = (target) => {
      mounts++;
      const host = document.createElement('span');
      target.controls.append(host);
      return {
        ...target,
        host,
        destroy() {
          host.remove();
        },
      };
    };
    window.eval(script);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(mounts, 0);
    const body = document.createElement('body');
    body.innerHTML = '<div><video></video><div id="controls"></div></div>';
    document.documentElement.append(body);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(typeof nextFrame, 'function');
    nextFrame();
    assert.equal(mounts, 1);
    await new Promise((resolve) => setImmediate(resolve));
    nextFrame();
    assert.equal(mounts, 1);
    window.dispatchEvent(new window.Event('pagehide'));
  } finally {
    await window.happyDOM.close();
  }
});
