import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { bundle } from '../helpers/bundle.mjs';

const source = await bundle('src/scripts/page-backdrop.ts', 'PageBackdrop', {});

test('detects late surfaces and class changes without a forced scroll update', async () => {
  const window = new Window();
  try {
    const { document } = window;
    document.body.innerHTML =
      '<main><div id="player"><video></video></div></main>';
    window.eval(`${source}\nglobalThis.makeBackdrop = PageBackdrop;`);
    const backdrop = new window.makeBackdrop(
      document.querySelector('#player'),
      document.querySelector('video'),
    );
    const attr = 'data-nico-ambient-backdrop';
    backdrop.update(document.body, true);
    const surface = document.createElement('section');
    surface.className = 'bg-c_layer.surfaceHighEm';
    document.querySelector('main').append(surface);
    await new Promise((resolve) => setImmediate(resolve));
    backdrop.update(document.body, true);
    assert.equal(surface.getAttribute(attr), 'surface');

    const child = document.createElement('div');
    surface.append(child);
    await new Promise((resolve) => setImmediate(resolve));
    backdrop.update(document.body, true);
    assert.equal(child.hasAttribute(attr), false);
    child.className = 'bg_layer.surfaceHighEm';
    await new Promise((resolve) => setImmediate(resolve));
    backdrop.update(document.body, true);
    assert.equal(child.getAttribute(attr), 'clear');

    surface.className = '';
    await new Promise((resolve) => setImmediate(resolve));
    backdrop.update(document.body, true);
    assert.equal(surface.hasAttribute(attr), false);
    assert.equal(child.getAttribute(attr), 'surface');
    backdrop.update(document.body, false);
    assert.equal(child.hasAttribute(attr), false);
    backdrop.destroy();
  } finally {
    await window.happyDOM.close();
  }
});

test('playing playlist card gets richer backdrop colors without changing nested links', () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML =
    '<main><div id="player"><video></video></div><div data-anchor-area="playlist" data-group="true" data-playing="true"><a data-anchor-area="playlist" data-playing="true">title</a></div></main>';
  const siteStyle = document.createElement('style');
  siteStyle.textContent =
    '[data-group] { backdrop-filter: none; background-color: rgb(37, 37, 37); }';
  document.head.append(siteStyle);
  window.eval(`${source}\nglobalThis.makeBackdrop = PageBackdrop;`);
  const backdrop = new window.makeBackdrop(
    document.querySelector('#player'),
    document.querySelector('video'),
  );
  backdrop.update(document.body, true);
  const card = document.querySelector('[data-group]');
  assert.equal(
    window.getComputedStyle(card).backgroundColor,
    'rgb(0 0 0 / 12%)',
  );
  const blur = (element) =>
    window
      .getComputedStyle(element)
      .getPropertyValue('backdrop-filter')
      .replace(/\s+/g, ' ');
  assert.equal(blur(card), 'blur(32px) saturate(1.15)');
  assert.notEqual(blur(card.firstElementChild), 'blur(32px) saturate(1.15)');
  card.removeAttribute('data-playing');
  assert.equal(blur(card), 'none');
  card.setAttribute('data-playing', 'true');
  assert.equal(blur(card), 'blur(32px) saturate(1.15)');
  backdrop.update(document.body, false);
  assert.equal(blur(card), 'none');
  backdrop.destroy();
  window.happyDOM.abort();
});

