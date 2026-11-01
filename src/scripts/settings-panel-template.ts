import settingsStyles from '../styles/settings.css?inline';
import { NUMERIC_SETTINGS } from './settings';

export const settingsPanelTemplate = `<style>${settingsStyles}</style>
<button id="toggle" type="button" title="アンビエントライトの設定" aria-label="アンビエントライトの設定" aria-expanded="false" aria-controls="panel"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4L19 5"/></svg></button>
<section id="panel" popover="auto" aria-label="アンビエントライトの設定">
  <header><strong>アンビエントライト</strong><button id="close" type="button" aria-label="閉じる">×</button></header>
  <label><input id="enabled" type="checkbox"> 有効にする</label>
  <label>明るさ <input id="brightness-value" type="number" min="${NUMERIC_SETTINGS.brightness.min}" max="${NUMERIC_SETTINGS.brightness.max}" step="${NUMERIC_SETTINGS.brightness.step}" aria-label="明るさの数値">%<input id="brightness" aria-label="明るさ" type="range" min="${NUMERIC_SETTINGS.brightness.min}" max="${NUMERIC_SETTINGS.brightness.max}" step="${NUMERIC_SETTINGS.brightness.step}"></label>
  <label>広がり <input id="spread-value" type="number" min="${NUMERIC_SETTINGS.spread.min}" max="${NUMERIC_SETTINGS.spread.max}" step="${NUMERIC_SETTINGS.spread.step}" aria-label="広がりの数値">%<input id="spread" aria-label="広がり" type="range" min="${NUMERIC_SETTINGS.spread.min}" max="${NUMERIC_SETTINGS.spread.max}" step="${NUMERIC_SETTINGS.spread.step}"></label>
  <p id="status" role="status">設定は自動保存されます。</p>
</section>`;
