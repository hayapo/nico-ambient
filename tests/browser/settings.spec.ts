import { expect, test } from '@playwright/test';
import { setupPlayer } from './helpers/player';

test.beforeEach(async ({ page }) => {
  await setupPlayer(page);
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
