import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Window } from 'happy-dom';

const script = readFileSync('dist/content.js', 'utf8');

async function setup(url = 'https://www.nicovideo.jp/watch/sm9') {
  const window = new Window({ url });
  const { document } = window;
  document.body.innerHTML =
    '<div id="player"><video></video><div id="controls"><button aria-label="全画面表示する"></button></div></div>';
  const rect = {
    x: 100,
    y: 100,
    left: 100,
    top: 100,
    right: 740,
    bottom: 460,
    width: 640,
    height: 360,
  };
  for (const element of [
    document.querySelector('video'),
    document.querySelector('#player'),
  ]) {
    element.getBoundingClientRect = () => rect;
  }
  const video = document.querySelector('video');
  for (const [key, value] of Object.entries({
    readyState: 4,
    videoWidth: 640,
    videoHeight: 360,
    currentTime: 1,
  })) {
    Object.defineProperty(video, key, { value, configurable: true });
  }
  const calls = [];
  window.HTMLCanvasElement.prototype.getContext = function () {
    return {
      canvas: this,
      createImageData(width, height) {
        return {
          width,
          height,
          data: new Uint8ClampedArray(width * height * 4),
        };
      },
      getImageData(_x, _y, width, height) {
        return this.createImageData(width, height);
      },
      putImageData() {},
      clearRect() {},
      drawImage(...args) {
        calls.push(args);
      },
    };
  };
  const intervals = [];
  const timeouts = new Map();
  const frames = new Map();
  let nextFrameId = 0;
  window.requestAnimationFrame = (callback) => {
    const frameId = ++nextFrameId;
    frames.set(frameId, callback);
    return frameId;
  };
  window.cancelAnimationFrame = (frameId) => frames.delete(frameId);
  let id = 0;
  window.setInterval = (fn) => {
    intervals.push(fn);
    return ++id;
  };
  window.setTimeout = (fn) => {
    timeouts.set(++id, fn);
    return id;
  };
  window.clearTimeout = (id) => timeouts.delete(id);
  const stored = {};
  window.chrome = {
    storage: {
      local: {
        get: async () => stored,
        set: async (value) => Object.assign(stored, value),
      },
      onChanged: { addListener() {} },
    },
  };
  window.eval(script);
  await new Promise((resolve) => setImmediate(resolve));
  function flushFrame() {
    const pending = [...frames];
    frames.clear();
    for (const [, callback] of pending) callback(window.performance.now());
  }
  return { window, document, calls, stored, intervals, timeouts, flushFrame };
}

async function settleMutations() {
  await new Promise((resolve) => setImmediate(resolve));
}

function closeWindow(window) {
  window.dispatchEvent(new window.Event('pagehide'));
  return window.happyDOM.close();
}

function flushTimeouts(timeouts) {
  for (const [id, callback] of [...timeouts]) {
    timeouts.delete(id);
    callback();
  }
}

test('mounts a single control and samples the video for the edge field', async () => {
  const env = await setup();
  const { document, calls, intervals, window } = env;
  assert.equal(
    document.querySelectorAll('#controls [data-nico-ambient=settings]').length,
    1,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], document.querySelector('video'));
  assert.equal(document.body.getAttribute('data-nico-ambient-active'), '');
  assert.equal(
    document.querySelector('[data-nico-ambient=light]').style.zIndex,
    '-1',
  );
  assert.equal(
    document.querySelector('[data-nico-ambient=light]').style.inset,
    '0',
  );
  intervals[0]();
  intervals[0]();
  assert.equal(
    document.querySelectorAll('[data-nico-ambient=light]').length,
    1,
  );
  await closeWindow(window);
});

test('persists disable setting and removes the light on navigation', async () => {
  const { document, stored, window, intervals, timeouts, flushFrame } =
    await setup();
  const shadow = document.querySelector(
    '[data-nico-ambient=settings]',
  ).shadowRoot;
  const input = shadow.querySelector('#enabled');
  input.checked = false;
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  flushTimeouts(timeouts);
  flushFrame();
  assert.equal(stored.nicoAmbientSettings.enabled, false);
  assert.equal(
    document.querySelector('[data-nico-ambient=light]').hidden,
    true,
  );
  assert.equal(document.body.hasAttribute('data-nico-ambient-backdrop'), false);
  window.history.pushState({}, '', '/ranking');
  intervals[0]();
  assert.equal(document.querySelectorAll('[data-nico-ambient]').length, 0);
  window.history.pushState({}, '', '/watch/sm10');
  intervals[0]();
  assert.equal(
    document.querySelectorAll('[data-nico-ambient=settings]').length,
    1,
  );
  assert.equal(
    document
      .querySelector('[data-nico-ambient=settings]')
      .shadowRoot.querySelector('#enabled').checked,
    false,
  );
  await closeWindow(window);
});

test('does not attach on another hostname or a non-watch page', async () => {
  for (const url of [
    'https://example.com/watch/sm9',
    'https://www.nicovideo.jp/ranking',
  ]) {
    const { document, window } = await setup(url);
    assert.equal(document.querySelectorAll('[data-nico-ambient]').length, 0);
    await closeWindow(window);
  }
});

