import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const script = readFileSync('dist/content.js', 'utf8');
const fixture = `<!doctype html><html><head><meta charset="UTF-8"></head><body style="margin:100px;background:#222">
  <div id="player" style="width:640px;height:396px;background:black">
    <video muted autoplay style="display:block;width:640px;height:360px"></video>
    <div id="controls"><button aria-label="全画面表示する">全画面</button></div>
  </div></body></html>`;

test.beforeEach(async ({ page }) => {
  await page.route('https://www.nicovideo.jp/**', (route) =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: fixture }),
  );
  await page.goto('https://www.nicovideo.jp/watch/sm9');
  await expect(
    page.getByRole('button', { name: '全画面表示する', exact: true }),
  ).toHaveCount(1);
  await page.evaluate(async () => {
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
    source.hidden = true;
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
    video.srcObject = source.captureStream(24);
    await video.play();
  });
  await page.addScriptTag({ content: script });
});

test('adds controls, draws video edges, and persists settings', async ({
  page,
}) => {
  const toggle = page.getByRole('button', { name: 'アンビエントライトの設定' });
  await expect(toggle).toHaveCount(1);
  await expect(
    page.locator('#controls [data-nico-ambient=settings]'),
  ).toHaveCount(1);
  const light = page.locator('[data-nico-ambient=light]');
  await expect(light).toBeVisible();
  await expect
    .poll(() =>
      light.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context unavailable');
        return [
          Array.from(ctx.getImageData(0, 32, 1, 1).data),
          Array.from(ctx.getImageData(95, 32, 1, 1).data),
        ];
      }),
    )
    .toEqual([
      [255, 0, 0, 255],
      [0, 0, 255, 255],
    ]);
  await expect(light).toHaveCSS('pointer-events', 'none');
  await toggle.click();
  await page.getByLabel('有効にする').uncheck();
  await expect(light).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await chrome.storage.local.get('nicoAmbientSettings'))
            .nicoAmbientSettings?.enabled,
      ),
    )
    .toBe(false);
  await page.getByLabel('有効にする').check();
  await expect(light).toBeVisible();
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('cleans up on SPA navigation and attaches once when returning', async ({
  page,
}) => {
  await expect(page.locator('[data-nico-ambient=settings]')).toHaveCount(1);
  await page.evaluate(() => history.pushState({}, '', '/ranking'));
  await expect(page.locator('[data-nico-ambient]')).toHaveCount(0);
  await page.evaluate(() => history.pushState({}, '', '/watch/sm9'));
  await expect(page.locator('[data-nico-ambient=settings]')).toHaveCount(1);
  await expect(page.locator('[data-nico-ambient=light]')).toHaveCount(1);
  await page.evaluate(() => {
    const controls = document.querySelector('#controls');
    if (!controls) throw new Error('Missing fixture controls');
    controls.replaceChildren(
      Object.assign(document.createElement('button'), {
        ariaLabel: '全画面表示する',
      }),
    );
  });
  await expect(page.locator('[data-nico-ambient=settings]')).toHaveCount(1);
  await expect(page.locator('[data-nico-ambient=light]')).toHaveCount(1);
});

test('does not activate on another hostname', async ({ page }) => {
  await page.route('https://example.com/**', (route) =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: fixture }),
  );
  await page.goto('https://example.com/watch/sm9');
  await page.addScriptTag({ content: script });
  await expect(page.locator('[data-nico-ambient]')).toHaveCount(0);
});