test('keeps popup scopes excluded while applying explicit page control roles', () => {
  const window = new Window();
  try {
    const { document } = window;
    document.body.innerHTML = `
      <main><div id="player"><video></video></div>
        <div class="h_watchActionbar.height">
          <button data-scope="hover-card" data-part="trigger" id="soft-trigger">share panel</button>
          <button data-element-name="share" id="share">share</button>
        </div>
        <div class="grid-area_[bottom]">
          <a data-anchor-area="tags" id="tag">tag</a>
          <button data-scope="dialog" data-part="trigger" data-element-name="tag_edit" id="tag-edit">edit</button>
          <button data-part="trigger" id="bottom-trigger">trigger</button>
          <button data-element-name="creator_support" id="support">support</button>
          <div data-scope="menu">
            <button data-part="trigger" id="popup-trigger">popup trigger</button>
            <a data-anchor-area="tags" id="popup-tag">popup tag</a>
          </div>
          <div data-scope="tabs" data-part="list">
            <button data-part="trigger" id="tab">tab</button>
            <button data-part="trigger" aria-selected="true" id="selected-tab">selected</button>
          </div>
        </div>
        <div data-scope="menu"><section class="bg-c_layer.surfaceHighEm" id="menu-content"></section></div>
        <div data-scope="hover-card"><section class="bg-c_layer.surfaceHighEm" id="hover-content"></section></div>
        <div data-scope="dialog"><section class="bg-c_layer.surfaceHighEm" id="dialog-content"></section></div>
        <div data-scope="combobox" data-part="root" id="combobox-root" class="bg-c_layer.surfaceHighEm">
          <input data-part="input" id="combobox-input" class="bg-c_layer.surfaceHighEm">
          <div data-part="control" id="combobox-control" class="bg-c_layer.surfaceHighEm"></div>
          <div data-scope="combobox" data-part="positioner" id="combobox-positioner">
            <div data-scope="combobox" data-part="content" id="combobox-content" class="bg-c_layer.surfaceHighEm"></div>
          </div>
        </div>
        <div data-nvpc-scope="watch-floating-panel" data-nvpc-part="floating">
          <section class="bg-c_layer.surfaceHighEm" id="floating-content"></section>
        </div>
      </main>`;
    window.eval(`${source}\nglobalThis.makeBackdrop = PageBackdrop;`);
    const backdrop = new window.makeBackdrop(
      document.querySelector('#player'),
      document.querySelector('video'),
    );
    const attr = 'data-nico-ambient-backdrop';
    backdrop.update(document.body, true);

    assert.equal(
      document.querySelector('#soft-trigger').getAttribute(attr),
      'soft',
    );
    assert.equal(document.querySelector('#share').getAttribute(attr), 'soft');
    assert.equal(document.querySelector('#tag').getAttribute(attr), 'surface');
    assert.equal(
      document.querySelector('#tag-edit').getAttribute(attr),
      'surface',
    );
    assert.equal(
      document.querySelector('#bottom-trigger').getAttribute(attr),
      'soft',
    );
    assert.equal(document.querySelector('#support').getAttribute(attr), 'soft');
    assert.equal(document.querySelector('#tab').getAttribute(attr), 'surface');
    assert.equal(
      document.querySelector('#selected-tab').getAttribute(attr),
      'surface',
    );
    for (const id of [
      'menu-content',
      'hover-content',
      'dialog-content',
      'floating-content',
      'combobox-positioner',
      'combobox-content',
      'popup-trigger',
      'popup-tag',
    ])
      assert.equal(
        document.querySelector(`#${id}`).hasAttribute(attr),
        false,
        id,
      );

    assert.equal(
      document.querySelector('#combobox-root').getAttribute(attr),
      'surface',
    );
    assert.equal(
      document.querySelector('#combobox-input').getAttribute(attr),
      'clear',
    );
    assert.equal(
      document.querySelector('#combobox-control').getAttribute(attr),
      'clear',
    );

    backdrop.update(document.body, false);
    for (const id of [
      'soft-trigger',
      'share',
      'tag',
      'tag-edit',
      'bottom-trigger',
      'support',
      'tab',
      'selected-tab',
    ])
      assert.equal(
        document.querySelector(`#${id}`).hasAttribute(attr),
        false,
        id,
      );
    backdrop.destroy();
  } finally {
    window.happyDOM.abort();
  }
});

