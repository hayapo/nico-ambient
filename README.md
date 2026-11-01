# Nico Ambient

ニコニコ動画のプレイヤー周辺に、映像の四辺の色を広げるアンビエントライトを表示するブラウザー拡張機能です。ChromeとMicrosoft Edgeに対応するManifest V3拡張機能として開発しています。

## 機能

- プレイヤー映像の周縁色をサンプリングし、プレイヤーの外側へ広げて表示
- 明るさと広がりを調整し、設定をブラウザーに保存
- コメントやプレイヤー操作を妨げない背景レイヤー
- ページ内遷移に対応し、対象ページを離れると追加した表示を後片付け

対象ページは`https://www.nicovideo.jp/watch/...`です。ページのDOM変更や動画の保護方式によって、動作しない場合があります。

## 対応ブラウザー

| ブラウザー | サポート状況 | 自動テスト環境 |
| --- | --- | --- |
| Google Chrome（デスクトップ） | 配布対象 | Chrome Stable（`chrome`） |
| Microsoft Edge（デスクトップ） | 配布対象 | Edge Stable（`msedge`） |
| Chromium | 開発時の基準環境 | Playwright Chromium（`chromium`） |
| Firefox | 正式サポート対象外・互換性検証中 | Playwright Firefox（`firefox`） |
| Safari | 正式サポート対象外・互換性検証中 | Playwright WebKit（`webkit`） |

WebKitのテストはSafari本体やSafari拡張機能の動作保証ではありません。Firefox・Safariへの配布には、それぞれの実ブラウザーで拡張機能の読み込みと権限を確認する必要があります。

## インストール

### ブラウザーの拡張機能ストアからインストール

Chromeでは[Chrome ウェブストア](https://chromewebstore.google.com/)、Edgeでは[Microsoft Edge アドオン](https://microsoftedge.microsoft.com/addons/)で「Nico Ambient」を検索し、拡張機能のページからインストールします。

現在、どちらのストアにも未公開です。公開後に各ストアの拡張機能ページへのリンクを追加します。現時点では以下のGitHub Releasesからインストールしてください。

### リリースからインストール

公開済みのバージョンは、GitHubの[Releases](../../releases)からZIPをダウンロードできます。

1. ZIPを展開します。
2. Chromeで`chrome://extensions`、Edgeで`edge://extensions`を開きます。
3. デベロッパーモードを有効にします。
4. 「パッケージ化されていない拡張機能を読み込む」を選び、展開したフォルダーを指定します。

### ソースからビルド

Node.js 26とpnpm 10を用意し、リポジトリのルートで実行します。

```sh
pnpm install --frozen-lockfile
pnpm build
```

生成された`dist/`を、上記の手順で拡張機能として読み込みます。

## 使い方

ニコニコ動画の視聴ページを開き、プレイヤーのコントローラーにある太陽アイコンから設定を開きます。有効・無効、明るさ、広がりを調整できます。設定は自動的に保存されます。

## 開発

```sh
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev`は`dist/`を監視ビルドします。開発版をブラウザーに読み込んだ後、ソース変更時は拡張機能を再読み込みしてください。コンテンツスクリプトの変更を反映するには、視聴ページも再読み込みします。

主なコマンド：

| コマンド | 内容 |
| --- | --- |
| `pnpm check` | Biomeのlint・format確認 |
| `pnpm typecheck` | TypeScriptの型チェック |
| `pnpm build` | 型チェックと本番ビルド |
| `pnpm test` | ビルドとNode.jsテスト |
| `pnpm test:node` | ビルド済みの成果物に対してNode.jsテストを実行 |
| `pnpm test:browser:install` | 5プロジェクト用のブラウザーとLinuxの実行依存を導入 |
| `pnpm test:browser` | ビルドとPlaywright Chromiumテスト |
| `pnpm test:browser:all` | ビルドと全5プロジェクトのテスト |

ブラウザーテストの初回実行前に、必要なブラウザーをインストールします。Chromiumだけで確認する場合は次のコマンドで十分です。

```sh
pnpm exec playwright install --with-deps chromium
```

既存のChromiumを使う場合は、`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`で実行ファイルを指定できます。テストは模擬ページを使うため、実際のニコニコ動画上での表示確認も必要です。

### ブラウザー互換性テスト

通常の確認には`pnpm test:browser`（Chromium）を使用します。全環境を確認する場合は、必要なブラウザーを導入してから実行します。

```sh
pnpm test:browser:install
pnpm test:browser:all
```

この導入コマンドはChromium・Firefox・WebKitの実行依存を導入し、Chrome・Edgeもインストールします。Linuxのシステム依存の導入には管理者権限が必要な場合があります。Chrome・EdgeのインストールはOSの標準配置先を使うため、既存のインストールを置き換える場合があります。[Playwrightのブラウザー設定](https://playwright.dev/docs/browsers)

特定のブラウザーだけを確認する場合は、ビルド後にプロジェクトを指定します。

```sh
pnpm build
pnpm exec playwright test --project=chrome
# 複数指定も可能
pnpm exec playwright test --project=firefox --project=webkit
```

指定できるプロジェクトは`chromium`、`chrome`、`msedge`、`firefox`、`webkit`です。Chrome・Edgeはインストール済みのStable版、Firefox・WebKitはPlaywright管理のビルドを使用します。`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`はChromiumだけに適用されます。ブラウザーが未導入の場合は失敗します。

ブラウザーテストは5プロジェクトで同じ8件のテストを実行します。

| テストファイル | 確認する内容 |
| --- | --- |
| `tests/browser/settings.spec.ts` | 設定ボタン、明るさ・広がりの変更と保存 |
| `tests/browser/lifecycle.spec.ts` | 視聴ページでの起動、ページ内遷移時の破棄と再接続、対象外ホスト |
| `tests/browser/rendering.spec.ts` | 映像周縁の色、ライトの不透明性、映像位置に沿うマスクと画面合成 |
| `tests/browser/backdrop.spec.ts` | 背景ロール、疑似要素、全画面時の祖先判定と復元 |

テストでは模擬視聴ページ、Canvasから生成した動画、模擬した拡張機能ストレージを使います。Manifestからの実際の読み込み、権限、ニコニコ動画の実ページでの動作は別途確認が必要です。

実行結果は`pnpm exec playwright show-report`で確認できます。失敗時にはスクリーンショットとtraceを保存します。

## プロジェクト構成

- `src/scripts/ambient-light.ts`: 映像周縁の取得とライト描画
- `src/scripts/page-backdrop.ts`: ページ背景の判定、スタイル適用、復元
- `src/scripts/content.ts`: 視聴ページの検出とライフサイクル管理
- `src/scripts/settings.ts`: 設定値の検証と保存
- `public/manifest.json`: 拡張機能のManifest
- `tests/`: Node.jsとPlaywrightによるテスト

詳細な設計は[`docs/nico-ambient.md`](docs/nico-ambient.md)、テストの分類と個別の実行方法は[`tests/README.md`](tests/README.md)を参照してください。

## ライセンス

このプロジェクトのソースコードは[MIT License](LICENSE)で公開しています。
