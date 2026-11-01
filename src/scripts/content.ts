import { mountPlayer } from './mount-player';
import { findPlayer } from './player';
import { createSettingsStore, SETTINGS_KEY } from './settings';

const RECONCILE_INTERVAL = 1000;

function start() {
  if (location.hostname !== 'www.nicovideo.jp') return;
  const store = createSettingsStore();
  let current: ReturnType<typeof mountPlayer> | undefined;
  let settingsReady = false;
  let pendingFrame = 0;

  function reconcile() {
    if (!settingsReady) return;
    if (!/^\/watch\/[^/]+\/?$/.test(location.pathname)) {
      current?.destroy();
      current = undefined;
      return;
    }
    if (
      current?.video.isConnected &&
      current.host.isConnected &&
      current.controls.contains(current.host) &&
      current.player.contains(current.video)
    )
      return;
    current?.destroy();
    current = undefined;
    const target = findPlayer();
    if (target) current = mountPlayer(target, store);
  }
  function scheduleReconcile() {
    if (pendingFrame) return;
    pendingFrame = window.requestAnimationFrame(() => {
      pendingFrame = 0;
      reconcile();
    });
  }
  // document_start時点ではbodyやプレイヤーが未生成なのでdocument全体を監視する。
  // 操作部の追加をポーリング任せにすると反映が遅れるため、DOM変更ですぐ再検出する。
  const observer = new MutationObserver(scheduleReconcile);
  function observePage() {
    observer.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'aria-label', 'title'],
    });
  }
  observePage();
  const onSettingsReady = () => {
    settingsReady = true;
    reconcile();
  };
  void store.load().then(onSettingsReady, onSettingsReady);
  document.addEventListener('loadedmetadata', scheduleReconcile, true);
  document.addEventListener('loadeddata', scheduleReconcile, true);
  window.addEventListener('resize', scheduleReconcile, { passive: true });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[SETTINGS_KEY]) {
      store.set(changes[SETTINGS_KEY].newValue);
      current?.sync();
    }
  });
  // DOM変更なしでURLだけ変わるSPA遷移もあるため、MutationObserverを補う低頻度の確認を続ける。
  window.setInterval(reconcile, RECONCILE_INTERVAL);
  window.addEventListener('pagehide', () => {
    observer.disconnect();
    window.cancelAnimationFrame(pendingFrame);
    pendingFrame = 0;
    current?.destroy();
    current = undefined;
  });
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    observePage();
    scheduleReconcile();
  });
}
start();
