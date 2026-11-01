import '../styles/popup.css';

const status = document.querySelector<HTMLParagraphElement>('#runtime-status');

if (status) {
  status.textContent =
    typeof chrome !== 'undefined' && chrome.runtime?.id
      ? `拡張機能として実行中 · v${chrome.runtime.getManifest().version}`
      : 'ブラウザでUIをプレビュー中';
}
