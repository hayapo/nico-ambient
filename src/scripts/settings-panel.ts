import { panelLayout } from './panel-position';
import type { SettingsStore } from './settings';
import { settingsPanelTemplate } from './settings-panel-template';

const SAVE_DELAY = 150;

export class SettingsPanel {
  readonly host: HTMLSpanElement;
  private readonly shadow: ShadowRoot;
  private readonly button: HTMLButtonElement;
  private readonly panel: HTMLElement;
  private readonly status: HTMLElement;
  private saveTimer: number;
  private positionFrame: number;
  private readonly store: SettingsStore;
  private readonly player: HTMLElement;

  constructor(store: SettingsStore, player: HTMLElement) {
    this.store = store;
    this.player = player;
    this.host = document.createElement('span');
    this.host.dataset.nicoAmbient = 'settings';
    this.host.style.cssText =
      'display:inline-flex;align-items:center;justify-content:center;align-self:center;vertical-align:middle;flex-shrink:0;line-height:0;';
    this.shadow = this.host.attachShadow({ mode: 'open' });
    this.shadow.innerHTML = settingsPanelTemplate;

    this.button = this.required<HTMLButtonElement>('#toggle');
    this.panel = this.required<HTMLElement>('#panel');
    this.status = this.required<HTMLElement>('#status');

    this.saveTimer = 0;

    this.sync();

    this.panel.addEventListener('input', this.handleInput);

    for (const name of ['brightness', 'spread'] as const) {
      const input = this.required<HTMLInputElement>(`#${name}-value`);
      input.addEventListener('focus', () => input.select());
      input.addEventListener('blur', () => {
        input.value = String(this.store.get()[name]);
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          input.blur();
        }
      });
    }

    for (const event of ['click', 'pointerdown', 'keydown', 'keyup']) {
      this.host.addEventListener(event, (e) => e.stopPropagation());
    }
    this.positionFrame = 0;

    this.button.addEventListener('click', () => {
      this.panel.togglePopover();
      this.updatePosition();
    });
    this.panel.addEventListener('toggle', () => {
      const open = this.panel.matches(':popover-open');
      this.button.setAttribute('aria-expanded', String(open));
      window.cancelAnimationFrame(this.positionFrame);
      if (open) this.trackPosition();
    });
    this.required('#close').addEventListener('click', () => {
      this.close();
    });
    this.panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.close();
      }
    });
  }

  private scheduleSave() {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(this.save, SAVE_DELAY);
  }

  private readonly handleInput = (event: Event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.type === 'number') {
      if (input.value === '' || !Number.isFinite(input.valueAsNumber)) return;
      const name = input.id === 'brightness-value' ? 'brightness' : 'spread';
      this.store.set({ ...this.store.get(), [name]: input.valueAsNumber });
      this.sync();
      this.scheduleSave();
      return;
    }
    this.store.set({
      enabled: this.required<HTMLInputElement>('#enabled').checked,
      brightness: Number(this.required<HTMLInputElement>('#brightness').value),
      spread: Number(this.required<HTMLInputElement>('#spread').value),
    });
    this.sync();
    this.scheduleSave();
  };

  private close() {
    this.panel.hidePopover();
    this.button.focus();
  }

  private required<T extends Element = HTMLElement>(selector: string): T {
    const element = this.shadow.querySelector<T>(selector);
    if (!element) throw new Error(`Missing settings element: ${selector}`);
    return element;
  }

  readonly sync = () => {
    const settings = this.store.get();
    this.required<HTMLInputElement>('#enabled').checked = settings.enabled;
    for (const name of ['brightness', 'spread'] as const) {
      this.required<HTMLInputElement>(`#${name}`).value = String(
        settings[name],
      );
      if (this.shadow.activeElement?.id !== `${name}-value`) {
        this.required<HTMLInputElement>(`#${name}-value`).value = String(
          settings[name],
        );
      }
    }
  };

  private readonly save = () => {
    void this.store.save().catch(() => {
      this.status.textContent =
        '設定を保存できませんでした。ページを再読み込みしてください。';
    });
  };

  private updatePosition() {
    const rect = this.player.getBoundingClientRect();
    const layout = panelLayout(rect, innerWidth, innerHeight);
    this.panel.style.maxWidth = layout.maxWidth;
    this.panel.style.maxHeight = layout.maxHeight;
    Object.assign(
      this.panel.style,
      layout.position(this.panel.getBoundingClientRect()),
    );
  }

  private readonly trackPosition = () => {
    this.updatePosition();
    this.positionFrame = window.requestAnimationFrame(this.trackPosition);
  };

  readonly setStatus = (message: string) => {
    this.status.textContent = message;
  };

  destroy() {
    window.cancelAnimationFrame(this.positionFrame);
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
      this.save();
    }
    this.host.remove();
  }
}