test('clears only ancestor backgrounds and restores attributes on exit', async () => {
  const { document, window, intervals, flushFrame } = await setup();
  const shell = document.createElement('main');
  shell.setAttribute('data-nico-ambient-backdrop', 'original');
  shell.style.backgroundColor = 'white';
  const card = document.createElement('aside');
  card.style.backgroundColor = 'black';
  document.body.append(shell);
  shell.append(document.querySelector('#player'), card);
  await settleMutations();
  flushFrame();
  assert.equal(shell.getAttribute('data-nico-ambient-backdrop'), 'clear');
  assert.equal(card.hasAttribute('data-nico-ambient-backdrop'), false);
  assert.equal(card.style.backgroundColor, 'black');
  window.history.pushState({}, '', '/ranking');
  intervals[0]();
  assert.equal(shell.getAttribute('data-nico-ambient-backdrop'), 'original');
  assert.equal(shell.style.backgroundColor, 'white');
  assert.equal(document.body.hasAttribute('data-nico-ambient-backdrop'), false);
  assert.equal(document.head.querySelector('style'), null);
  await closeWindow(window);
});

test('spread defaults to 200%, changes reach while paused, and zero restores the page', async () => {
  const { document, window, timeouts, stored, flushFrame } = await setup();
  const shadow = document.querySelector(
    '[data-nico-ambient=settings]',
  ).shadowRoot;
  const input = shadow.querySelector('#spread');
  const layer = document.querySelector('[data-nico-ambient=light]');
  assert.equal(input.min, '0');
  assert.equal(input.max, '400');
  assert.equal(input.value, '200');
  assert.equal(shadow.querySelector('#spread-value').value, '200');
  const initialMask = layer.style.maskImage;
  const initialBlur = layer.querySelector('canvas').style.filter;
  const tick = () => {
    flushTimeouts(timeouts);
    flushFrame();
  };
  const change = (value) => {
    input.value = String(value);
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    tick();
  };
  change(400);
  assert.notEqual(layer.style.maskImage, initialMask);
  assert.equal(layer.querySelector('canvas').style.filter, initialBlur);
  assert.equal(stored.nicoAmbientSettings.spread, 400);
  assert.equal(shadow.querySelector('#spread-value').value, '400');
  change(0);
  assert.equal(layer.hidden, true);
  assert.equal(document.body.hasAttribute('data-nico-ambient-backdrop'), false);
  assert.equal(stored.nicoAmbientSettings.spread, 0);
  assert.equal(shadow.querySelector('#enabled').checked, true);
  change(200);
  assert.equal(layer.hidden, false);
  assert.equal(layer.style.maskImage, initialMask);
  assert.equal(document.body.getAttribute('data-nico-ambient-active'), '');
  await closeWindow(window);
});

test('light fades by distance without switching off when player leaves viewport', async () => {
  const { document, window, timeouts, flushFrame } = await setup();
  const player = document.querySelector('#player');
  const video = document.querySelector('video');
  const layer = document.querySelector('[data-nico-ambient=light]');
  const tick = () => {
    flushTimeouts(timeouts);
    flushFrame();
  };
  const move = (bottom) => {
    const rect = {
      left: 100,
      right: 740,
      top: bottom - 360,
      bottom,
      width: 640,
      height: 360,
    };
    player.getBoundingClientRect = () => rect;
    video.getBoundingClientRect = () => rect;
    tick();
  };
  move(1);
  const before = layer.style.maskImage;
  move(-1);
  assert.equal(layer.hidden, false);
  assert.notEqual(layer.style.maskImage, before);
  assert.equal(document.body.getAttribute('data-nico-ambient-active'), '');
  assert.ok(layer.style.maskImage.includes('719px'));
  move(-800);
  assert.equal(layer.hidden, false);
  assert.ok(layer.style.maskImage.includes('-80px'));
  await closeWindow(window);
});

test('common and search headers reveal light while inputs retain their background', async () => {
  const { document, window, intervals, flushFrame } = await setup();
  const header = document.createElement('header');
  header.className = 'common-header';
  header.innerHTML =
    '<form style="background:white"><input type="search" style="background:white"></form>';
  document.body.prepend(header);
  await settleMutations();
  flushFrame();
  assert.equal(header.getAttribute('data-nico-ambient-backdrop'), 'clear');
  assert.equal(
    header.querySelector('form').getAttribute('data-nico-ambient-backdrop'),
    'clear',
  );
  assert.equal(
    header.querySelector('input').hasAttribute('data-nico-ambient-backdrop'),
    false,
  );
  window.history.pushState({}, '', '/ranking');
  intervals[0]();
  assert.equal(header.hasAttribute('data-nico-ambient-backdrop'), false);
  assert.equal(
    header.querySelector('form').hasAttribute('data-nico-ambient-backdrop'),
    false,
  );
  await closeWindow(window);
});

