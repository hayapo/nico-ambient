import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

// ビルド前でもテスト一覧を取得できるよう、スクリプトは実行時に読み込む。
export function readContentScript() {
  return readFileSync('dist/content.js', 'utf8');
}

export const playerHtml = `<!doctype html><html><head><meta charset="UTF-8"></head><body style="margin:100px;background:#222">
  <div id="player" style="width:640px;height:396px;background:black">
    <video muted autoplay style="display:block;width:640px;height:360px"></video>
    <div id="controls"><button aria-label="全画面表示する">全画面</button></div>
  </div></body></html>`;

export async function setupPlayer(page: Page) {
  const usePoster = page.context().browser()?.browserType().name() === 'webkit';
  await page.route('https://www.nicovideo.jp/**', (route) =>
    route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: playerHtml,
    }),
  );
  await page.goto('https://www.nicovideo.jp/watch/sm9');
  await expect(
    page.getByRole('button', { name: '全画面表示する', exact: true }),
  ).toHaveCount(1);
  await page.evaluate(async (posterOnly) => {
    const listeners: ((changes: object, area: string) => void)[] = [];
    const stored: Record<string, unknown> = {};
    Object.assign(window, {
      chrome: {
        storage: {
          local: {
            get: async () => stored,
            set: async (values: Record<string, unknown>) => {
              Object.assign(stored, values);
              for (const listener of listeners)
                listener(
                  {
                    nicoAmbientSettings: {
                      newValue: values.nicoAmbientSettings,
                    },
                  },
                  'local',
                );
            },
          },
          onChanged: {
            addListener: (listener: (changes: object, area: string) => void) =>
              listeners.push(listener),
          },
        },
      },
    });
    const source = document.createElement('canvas');
    source.id = 'test-source';
    // WebKitはhiddenのCanvasから生成したストリームで動画フレームを出さない。
    // 描画対象として維持したまま画面外に置く。
    source.style.cssText = 'position:fixed;left:-10000px;top:0';
    document.body.append(source);
    source.width = 320;
    source.height = 180;
    const ctx = source.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 20, 180);
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(300, 0, 20, 180);
    const video = document.querySelector('video');
    if (!video) throw new Error('Missing fixture video');
    if (posterOnly) {
      // WebKitではCanvasキャプチャの動画フレームが得られないため、
      // 同じ画素をポスターに渡してライトの描画経路を検証する。
      video.poster = source.toDataURL();
    } else {
      video.srcObject = source.captureStream(24);
      void video.play().catch(() => {});
    }
  }, usePoster);
  await page.addScriptTag({ content: readContentScript() });
}
