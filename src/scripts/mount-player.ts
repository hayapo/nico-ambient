import { AmbientLight } from './ambient-light';
import type { PlayerTarget } from './player';
import type { SettingsStore } from './settings';
import { SettingsPanel } from './settings-panel';

export function mountPlayer(target: PlayerTarget, store: SettingsStore) {
  const panel = new SettingsPanel(store, target.player);
  target.controls.append(panel.host);
  const light = new AmbientLight(target, store.get, panel.setStatus);
  return {
    ...target,
    host: panel.host,
    sync: panel.sync,
    destroy() {
      light.destroy();
      panel.destroy();
    },
  };
}
