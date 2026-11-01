import type { DesiredBackdrops } from './appearance';

const HEADER_WIDTH_RATIO = 0.8;
const HEADER_MAX_HEIGHT = 120;
const POSITION_TOLERANCE = 1;

export class HeaderCollector {
  constructor(
    private player: HTMLElement,
    private hasPaintedBackground: (element: HTMLElement) => boolean,
  ) {}

  collectHeaderRoles(desired: DesiredBackdrops) {
    const headers = document.querySelectorAll<HTMLElement>(
      'common-header, #common-header, .common-header, #CommonHeader, .nico-CommonHeaderRoot, #PcHeader, #pc-header, .pc-header, .pcHeader, .PCHeader, header, [role="banner"], [data-name="header"]',
    );
    for (const header of headers) {
      if (this.player.contains(header) || this.isSticky(header)) continue;
      if (!desired.has(header) && this.hasPaintedBackground(header))
        desired.setFallback(header, 'page-shell');
      if (
        header.matches(
          'common-header, #common-header, .common-header, #CommonHeader, .nico-CommonHeaderRoot, #PcHeader, #pc-header, .pc-header, .pcHeader, .PCHeader',
        )
      ) {
        if (this.hasPaintedBackground(header))
          desired.set(header, 'header-surface');
        const headerBox = header.getBoundingClientRect();
        const headerWidth = headerBox.width || window.innerWidth;
        for (const surface of header.querySelectorAll<HTMLElement>(
          'div, nav, header',
        )) {
          if (
            surface.closest(
              '[role="menu"], [role="dialog"], [role="listbox"], [popover], button, a',
            )
          )
            continue;
          const box = surface.getBoundingClientRect();
          if (
            box.width < headerWidth * HEADER_WIDTH_RATIO ||
            box.height <= 0 ||
            box.height > HEADER_MAX_HEIGHT ||
            box.top < headerBox.top - POSITION_TOLERANCE ||
            box.bottom > headerBox.top + HEADER_MAX_HEIGHT
          )
            continue;
          if (this.hasPaintedBackground(surface))
            desired.set(surface, 'header-surface');
        }
      }
      // 検索欄の祖先だけをページシェル化し、入力欄や無関係なポップアップの背景を壊さない。
      for (const input of header.querySelectorAll(
        'input[type="search"], input[name="search"], input[name="q"], input[placeholder*="検索"]',
      )) {
        for (
          let element = input.parentElement;
          element && element !== header;
          element = element.parentElement
        ) {
          if (!desired.has(element) && this.hasPaintedBackground(element))
            desired.setFallback(element, 'page-shell');
        }
      }
      for (const searchButton of header.querySelectorAll<HTMLElement>(
        'form[role="search"] button[aria-label="検索"]',
      )) {
        desired.set(searchButton, 'surface-clear');
      }
      // 通常のヘッダー背景を透明化するとバナー背後のグラデーションだけが残るため、
      // custombannerリンクの行にあるフェードもページシェル化する。
      for (const bannerLink of header.querySelectorAll<HTMLAnchorElement>(
        'a[data-anchor-area="web_header"][data-anchor-href*="custombanner"]',
      )) {
        const bannerRow = bannerLink.parentElement?.parentElement;
        const backgroundFade = bannerRow?.querySelector<HTMLElement>(
          ':scope > div[style*="linear-gradient"]',
        );
        if (backgroundFade && this.hasPaintedBackground(backgroundFade))
          desired.set(backgroundFade, 'page-shell');
      }
    }
  }

  private isSticky(header: HTMLElement) {
    const candidates: HTMLElement[] = [header];
    for (const element of [
      header,
      ...header.querySelectorAll<HTMLElement>('*'),
    ]) {
      candidates.push(element);
      if (element.shadowRoot) {
        candidates.push(
          ...element.shadowRoot.querySelectorAll<HTMLElement>('*'),
        );
      }
    }
    for (
      let element: HTMLElement | null = header;
      element && element !== document.body;
      element = element.parentElement
    ) {
      const position = getComputedStyle(element).position;
      if (position === 'fixed' && window.scrollY > 1) return true;
      if (position === 'sticky') {
        const top = Number.parseFloat(getComputedStyle(element).top) || 0;
        const rect = element.getBoundingClientRect();
        if (window.scrollY > 1 && rect.top <= top + 1 && rect.bottom > top)
          return true;
      }
    }
    for (const element of candidates) {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.position === 'fixed' && window.scrollY > 1) return true;
      if (style.position === 'sticky') {
        const top = Number.parseFloat(style.top) || 0;
        if (window.scrollY > 1 && rect.top <= top + 1 && rect.bottom > top)
          return true;
      }
    }
    // sticky判定対象がShadow DOM内にあると通常の祖先走査では見つからない場合がある。
    // その場合はホストの高さを越えてスクロールしたかで固定状態を補助判定する。
    const rect = header.getBoundingClientRect();
    return (
      window.scrollY > header.offsetHeight && rect.top <= 1 && rect.bottom > 0
    );
  }
}
