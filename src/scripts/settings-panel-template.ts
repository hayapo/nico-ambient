import extensionIcon from '../../public/icons/icon-16.png?inline';
import settingsStyles from '../styles/settings.css?inline';
import { NUMERIC_SETTINGS } from './settings';

const development = import.meta.env.MODE === 'development';
const settingsName = `Nico Ambient${development ? ' [DEV]' : ''}の設定`;

export const settingsPanelTemplate = `<style>${settingsStyles}</style>
<button id="toggle" type="button" title="${settingsName}" aria-label="${settingsName}" aria-expanded="false" aria-controls="panel"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4L19 5"/></svg><img class="brand-icon" src="${extensionIcon}" alt="" aria-hidden="true">${development ? '<span class="development-badge" aria-hidden="true">DEV</span>' : ''}</button>
<section id="panel" popover="auto" aria-label="${settingsName}">
  <header><strong>${settingsName}</strong><button id="close" type="button" aria-label="閉じる">×</button></header>
  <div class="setting"><label for="enabled">ライトを有効にする</label><input id="enabled" type="checkbox" role="switch" aria-describedby="enabled-description"><p id="enabled-description" class="setting-description">動画の色をプレイヤーの周囲に表示します。</p></div>
  <div class="setting"><label for="brightness">光の明るさ</label><div class="numeric-control"><input id="brightness-value" type="number" min="${NUMERIC_SETTINGS.brightness.min}" max="${NUMERIC_SETTINGS.brightness.max}" step="${NUMERIC_SETTINGS.brightness.step}" aria-label="光の明るさの数値" aria-describedby="brightness-description">%</div><input id="brightness" aria-label="光の明るさ" aria-describedby="brightness-description" type="range" min="${NUMERIC_SETTINGS.brightness.min}" max="${NUMERIC_SETTINGS.brightness.max}" step="${NUMERIC_SETTINGS.brightness.step}"><p id="brightness-description" class="setting-description">周囲に表示する光の明るさを調整します。</p></div>
  <div class="setting"><label for="spread">光の広がり</label><div class="numeric-control"><input id="spread-value" type="number" min="${NUMERIC_SETTINGS.spread.min}" max="${NUMERIC_SETTINGS.spread.max}" step="${NUMERIC_SETTINGS.spread.step}" aria-label="光の広がりの数値" aria-describedby="spread-description">%</div><input id="spread" aria-label="光の広がり" aria-describedby="spread-description" type="range" min="${NUMERIC_SETTINGS.spread.min}" max="${NUMERIC_SETTINGS.spread.max}" step="${NUMERIC_SETTINGS.spread.step}"><p id="spread-description" class="setting-description">プレイヤーから光が広がる範囲を調整します。</p></div>
  <p id="status" role="status">設定は自動保存されます。</p>
</section>`;
