export const attribute = 'data-nico-ambient-backdrop';
export const activeAttribute = 'data-nico-ambient-active';
export const effectsAttribute = 'data-nico-ambient-effects';
export type BackdropRole =
  | 'root'
  | 'page-shell'
  | 'header-surface'
  | 'surface'
  | 'surface-clear'
  | 'surface-group'
  | 'surface-divider'
  | 'surface-overlay'
  | 'surface-soft'
  | 'player-shadow'
  | 'player-drop-shadow';
export type Appearance = {
  backdrop?: 'clear' | 'surface' | 'soft';
  effects: Set<string>;
  active?: boolean;
  copyPseudoRadius?: boolean;
  painted?: boolean;
};

// 後から見つかった役割で背景を上書きしつつ、先に加えた効果は失わない。
// 既存の役割を優先したい場合はsetFallbackではなくhas()を使って明示的に判定する。
export class DesiredBackdrops extends Map<Element, Appearance> {
  setFallback(element: Element, role: BackdropRole) {
    if (!this.has(element)) this.set(element, role);
  }

  override set(element: Element, value: Appearance | BackdropRole): this {
    if (typeof value !== 'string') return super.set(element, value);
    const state = this.get(element) ?? { effects: new Set<string>() };
    switch (value) {
      case 'root':
        state.active = true;
        break;
      case 'page-shell':
      case 'header-surface':
        state.backdrop = 'clear';
        state.painted = true;
        state.copyPseudoRadius = false;
        state.effects.add('clear-pseudos');
        if (value === 'header-surface') {
          state.effects.add('no-box-shadow');
          state.effects.add('header-links');
        }
        break;
      case 'surface':
      case 'surface-group':
      case 'surface-soft':
      case 'surface-clear':
        state.backdrop =
          value === 'surface-soft'
            ? 'soft'
            : value === 'surface-clear'
              ? 'clear'
              : 'surface';
        // 後からsurface化しても元々背景があった事実は復元判定に必要なので、履歴を保持する。
        state.copyPseudoRadius = value === 'surface-group';
        break;
      case 'surface-divider':
        state.effects.add('divider');
        break;
      case 'surface-overlay':
        state.effects.add('overlay');
        break;
      case 'player-drop-shadow':
        state.effects.add('no-filter');
        state.effects.add('no-box-shadow');
        break;
      case 'player-shadow':
        state.effects.add('no-box-shadow');
        break;
    }
    return super.set(element, state);
  }
}

const corners = [
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
] as const;

export function snapshot(element: Element) {
  return {
    attrs: [attribute, activeAttribute, effectsAttribute].map(
      (name) => [name, element.getAttribute(name)] as const,
    ),
    radius:
      element instanceof HTMLElement
        ? corners.map(
            (name) =>
              [
                name,
                element.style.getPropertyValue(name),
                element.style.getPropertyPriority(name),
              ] as const,
          )
        : [],
    radiusChanged: false,
    painted: false,
  };
}

export function restoreRadius(
  element: Element,
  state: ReturnType<typeof snapshot>,
) {
  if (element instanceof HTMLElement && state.radiusChanged) {
    for (const [name, value, priority] of state.radius) {
      if (value) element.style.setProperty(name, value, priority);
      else element.style.removeProperty(name);
    }
    state.radiusChanged = false;
  }
}

export function restoreElement(
  element: Element,
  state: ReturnType<typeof snapshot>,
) {
  for (const [name, value] of state.attrs) writeAttribute(element, name, value);
  restoreRadius(element, state);
}

export function writeAttribute(
  element: Element,
  name: string,
  value: string | null,
) {
  if (element.getAttribute(name) === value) return;
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}