test('open settings panel tracks player resizing and movement and stops on close', async () => {
  const { document, window } = await setup();
  const shadow = document.querySelector(
    '[data-nico-ambient=settings]',
  ).shadowRoot;
  const panel = shadow.querySelector('#panel');
  const player = document.querySelector('#player');
  let nextFrame;
  window.requestAnimationFrame = (callback) => {
    nextFrame = callback;
    return 1;
  };
  window.cancelAnimationFrame = () => {
    nextFrame = undefined;
  };
  panel.matches = () => true;
  panel.getBoundingClientRect = () => ({ width: 280, height: 240 });
  panel.dispatchEvent(new window.Event('toggle'));
  assert.equal(Number.parseFloat(panel.style.left) >= 12, true);
  assert.ok(Number.parseFloat(panel.style.maxWidth) > 0);
  assert.equal(panel.style.top, '220px');
  player.getBoundingClientRect = () => ({
    left: 50,
    top: 40,
    right: 550,
    bottom: 340,
    width: 500,
    height: 300,
  });
  nextFrame();
  assert.equal(panel.style.left, '562px');
  assert.equal(panel.style.top, '100px');
  player.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
    width: window.innerWidth,
    height: window.innerHeight,
  });
  nextFrame();
  assert.ok(Number.parseFloat(panel.style.maxWidth) > 0);
  assert.ok(Number.parseFloat(panel.style.left) >= 12);
  window.innerWidth = 320;
  player.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: 320,
    bottom: window.innerHeight,
    width: 320,
    height: window.innerHeight,
  });
  nextFrame();
  assert.equal(panel.style.maxWidth, '296px');
  panel.matches = () => false;
  panel.dispatchEvent(new window.Event('toggle'));
  assert.equal(nextFrame, undefined);
  await closeWindow(window);
});

test('CommonHeader hashed background wrappers are cleared and restored without changing menus', async () => {
  const { document, window, intervals, flushFrame } = await setup();
  const header = document.createElement('div');
  header.id = 'CommonHeader';
  header.className = 'nico-CommonHeaderRoot';
  header.innerHTML =
    '<div class="common-header-random"><nav class="common-header-other"></nav><div role="menu"><div class="common-header-menu"></div></div><button>Account</button></div>';
  document.body.prepend(header);
  for (const element of [header, ...header.querySelectorAll('*')]) {
    element.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 1024,
      bottom: 48,
      width: 1024,
      height: 48,
    });
  }
  await settleMutations();
  flushFrame();
  for (const element of [
    header,
    header.firstElementChild,
    header.querySelector('nav'),
  ]) {
    assert.equal(element.getAttribute('data-nico-ambient-backdrop'), 'clear');
  }
  assert.equal(
    header
      .querySelector('[role=menu]')
      .hasAttribute('data-nico-ambient-backdrop'),
    false,
  );
  assert.equal(
    header
      .querySelector('.common-header-menu')
      .hasAttribute('data-nico-ambient-backdrop'),
    false,
  );
  assert.equal(
    header.querySelector('button').hasAttribute('data-nico-ambient-backdrop'),
    false,
  );
  window.history.pushState({}, '', '/ranking');
  intervals[0]();
  assert.equal(
    document.querySelectorAll('[data-nico-ambient-backdrop]').length,
    0,
  );
  await closeWindow(window);
});

test('numeric settings update sliders, clamp ranges, and preserve values on empty input', async () => {
  const { document, window, stored, timeouts, flushFrame } = await setup();
  const shadow = document.querySelector(
    '[data-nico-ambient=settings]',
  ).shadowRoot;
  const input = shadow.querySelector('#spread-value');
  const change = (value) => {
    input.value = value;
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    flushTimeouts(timeouts);
    flushFrame();
  };
  change('237');
  assert.equal(shadow.querySelector('#spread').value, '237');
  assert.equal(stored.nicoAmbientSettings.spread, 237);
  change('900');
  assert.equal(stored.nicoAmbientSettings.spread, 400);
  input.dispatchEvent(new window.Event('blur'));
  assert.equal(input.value, '400');
  change('');
  input.dispatchEvent(new window.Event('blur'));
  assert.equal(input.value, '400');
  change('0');
  assert.equal(
    document.querySelector('[data-nico-ambient=light]').hidden,
    true,
  );
  assert.ok(shadow.querySelector('#toggle svg'));
  await closeWindow(window);
});

test('player rounding does not introduce a separate light cutout', async () => {
  const { document, window, timeouts, flushFrame } = await setup();
  const player = document.querySelector('#player');
  const layer = document.querySelector('[data-nico-ambient=light]');
  const tick = () => {
    flushTimeouts(timeouts);
    flushFrame();
  };
  assert.equal(layer.style.clipPath, '');
  player.style.borderTopLeftRadius = '20px';
  player.style.borderTopRightRadius = '20px';
  player.style.borderBottomLeftRadius = '20px';
  player.style.borderBottomRightRadius = '20px';
  tick();
  assert.equal(layer.style.clipPath, '');
  assert.equal(player.style.borderTopLeftRadius, '20px');
  player.style.borderTopLeftRadius = '0px';
  player.style.borderTopRightRadius = '0px';
  player.style.borderBottomLeftRadius = '0px';
  player.style.borderBottomRightRadius = '0px';
  tick();
  assert.equal(layer.style.clipPath, '');
  await closeWindow(window);
});
