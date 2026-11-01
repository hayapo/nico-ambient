import { createEdgeField } from './edge-field';
import { FIELD_SIZE, lightGeometry } from './light-geometry';
import { PageBackdrop } from './page-backdrop';
import type { PlayerTarget } from './player';
import type { Settings } from './settings';

export class AmbientLight {
  private readonly layer: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly backdrop: PageBackdrop;
  private readonly context: CanvasRenderingContext2D | null;
  private frame: number;
  private lastTime: number;
  private lastSource: string;
  private lastGeometry: string;
  private lastInput: CanvasImageSource | undefined;
  private hasRenderedVideo: boolean;
  private posterUrl: string;
  private poster: HTMLImageElement | undefined;
  private readonly drawField: ReturnType<typeof createEdgeField> | null;
  private failed: boolean;
  private readonly video: HTMLVideoElement;
  private readonly getSettings: () => Settings;
  private readonly setStatus: (message: string) => void;
  private readonly onViewportChange = () => this.update(true);

  constructor(
    target: PlayerTarget,
    getSettings: () => Settings,
    setStatus: (message: string) => void,
  ) {
    this.video = target.video;
    this.getSettings = getSettings;
    this.setStatus = setStatus;
    this.layer = document.createElement('div');
    this.layer.dataset.nicoAmbient = 'light';
    this.layer.setAttribute('aria-hidden', 'true');
    this.layer.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:-1;overflow:hidden;';
    this.canvas = document.createElement('canvas');
    this.canvas.width = FIELD_SIZE.width;
    this.canvas.height = FIELD_SIZE.height;
    this.canvas.style.cssText = 'width:100%;height:100%;display:block;';
    this.layer.append(this.canvas);
    this.backdrop = new PageBackdrop(target.player, target.video);
    this.context = this.canvas.getContext('2d');
    this.frame = 0;
    this.lastTime = -1;
    this.lastSource = '';
    this.lastGeometry = '';
    this.hasRenderedVideo = false;
    this.posterUrl = '';
    this.drawField = this.context ? createEdgeField(this.context) : null;
    this.failed = false;

    window.addEventListener('scroll', this.onViewportChange, {
      capture: true,
      passive: true,
    });
    document.addEventListener('scroll', this.onViewportChange, {
      capture: true,
      passive: true,
    });
    window.addEventListener('resize', this.onViewportChange, { passive: true });
    window.visualViewport?.addEventListener('scroll', this.onViewportChange, {
      passive: true,
    });
    window.visualViewport?.addEventListener('resize', this.onViewportChange, {
      passive: true,
    });
    this.update(true);
    this.frame = window.requestAnimationFrame(this.renderFrame);
  }

  private update(checkBackdrop = false) {
    const settings = this.getSettings();
    // コントローラーの親要素は動画より大きいことがあり、それを基準にすると光の境界がずれる。
    // 動画自身の矩形を使い、右端や下端に光のない帯が残るのを防ぐ。
    const rect = this.video.getBoundingClientRect();
    const fullscreen = document.fullscreenElement;
    const destination = fullscreen?.contains(this.video)
      ? fullscreen
      : document.body;
    if (this.layer.parentElement !== destination)
      destination.append(this.layer);
    const visible = settings.enabled && settings.spread > 0 && !document.hidden;
    // 要素の表示・非表示で基準位置を切り替えるとスクロール時に光が跳ねるため、常に動画の位置を使う。
    // 距離マスクで画面外の光を自然に弱め、PiP中はページに光だけが残らないよう描画を止める。
    if (this.video.poster !== this.posterUrl) {
      this.posterUrl = this.video.poster;
      this.poster = undefined;
      if (this.posterUrl) {
        this.poster = document.createElement('img');
        this.poster.crossOrigin = 'anonymous';
        this.poster.src = this.posterUrl;
      }
    }
    if (this.lastSource !== this.video.currentSrc) {
      this.lastSource = this.video.currentSrc;
      this.failed = false;
      this.hasRenderedVideo = false;
      this.lastTime = -1;
      this.setStatus('設定は自動保存されます。');
    }
    const videoFrameReady =
      !this.video.seeking &&
      this.video.readyState >= 2 &&
      this.video.videoWidth > 0 &&
      this.video.videoHeight > 0;
    const input = videoFrameReady
      ? this.video
      : !this.hasRenderedVideo &&
          this.poster?.complete &&
          this.poster.naturalWidth &&
          this.poster.naturalHeight
        ? this.poster
        : undefined;
    const canShow =
      visible &&
      document.pictureInPictureElement !== this.video &&
      rect.width > 0 &&
      rect.height > 0 &&
      !this.failed;
    if (!canShow || !this.context || !this.drawField) {
      this.layer.hidden = true;
      this.backdrop.update(destination, false, checkBackdrop);
      return;
    }
    const projection = lightGeometry(
      rect,
      settings.spread,
      settings.brightness,
    );
    Object.assign(this.layer.style, projection.layerStyle);
    Object.assign(this.canvas.style, projection.canvasStyle);
    if (!input) {
      // シーク中は一時的にフレームを取得できないため、直前の光を維持する。
      // ポスターへ戻すとちらつき、レイヤーを隠すと光に隙間ができる。
      if (this.hasRenderedVideo) {
        this.layer.hidden = false;
        this.backdrop.update(destination, true, checkBackdrop);
      } else {
        this.layer.hidden = true;
        this.backdrop.update(destination, false, checkBackdrop);
      }
      return;
    }
    // 位置だけの変化では映像サンプルを描き直す必要がないため、同じ入力と形状なら既存の光を再利用する。
    // 幅・高さ・spreadが変われば停止中でも投影の形が変わるため再描画する。
    const geometry = `${rect.width},${rect.height},${settings.spread}`;
    if (
      input === this.lastInput &&
      (input !== this.video || this.video.currentTime === this.lastTime) &&
      geometry === this.lastGeometry
    ) {
      this.layer.hidden = false;
      this.backdrop.update(destination, true, checkBackdrop);
      return;
    }
    try {
      this.drawField(input, projection.field);
      if (input === this.video) this.hasRenderedVideo = true;
      this.lastInput = input;
      this.lastGeometry = geometry;
      this.lastTime = this.video.currentTime;
      // 描画前にページ背景を透明化すると一瞬だけ下地が抜けるため、画素を用意してからレイヤーを表示する。
      this.layer.hidden = false;
      this.backdrop.update(destination, true, checkBackdrop);
    } catch {
      this.layer.hidden = true;
      this.backdrop.update(destination, false, checkBackdrop);
      if (input !== this.video) {
        // ポスター取得の失敗は動画フレームの描画可否とは無関係なので、動画のライト機能自体は維持する。
        this.poster = undefined;
        return;
      }
      this.failed = true;
      this.setStatus('この動画では光を描画できません。');
    }
  }

  private renderFrame = () => {
    this.update();
    this.frame = window.requestAnimationFrame(this.renderFrame);
  };

  destroy() {
    window.cancelAnimationFrame(this.frame);
    window.removeEventListener('scroll', this.onViewportChange, true);
    document.removeEventListener('scroll', this.onViewportChange, true);
    window.removeEventListener('resize', this.onViewportChange);
    window.visualViewport?.removeEventListener('scroll', this.onViewportChange);
    window.visualViewport?.removeEventListener('resize', this.onViewportChange);
    this.layer.remove();
    this.backdrop.destroy();
  }
}
