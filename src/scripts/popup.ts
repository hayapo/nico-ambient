import '../styles/popup.css';

const development = import.meta.env.MODE === 'development';
const brandIcon = document.querySelector<HTMLImageElement>('#brand-icon');
const developmentBadge =
  document.querySelector<HTMLSpanElement>('#development-badge');

if (development) {
  document.title = 'Nico Ambient [DEV]';
  if (brandIcon) brandIcon.src = '/icons/icon-48-dev.png';
  if (developmentBadge) developmentBadge.hidden = false;
}

const status = document.querySelector<HTMLParagraphElement>('#runtime-status');

if (status) {
  status.textContent =
    typeof chrome !== 'undefined' && chrome.runtime?.id
      ? `拡張機能として実行中${development ? ' [DEV]' : ''} · v${chrome.runtime.getManifest().version}`
      : 'ブラウザでUIをプレビュー中';
}
