import { expect, test } from '@playwright/test';
import { setupPlayer } from './helpers/player';

test.beforeEach(async ({ page }) => {
  await setupPlayer(page);
});

for (const background of ['#f2f2f2', '#0d0d0d']) {
  test(`perimeter stays opaque before blur on ${background}`, async ({
    page,
  }) => {
    const usePoster =
      page.context().browser()?.browserType().name() === 'webkit';
    await expect(page.locator('[data-nico-ambient=light]')).toBeVisible();
    await page.evaluate(
      async ({ color, posterOnly }) => {
        document.body.style.backgroundColor = color;
        const source =
          document.querySelector<HTMLCanvasElement>('#test-source');
        const ctx = source?.getContext('2d');
        if (!ctx) throw new Error('Missing source context');
        ctx.fillStyle = '#101010';
        ctx.fillRect(0, 0, 320, 180);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(100, 50, 120, 80);
        // テスト用Canvasは非表示だと自動キャプチャされないことがあるため、
        // 変更後のフレームをデコーダーへ明示的に渡して描画タイミングを固定する。
        const video = document.querySelector('video');
        if (!video) throw new Error('Missing fixture video');
        if (posterOnly) {
          video.poster = source.toDataURL();
          return;
        }
        if (!(video.srcObject instanceof MediaStream))
          throw new Error('Missing fixture video stream');
        const track =
          video.srcObject.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
        if (typeof track.requestFrame === 'function') {
          await new Promise<void>((resolve) => {
            video.requestVideoFrameCallback(() => resolve());
            track.requestFrame();
          });
        }
      },
      { color: background, posterOnly: usePoster },
    );
    if (!usePoster)
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
