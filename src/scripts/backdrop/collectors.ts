import type { BackdropRole, DesiredBackdrops } from './appearance';
import {
  ambientSurfaceSelector,
  controllerSelector,
  excludedPopupContainerSelector,
} from './selectors';

export class BackdropCollectors {
  collectSurfaceRoles(desired: DesiredBackdrops, root: Element) {
    for (const surface of document.querySelectorAll<HTMLElement>(
      ambientSurfaceSelector,
    )) {
      // 入れ子のsurfaceを個別にぼかすと重なって不自然になるため、外側だけをぼかす。
      // 内側は透明にし、展開された内容の背後にもプレイヤー由来の光を通す。
      if (surface !== root && !root.contains(surface)) continue;
      const ancestor = surface.parentElement?.closest(ambientSurfaceSelector);
      const hasSurfaceAncestor = ancestor && root.contains(ancestor);
      desired.set(surface, hasSurfaceAncestor ? 'surface-clear' : 'surface');
    }

    for (const controller of document.querySelectorAll(controllerSelector)) {
      desired.set(controller, 'surface-clear');
    }
  }

  collectTagEditOverlayRoles(desired: DesiredBackdrops) {
    // タグ編集オーバーレイはボタンの兄弟なので、ボタンだけを対象にすると描画順で隠れてしまう。
    // オーバーレイ自身を対象にして、暗転がタグ表示より前面に出るようにする。
    for (const tagEdit of document.querySelectorAll<HTMLElement>(
      '[class~="grid-area_[bottom]"] [data-element-name="tag_edit"]',
    )) {
      for (const overlay of tagEdit.parentElement?.querySelectorAll<HTMLElement>(
        ':scope > div[class~="bg-c_layer.contentOverlay"]',
      ) ?? []) {
        if (overlay.querySelector('p')?.textContent?.includes('タグ編集中'))
          desired.set(overlay, 'surface-overlay');
      }
    }
  }

  collectCommentComposerRoles(desired: DesiredBackdrops) {
    const labeledSurfaces = [
      ...document.querySelectorAll<HTMLElement>(
        '[aria-label="コマンド"], [aria-label="コメントを入力"], textarea[placeholder="コメントを入力"], [aria-label="コメント投稿ボタン"]',
      ),
    ];
    const command = document.querySelector<HTMLElement>(
      '[aria-label="コマンド"]',
    );
    const commentInput = document.querySelector<HTMLElement>(
      '[aria-label="コメントを入力"], textarea[placeholder="コメントを入力"]',
    );
    const submit = document.querySelector<HTMLElement>(
      '[aria-label="コメント投稿ボタン"]',
    );
    if (command && commentInput && submit) {
      let group: HTMLElement | null = command;
      while (
        group &&
        ![command, commentInput, submit].every((element) =>
          group?.contains(element),
        )
      ) {
        group = group.parentElement;
      }
      if (group && group !== document.body) {
        desired.set(group, 'surface-group');
        if (commentInput.parentElement)
          desired.set(commentInput.parentElement, 'surface-divider');
        for (const surface of group.querySelectorAll<HTMLElement>(
          ambientSurfaceSelector,
        )) {
          desired.set(surface, 'surface-clear');
        }
        // ログアウト時のcontentOverlayは不透明な背景でライトを覆うため、透明化して光を通す。
        for (const overlay of group.querySelectorAll<HTMLElement>(
          '[class~="bg-c_layer.contentOverlay"]',
        )) {
          desired.set(overlay, 'surface-clear');
        }
        for (const surface of labeledSurfaces) {
          if (group.contains(surface)) desired.set(surface, 'surface-clear');
        }
      }
    }
  }

  collectControlRoles(desired: DesiredBackdrops) {
    // surface走査だけでは背景クラスのない操作部を拾えないため、対象ボタンを明示的に追加する。
    // ポップアップ内まで追加すると除外設定が崩れるので、除外コンテナー内は登録しない。
    const setPageControlRole = (element: HTMLElement, role: BackdropRole) => {
      if (!element.closest(excludedPopupContainerSelector))
        desired.set(element, role);
    };
    for (const trigger of document.querySelectorAll<HTMLElement>(
      '[class~="h_watchActionbar.height"] [data-part="trigger"], [class~="h_watchActionbar.height"] [data-element-name="share"], [class~="grid-area_[bottom]"] [data-part="trigger"], [class~="grid-area_[bottom]"] [data-element-name="creator_support"], [class~="grid-area_[bottom]"] [data-element-name="tag_edit"]',
    )) {
      setPageControlRole(trigger, 'surface-soft');
    }
    for (const tag of document.querySelectorAll<HTMLElement>(
      '[class~="grid-area_[bottom]"] [data-anchor-area="tags"], [class~="grid-area_[bottom]"] [data-element-area="tags"], [class~="grid-area_[bottom]"] [data-element-name="tag_edit"]',
    )) {
      setPageControlRole(tag, 'surface');
    }
    for (const trigger of document.querySelectorAll<HTMLElement>(
      '[data-scope="tabs"][data-part="list"] [data-part="trigger"]',
    )) {
      setPageControlRole(trigger, 'surface');
    }
    for (const element of document.querySelectorAll<HTMLElement>(
      '[data-element-name="featured_comment_button_click"], [data-scope="tabs"][data-part="list"] [data-part="trigger"][aria-selected="true"]',
    )) {
      setPageControlRole(element, 'surface');
    }
  }
}