test('restores preexisting role and inline border radius after disabling', () => {
  const window = new Window();
  try {
    const { document } = window;
    document.body.innerHTML = `
      <main><div id="player"><video></video></div>
        <div id="composer">
          <button aria-label="コマンド"></button>
          <div><textarea placeholder="コメントを入力"></textarea>
            <button aria-label="コメント投稿ボタン"></button></div>
        </div>
      </main>`;
    const composer = document.querySelector('#composer');
    composer.setAttribute('data-nico-ambient-backdrop', 'custom-role');
    composer.style.borderRadius = '11px';
    window.eval(`${source}\nglobalThis.makeBackdrop = PageBackdrop;`);
    const backdrop = new window.makeBackdrop(
      document.querySelector('#player'),
      document.querySelector('video'),
    );
    backdrop.update(document.body, true);
    assert.equal(
      composer.getAttribute('data-nico-ambient-backdrop'),
      'surface',
    );
    assert.equal(composer.style.borderRadius, '11px');
    backdrop.update(document.body, false);
    assert.equal(
      composer.getAttribute('data-nico-ambient-backdrop'),
      'custom-role',
    );
    assert.equal(composer.style.borderRadius, '11px');
    backdrop.destroy();
    assert.equal(
      composer.getAttribute('data-nico-ambient-backdrop'),
      'custom-role',
    );
    assert.equal(composer.style.borderRadius, '11px');
  } finally {
    window.happyDOM.abort();
  }
});

test('keeps player shadow resets on repeated updates and restores on disable', () => {
  const window = new Window();
  try {
    const { document } = window;
    document.body.innerHTML =
      '<main><div id="player"><video></video></div></main>';
    const siteStyle = document.createElement('style');
    siteStyle.textContent = '#player { box-shadow: 0 0 10px black; }';
    document.head.append(siteStyle);
    window.eval(`${source}\nglobalThis.makeBackdrop = PageBackdrop;`);
    const player = document.querySelector('#player');
    const backdrop = new window.makeBackdrop(
      player,
      document.querySelector('video'),
    );
    const attr = 'data-nico-ambient-backdrop';
    backdrop.update(document.body, true);
    assert.equal(
      player.getAttribute('data-nico-ambient-effects'),
      'no-box-shadow',
    );
    assert.equal(window.getComputedStyle(player).boxShadow, 'none');
    backdrop.update(document.body, true, true);
    assert.equal(
      player.getAttribute('data-nico-ambient-effects'),
      'no-box-shadow',
    );
    assert.equal(window.getComputedStyle(player).boxShadow, 'none');
    backdrop.update(document.body, false);
    assert.equal(player.hasAttribute(attr), false);
    assert.equal(window.getComputedStyle(player).boxShadow, '0 0 10px black');
    backdrop.destroy();
  } finally {
    window.happyDOM.abort();
  }
});

test('background and shadow effects coexist, stay stable, and restore across fullscreen', () => {
  const window = new Window();
  try {
    const { document } = window;
    document.body.innerHTML =
      '<main class="bg-c_layer.surfaceHighEm" style="background:red;box-shadow:0 0 10px black"><div id="player"><video></video></div><section class="bg-c_layer.surfaceHighEm"></section></main>';
    window.eval(source);
    const main = document.querySelector('main');
    const player = document.querySelector('#player');
    document.body.setAttribute('data-nico-ambient-active', 'original');
    main.setAttribute('data-nico-ambient-effects', 'original');
    const backdrop = new window.PageBackdrop(
      player,
      document.querySelector('video'),
    );
    backdrop.update(document.body, true);
    assert.equal(main.getAttribute('data-nico-ambient-backdrop'), 'surface');
    assert.ok(
      main.getAttribute('data-nico-ambient-effects').includes('no-box-shadow'),
    );
    const first = main.outerHTML;
    backdrop.update(document.body, true, true);
    assert.equal(main.outerHTML, first);
    backdrop.update(player, true);
    assert.equal(main.getAttribute('data-nico-ambient-backdrop'), null);
    assert.equal(main.getAttribute('data-nico-ambient-effects'), 'original');
    assert.equal(player.getAttribute('data-nico-ambient-active'), '');
    backdrop.update(document.body, true);
    assert.equal(player.hasAttribute('data-nico-ambient-active'), false);
    backdrop.destroy();
    assert.equal(
      document.body.getAttribute('data-nico-ambient-active'),
      'original',
    );
    assert.equal(main.getAttribute('data-nico-ambient-effects'), 'original');
  } finally {
    window.happyDOM.abort();
  }
});
