const MIN_VIDEO_WIDTH = 200;
const MIN_VIDEO_HEIGHT = 100;
const MAX_CONTROL_DEPTH = 10;
export function findPlayer() {
  const videos = [...document.querySelectorAll('video')]
    .filter((video) => {
      const box = video.getBoundingClientRect();
      return box.width > MIN_VIDEO_WIDTH && box.height > MIN_VIDEO_HEIGHT;
    })
    .sort(
      (a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight,
    );
  for (const video of videos) {
    let parent = video.parentElement;
    // 動画だけを基準にすると操作部を拾えず、ライトや設定UIの配置先を決められないため両方を含む祖先を探す。
    for (
      let depth = 0;
      parent && parent !== document.body && depth < MAX_CONTROL_DEPTH;
      depth++, parent = parent.parentElement
    ) {
      const anchor = parent.querySelector<HTMLElement>(
        'button[aria-label*="全画面"], button[aria-label*="fullscreen" i], ' +
          'button[title*="全画面"], [data-name="fullscreen"] button, .FullScreenButton',
      );
      if (anchor?.parentElement)
        return { video, player: parent, controls: anchor.parentElement };
    }
  }
  return undefined;
}

export type PlayerTarget = NonNullable<ReturnType<typeof findPlayer>>;
