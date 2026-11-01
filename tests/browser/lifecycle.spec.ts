import { expect, test } from '@playwright/test';
import { playerHtml, readContentScript, setupPlayer } from './helpers/player';

test.beforeEach(async ({ page }) => {
  await setupPlayer(page);
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
    route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: playerHtml,
    }),
  );
  await page.goto('https://example.com/watch/sm9');
  await page.addScriptTag({ content: readContentScript() });
  await expect(page.locator('[data-nico-ambient]')).toHaveCount(0);
});
