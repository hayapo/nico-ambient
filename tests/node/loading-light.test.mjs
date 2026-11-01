import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { bundle } from '../helpers/bundle.mjs';

const source = await bundle('src/scripts/ambient-light.ts', 'AmbientLight', {
  './edge-field': 'export const createEdgeField = globalThis.createEdgeField;',
  './page-backdrop': 'export const PageBackdrop = globalThis.PageBackdrop;',
});

test('draws poster before exposing backgrounds, then switches to video', async () => {
  const window = new Window();
  try {
    const { document } = window;
    document.body.innerHTML =
      '<div><video poster="https://example.com/poster.jpg"></video></div>';
    const video = document.querySelector('video');
    Object.defineProperty(video, 'poster', {
      value: 'https://example.com/poster.jpg',
    });
    video.getBoundingClientRect = () => ({
      left: 100,
      top: 100,
      right: 740,
      bottom: 460,
      width: 640,
      height: 360,
    });
    let ready = false;
    let seeking = false;
    let currentTime = 1;
    for (const [key, get] of Object.entries({
      readyState: () => (ready ? 2 : 0),
      videoWidth: () => (ready ? 640 : 0),
      videoHeight: () => (ready ? 360 : 0),
      seeking: () => seeking,
      currentTime: () => currentTime,
    }))
      Object.defineProperty(video, key, { get });
    let image;
    const createElement = document.createElement.bind(document);
    document.createElement = (name, ...args) => {
      if (name !== 'img') return createElement(name, ...args);
      image = { complete: false, naturalWidth: 0, naturalHeight: 0 };
      return image;
    };
    let tick;
    window.requestAnimationFrame = (callback) => {
      tick = callback;
      return 1;
    };
    window.cancelAnimationFrame = () => {};
    window.HTMLCanvasElement.prototype.getContext = () => ({});
    const events = [];
    window.createEdgeField = () => (input) =>
      events.push(input === video ? 'video' : 'poster');
    window.PageBackdrop = class {
      update(_root, enabled) {
        events.push(enabled);
      }
      destroy() {}
    };
    window.eval(`${source}\nglobalThis.makeLight = AmbientLight;`);
    const light = new window.makeLight(
      { video, player: video.parentElement },
      () => ({ enabled: true, spread: 200, brightness: 65 }),
      () => {},
    );
    const layer = document.querySelector('[data-nico-ambient=light]');
    assert.equal(layer.hidden, true);
    assert.deepEqual(events, [false]);
    assert.equal(image.crossOrigin, 'anonymous');
    image.complete = true;
    image.naturalWidth = 640;
    image.naturalHeight = 360;
    tick();
    assert.deepEqual(events.slice(-2), ['poster', true]);
    assert.equal(layer.hidden, false);
    ready = true;
    currentTime = 2;
    tick();
    assert.deepEqual(events.slice(-2), ['video', true]);

    // シーク中にフレームを取得できなくてもポスターへ戻るちらつきを起こさないよう、直前の動画光を保つ。
    const drawsBeforeSeek = events.filter((event) => event === 'video').length;
    ready = false;
    seeking = true;
    tick();
    assert.equal(events.filter((event) => event === 'poster').length, 1);
    assert.equal(
      events.filter((event) => event === 'video').length,
      drawsBeforeSeek,
    );
    assert.equal(layer.hidden, false);
    assert.equal(events.at(-1), true);

    seeking = false;
    tick();
    assert.equal(events.filter((event) => event === 'poster').length, 1);
    assert.equal(layer.hidden, false);

    ready = true;
    currentTime = 3;
    tick();
    assert.equal(
      events.filter((event) => event === 'video').length,
      drawsBeforeSeek + 1,
    );
    assert.equal(events.at(-1), true);
    light.destroy();
  } finally {
    await window.happyDOM.close();
  }
});