for (const background of ['#f2f2f2', '#0d0d0d']) {
  test(`perimeter stays opaque before blur on ${background}`, async ({
    page,
  }) => {
    await expect(page.locator('[data-nico-ambient=light]')).toBeVisible();
    await page.evaluate(async (color) => {
      document.body.style.backgroundColor = color;
      const source = document.querySelector<HTMLCanvasElement>('#test-source');
      const ctx = source?.getContext('2d');
      if (!ctx) throw new Error('Missing source context');
      ctx.fillStyle = '#101010';
      ctx.fillRect(0, 0, 320, 180);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(100, 50, 120, 80);
      // テスト用Canvasは非表示だと自動キャプチャされないことがあるため、
      // 変更後のフレームをデコーダーへ明示的に渡して描画タイミングを固定する。
      const video = document.querySelector('video');
      if (!video || !(video.srcObject instanceof MediaStream))
        throw new Error('Missing fixture video stream');
      const track =
        video.srcObject.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
      await new Promise<void>((resolve) => {
        video.requestVideoFrameCallback(() => resolve());
        track.requestFrame();
      });
    }, background);
    await expect
      .poll(
        () =>
          page.locator('video').evaluate((video: HTMLVideoElement) => {
            const sample = document.createElement('canvas');
            sample.width = 320;
            sample.height = 180;
            const context = sample.getContext('2d');
            if (!context) throw new Error('Missing video sampling context');
            context.drawImage(video, 0, 0, 320, 180);
            return Array.from(context.getImageData(0, 90, 1, 1).data);
          }),
        {
          message:
            'Updated dark edge must reach the video before testing the ambient field',
        },
      )
      .toEqual([16, 16, 16, 255]);
    const canvas = page.locator('[data-nico-ambient=light] canvas');
    await expect
      .poll(() =>
        canvas.evaluate((element: HTMLCanvasElement) => {
          const ctx = element.getContext('2d');
          if (!ctx) throw new Error('Missing field context');
          const pixels = ctx.getImageData(0, 0, 96, 64).data;
          let minAlpha = 255;
          let maxColor = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            minAlpha = Math.min(minAlpha, pixels[i + 3]);
            maxColor = Math.max(
              maxColor,
              pixels[i],
              pixels[i + 1],
              pixels[i + 2],
            );
          }
          return { minAlpha, maxColor };
        }),
      )
      .toEqual({ minAlpha: 255, maxColor: 16 });
    await page.evaluate(() => document.querySelector('video')?.pause());
    for (const spread of [200, 400]) {
      await page.evaluate(async (value) => {
        await chrome.storage.local.set({
          nicoAmbientSettings: {
            enabled: true,
            brightness: 100,
            spread: value,
          },
        });
      }, spread);
      await expect(page.locator('[data-nico-ambient=light]')).toHaveCSS(
        'opacity',
        '1',
      );
      const expectedWidth = await page
        .locator('video')
        .evaluate((element, value) => {
          const rect = element.getBoundingClientRect();
          const side = Math.min(rect.width, rect.height);
          return (
            rect.width +
            2 * ((side * value) / 100 + Math.min(60, side * 0.08) * 3)
          );
        }, spread);
      await expect
        .poll(() =>
          canvas.evaluate((element) =>
            Number.parseFloat(getComputedStyle(element).width),
          ),
        )
        .toBeCloseTo(expectedWidth, 1);
      // 左端のすぐ外側を合成後に調べる。透明な穴をぼかす実装では、
      // 辺が暗灰色でもページのテーマ色がにじんで縁取りになったため、その再発を検出する。
      const shot = await page.screenshot();
      const pixel = await page.evaluate(async (bytes) => {
        const bitmap = await createImageBitmap(
          new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
        );
        const scratch = document.createElement('canvas');
        scratch.width = bitmap.width;
        scratch.height = bitmap.height;
        const ctx = scratch.getContext('2d');
        if (!ctx) throw new Error('Missing screenshot context');
        ctx.drawImage(bitmap, 0, 0);
        return Array.from(ctx.getImageData(98, 280, 1, 1).data);
      }, Array.from(shot));
      for (const channel of pixel.slice(0, 3))
        expect(Math.abs(channel - 16)).toBeLessThanOrEqual(3);
    }
  });
}

test('light boundary follows video rather than extra space around controls', async ({
  page,
}) => {
  const light = page.locator('[data-nico-ambient=light]');
  await expect(light).toBeVisible();
  const expectedMask = await page.locator('video').evaluate((video) => {
    const rect = video.getBoundingClientRect();
    const distance = Math.min(rect.width, rect.height) * 2;
    // Chromiumはtransparentをrgba(0, 0, 0, 0)へ正規化するため、表記差を除いて同じマスクか比較する。
    const reference = document.createElement('div');
    reference.style.maskImage = `linear-gradient(to right, transparent ${rect.left - distance}px, rgb(0, 0, 0) ${rect.left}px, rgb(0, 0, 0) ${rect.right}px, transparent ${rect.right + distance}px), linear-gradient(transparent ${rect.top - distance}px, rgb(0, 0, 0) ${rect.top}px, rgb(0, 0, 0) ${rect.bottom}px, transparent ${rect.bottom + distance}px)`;
    document.body.append(reference);
    const mask = getComputedStyle(reference).maskImage;
    reference.remove();
    return mask;
  });
  await expect(light).toHaveCSS('mask-image', expectedMask);
  await expect(light).toHaveCSS('clip-path', 'none');
  await page.locator('#player').evaluate((element) => {
    element.style.width = '700px';
    element.style.height = '440px';
  });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await expect(light).toHaveCSS('mask-image', expectedMask);
  await expect(light).toHaveCSS('clip-path', 'none');
});
