# テスト構成

| 場所 | 検証対象 | 実行環境 |
| --- | --- | --- |
| `node/edge-field.test.mjs` | 周縁色の生成 | Node.js |
| `node/build.test.mjs` | Manifestとビルド成果物の整合性 | Node.js |
| `node/startup.test.mjs` / `node/lifecycle.test.mjs` | 起動・ページ遷移・後片付け | Node.js + happy-dom |
| `node/loading-light.test.mjs` | 読み込み・シーク中の描画維持 | Node.js + happy-dom |
| `node/page-backdrop.test.mjs` | 背景判定・除外・復元 | Node.js + happy-dom |
| `browser/settings.spec.ts` | 設定UI・保存・有効／無効と周縁描画 | Playwright |
| `browser/lifecycle.spec.ts` | SPA遷移・操作部の再生成・対象ホスト | Playwright |
| `browser/rendering.spec.ts` | 周縁の不透明度・合成結果・描画境界 | Playwright |
| `browser/backdrop.spec.ts` | CSS適用後の背景検出・全画面の適用範囲 | Playwright |

`helpers/bundle.mjs`はソースをテストへ読み込む共通のビルド処理です。
`browser/helpers/player.ts`は模擬視聴ページ、ストレージ、Canvas由来の動画を準備します。
各テストのページごとにストレージを作成し、テスト間で設定が共有されないようにしています。

## 実行

リポジトリのルートから実行してください。

```sh
# 全ブラウザープロジェクトに必要なブラウザーと実行依存を導入
pnpm test:browser:install

# 型チェック・ビルドとNode.jsテスト
pnpm test

# ビルドとChromiumテスト
pnpm test:browser

# ビルドと全ブラウザープロジェクトのテスト
pnpm test:browser:all
```

CIなどでビルドを共用する場合は、次の順番で実行します。`test:node`とPlaywrightの直接実行はビルドを行わないため、ソース変更後は再ビルドしてください。

```sh
pnpm build
pnpm test:node
pnpm exec playwright test --project=chromium
```

テストを絞り込む場合：

```sh
pnpm exec playwright test settings.spec.ts --project=chrome
pnpm exec playwright test --list
```

ブラウザーの導入とレポートの確認方法は[README](../README.md#開発)を参照してください。
ブラウザーが未導入の場合はスキップせず失敗します。

## 検証範囲

同じブラウザーテストを各プロジェクトで実行し、エンジンやベンダー固有の挙動差を検出します。
ページと拡張機能APIは模擬しているため、実際の拡張機能のインストール、権限、ニコニコ動画のDOMへの適合は別途確認が必要です。
WebKitはSafari本体ではなく、FirefoxもPlaywright管理のビルドです。
