import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.ts',
  forbidOnly: !!process.env.CI,
  workers: 4,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        // この指定を共通設定に置くとChrome・Edgeも同じ実行ファイルを使い、ベンダー差を検証できない。
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        },
      },
    },
    { name: 'chrome', use: { channel: 'chrome' } },
    { name: 'msedge', use: { channel: 'msedge' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    // WebKitでSafari系の描画差を検出する。Safari本体の拡張機能読み込みは別途確認が必要。
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
