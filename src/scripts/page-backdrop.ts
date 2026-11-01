import backdropStyles from '../styles/page-backdrop.css?inline';
import {
  activeAttribute,
  attribute,
  DesiredBackdrops,
  effectsAttribute,
  restoreElement,
  restoreRadius,
  snapshot,
  writeAttribute,
} from './backdrop/appearance';
import { BackdropCollectors } from './backdrop/collectors';
import { HeaderCollector } from './backdrop/header';
import { excludedBackdropSelector } from './backdrop/selectors';

export class PageBackdrop {
  private readonly collectors = new BackdropCollectors();
  private readonly headers: HeaderCollector;
  private readonly original = new Map<Element, ReturnType<typeof snapshot>>();
  private readonly originalPlayerShadows: Map<
    HTMLElement,
    { box: boolean; drop: boolean }
  >;
  private lastRoot: Element | undefined;
  private lastEnabled: boolean | undefined;
  private dirty: boolean;
  private readonly observer: MutationObserver;
  private readonly style: HTMLStyleElement;
  private readonly player: HTMLElement;
  private readonly video: HTMLVideoElement;

  constructor(player: HTMLElement, video: HTMLVideoElement) {
    this.player = player;
    this.video = video;
    this.headers = new HeaderCollector(player, (element) =>
      this.hasPaintedBackground(element),
    );
    this.originalPlayerShadows = new Map<
      HTMLElement,
      { box: boolean; drop: boolean }
    >();
    this.dirty = true;
    // パネルはプレイヤーの後から追加されるため、初回走査だけでは背景属性が漏れる。
    // DOM変更でキャッシュを無効化し、スクロールを待たず次のフレームで反映する。
    this.observer = new MutationObserver((records) => {
      if (
        records.some(
          (record) =>
            !(
              record.target instanceof Element &&
              record.target.closest('[data-nico-ambient]')
            ),
        )
      )
        this.dirty = true;
    });
    this.observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      // 拡張機能自身の属性やCanvasの毎フレーム更新を監視すると再走査が連鎖するため、
      // ページ構造や背景候補の判定に必要な属性だけを監視する。
      attributeFilter: [
        'class',
        'aria-label',
        'placeholder',
        'data-color-scheme',
        'data-nvpc-scope',
        'data-nvpc-part',
        'data-scope',
        'data-part',
      ],
    });
    this.style = document.createElement('style');
    this.style.textContent = backdropStyles;
    document.head.append(this.style);
  }

  private paintsBackground(
    element: HTMLElement,
    pseudo?: '::before' | '::after',
  ) {
    const style = getComputedStyle(element, pseudo);
    const color = style.backgroundColor.toLowerCase();
    const alpha = color.includes('/')
      ? Number.parseFloat(color.slice(color.lastIndexOf('/') + 1))
      : color.startsWith('rgba(')
        ? Number.parseFloat(color.slice(color.lastIndexOf(',') + 1))
        : 1;
    return (
      (color !== 'transparent' && alpha > 0) || style.backgroundImage !== 'none'
    );
  }

  private hasPaintedBackground(element: HTMLElement) {
    if (this.original.get(element)?.painted) return true;
    const paints =
      this.paintsBackground(element) ||
      this.paintsBackground(element, '::before') ||
      this.paintsBackground(element, '::after');
    return paints;
  }

  private addPlayerShadowResets(desired: DesiredBackdrops) {
    const chain: HTMLElement[] = [];
    for (
      let element: HTMLElement | null = this.player;
      element && element !== document.body;
      element = element.parentElement
    ) {
      chain.push(element);
    }
    if (!chain.includes(this.video)) chain.unshift(this.video);

    for (const element of chain) {
      const pseudos = [undefined, '::before', '::after'] as const;
      const recorded = this.originalPlayerShadows.get(element);
      const box =
        recorded?.box ??
        pseudos.some((pseudo) => {
          const shadow = getComputedStyle(element, pseudo).boxShadow.trim();
          return shadow !== '' && shadow !== 'none';
        });
      const drop =
        recorded?.drop ??
        pseudos.some((pseudo) =>
          getComputedStyle(element, pseudo).filter.includes('drop-shadow('),
        );
      if (box || drop) this.originalPlayerShadows.set(element, { box, drop });
      if (drop) desired.set(element, 'player-drop-shadow');
      else if (box) desired.set(element, 'player-shadow');
    }
  }

  private restore() {
    for (const [element, state] of this.original)
      restoreElement(element, state);
    this.original.clear();
    this.originalPlayerShadows.clear();
  }

  private collectPlayerAndSurfaceRoles(
    root: Element,
    desired: DesiredBackdrops,
  ) {
    desired.set(root, 'root');
    for (
      let parent = this.player.parentElement;
      parent && parent !== root;
      parent = parent.parentElement
    ) {
      if (!root.contains(parent)) break;
      if (this.hasPaintedBackground(parent)) desired.set(parent, 'page-shell');
    }
    this.addPlayerShadowResets(desired);
    this.collectors.collectSurfaceRoles(desired, root);
    this.collectors.collectTagEditOverlayRoles(desired);
    this.collectors.collectCommentComposerRoles(desired);
  }

  private applyDesiredRoles(desired: DesiredBackdrops) {
    for (const [element, state] of this.original) {
      if (desired.has(element)) continue;
      restoreElement(element, state);
      this.original.delete(element);
      if (element instanceof HTMLElement)
        this.originalPlayerShadows.delete(element);
    }
    for (const [element, appearance] of desired) {
      const state = this.original.get(element) ?? snapshot(element);
      this.original.set(element, state);
      state.painted = !!appearance.painted;
      writeAttribute(element, attribute, appearance.backdrop ?? null);
      writeAttribute(element, activeAttribute, appearance.active ? '' : null);
      writeAttribute(
        element,
        effectsAttribute,
        [...appearance.effects].sort().join(' ') || null,
      );
      if (appearance.copyPseudoRadius && element instanceof HTMLElement) {
        const radius = getComputedStyle(element, '::before').borderRadius;
        if (radius && radius !== '0px') {
          element.style.borderRadius = radius;
          state.radiusChanged = true;
        }
      } else restoreRadius(element, state);
    }
  }

  update(root: Element, enabled: boolean, force = false) {
    if (
      !force &&
      !this.dirty &&
      root === this.lastRoot &&
      enabled === this.lastEnabled
    )
      return;
    this.dirty = false;
    this.lastRoot = root;
    this.lastEnabled = enabled;
    const desired = new DesiredBackdrops();
    if (enabled) {
      this.collectPlayerAndSurfaceRoles(root, desired);
      if (root === document.body) {
        this.headers.collectHeaderRoles(desired);
      }
    }
    // ポップアップ類はページ背景として扱うとライトが透けて内容が読みにくくなる。
    // 候補から削除しておけば、閉じたり移動したりした際に古い属性も復元できる。
    for (const element of desired.keys()) {
      if (element.closest(excludedBackdropSelector)) desired.delete(element);
    }
    if (enabled) this.collectors.collectControlRoles(desired);
    for (const element of desired.keys()) {
      if (element !== root && !root.contains(element)) desired.delete(element);
    }
    // 除外対象に区切り線を誤適用しないよう、最終的な背景属性が確定してから効果を追加する。
    for (const [element, appearance] of desired) {
      if (
        appearance.backdrop !== 'clear' ||
        !element.matches('section > header ~ *')
      )
        continue;
      if (
        element.parentElement &&
        desired.get(element.parentElement)?.backdrop === 'surface'
      )
        appearance.effects.add('panel-divider');
    }
    this.applyDesiredRoles(desired);
  }

  destroy() {
    this.observer.disconnect();
    this.restore();
    this.style.remove();
  }
}
