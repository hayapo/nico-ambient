# Nico Ambient

Vite + TypeScriptで開発する、Chrome / Edge向けManifest V3拡張機能です。
`https://www.nicovideo.jp/watch/<動画ID>` の動画の四辺の色をぼかし、プレイヤーの外側から画面全体へアンビエントライトを表示します。文字やコンポーネントより背面に配置し、カード自身の背景は維持します。

プレイヤーの全画面ボタンと同じコントロール列に追加される「☀」から、有効／無効・明るさ・広がりを変更できます。設定はChromeのローカルストレージに保存します。「広がり」は0〜400%で調整でき、未保存時の初期値は200%です。100%はプレイヤーの短辺と同じ距離まで各辺から光を広げ、外側ほど減衰します。0%では描画と親要素の背景透過を解除し、通常の視聴表示に戻します。保存済みの値は範囲内で引き継ぎます。
映像とコメント、プレイヤー操作部分には光を重ねず、光のレイヤーはクリックを妨げません。
設定パネルはプレイヤーの外側に配置し、下に十分な空間がない場合は上側に表示します。開いている間はリサイズ・スクロール・レイアウト変更に追従します。
`common-header`要素・同名のID／クラス、`#CommonHeader`、`.nico-CommonHeaderRoot`、`header`、`role="banner"`、`data-name="header"`の背景と、その中の検索欄までの背景を透過します。入力欄自身の背景は保持し、無効化・ページ遷移時には元に戻します。実サイトのヘッダーDOMへの適合は未確認です。

## セットアップ

Node.js 24系とpnpm 10系を使用します。

```sh
pnpm install
pnpm dev
```

`pnpm dev`は`dist/`に拡張機能をビルドし、ソース変更を監視します。

1. Chromeで`chrome://extensions`（Edgeでは`edge://extensions`）を開きます。
2. 「デベロッパーモード」を有効にします。
3. 「パッケージ化されていない拡張機能を読み込む」から、このプロジェクトの`dist/`を選びます。
4. ニコニコ動画の視聴ページを開き、動画を再生します。
5. プレイヤー内の「☀」を押すと設定が開きます。ツールバーの拡張機能アイコンは使い方の案内を表示します。

変更後はビルド完了を待ち、拡張機能の管理画面で再読み込みしてからポップアップを開き直してください。
拡張機能の自動再読み込みは行いません。変更したコンテンツスクリプトを反映するため、視聴ページも再読み込みしてください。

## コマンド

| コマンド | 用途 |
| --- | --- |
| `pnpm lint` | Biomeでlint |
| `pnpm lint:fix` | lintの安全な自動修正 |
| `pnpm format` | Biomeで整形 |
| `pnpm format:check` | 整形済みか確認（変更なし） |
| `pnpm check` | lint・書式・import順をまとめて確認 |
| `pnpm check:fix` | lintの安全な修正・整形・import整理 |
| `pnpm dev` | 拡張機能の監視ビルド |
| `pnpm dev:ui` | ポップアップUIの開発サーバー（HMR対応） |
| `pnpm typecheck` | TypeScriptの型チェック |
| `pnpm build` | 型チェックと配布用ビルド |
| `pnpm preview` | ビルド済みUIのプレビュー |
| `pnpm test` | 型チェック・ビルド・模擬DOMでのライフサイクルテスト |
| `pnpm test:browser` | 模擬視聴ページでのChromiumテスト |

`dev:ui`と`preview`は通常のWebページとしての表示です。拡張機能APIの確認には`dist/`をブラウザに読み込んでください。
監視ビルドでは型チェックを実行しないため、必要に応じて`pnpm typecheck`を実行してください。

lintとformatにはBiomeを使用します。設定は`biome.json`で管理し、推奨lintルール、スペース2文字、JavaScript／TypeScriptのシングルクォートを使用します。
`node_modules/`、`dist/`、テスト結果などの生成物はチェック対象外です。変更後は`pnpm check`と`pnpm test`で確認してください。
Biomeのバージョンは固定し、`pnpm-lock.yaml`で依存関係を揃えます。

## 構成

- `public/manifest.json`: 拡張機能の設定。ビルド時に`dist/`へコピーされます。
- `src/index.html`: ポップアップのHTML。
- `src/scripts/popup.ts`: ポップアップの処理。
- `src/styles/popup.css`: ポップアップのスタイル。
- `src/styles/settings.css`: プレイヤー内の設定パネルのスタイル。
- `src/scripts/content.ts`: 起動とページ遷移時のライフサイクル管理。
- `src/scripts/player.ts`: プレイヤー検出。
- `src/scripts/mount-player.ts`: 設定パネルと描画の組み立て・後片付け。
- `src/scripts/settings.ts`: 設定値の正規化と保存。
- `src/scripts/settings-panel.ts`: 設定パネルのUIと操作。
- `src/scripts/ambient-light.ts`: アンビエントライトの描画。
- `src/scripts/page-backdrop.ts`: 背面レイヤーの重なり順と親要素の背景透過・復元。
- `vite.config.ts`: Viteの設定。`src/`をルートとし、`public/`のManifestとともに`dist/`へ出力します。

描画・ページ背景・設定UIは、それぞれ `AmbientLight`、`PageBackdrop`、`SettingsPanel` クラスが状態と後片付けを管理します。`mountPlayer()` がインスタンスを組み立て、ページ遷移時には `destroy()` で破棄します。プレイヤー検出、設定値の正規化、縁色の生成は関数として分離しています。

設定パネルのCSSは`?inline`で文字列として読み込み、Shadow DOM内に適用します。スクリプトはソースではモジュール分割し、コンテンツスクリプトはビルド時に`dist/content.js`へまとめます。

ブラウザAPIの型定義は`@types/chrome`を使用します。権限は設定保存用の`storage`のみで、コンテンツスクリプトの対象ホストは`www.nicovideo.jp`だけです。
サイト内遷移で視聴ページに入る場合にも対応するため、同ホストの全パスで待機し、`/watch/<動画ID>`だけでUIと描画を開始します。
拡張機能のバージョンを変更するときは、`package.json`と`public/manifest.json`を更新してください。

## 検証と制約

ブラウザテストの初回実行前に`pnpm exec playwright install chromium`を実行してください。
既存のChromiumを使う場合は`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`で実行ファイルを指定できます。
テストでは模擬ページと動画、ストレージを使用します。実際の拡張機能の読み込みやニコニコ動画との接続は別途確認が必要です。

- 実装時の環境では実サイトの取得とChromiumの起動が制限されたため、実サイト上の表示とブラウザテストは未検証です。型チェック・ビルド・模擬DOMテストは確認済みです。
- プレイヤーは動画要素と全画面ボタンのラベルを手掛かりに検出します。サイトのDOMが変更された場合は`src/scripts/player.ts`の検出処理を調整してください。
- 描画は最大24fps、96×64のCanvasを使用します。非表示タブでは描画を休止します。プレイヤーが画面外に出ても光は距離に応じて減衰し、突然表示を切り替えません。
- 動画の画素を読み出さず、Canvasへ直接四辺を描画します。保護された動画など、ブラウザが描画を許可しない場合は光が出ないことがあります。
- 全画面でプレイヤーが画面全体を占める場合、プレイヤー外に表示領域がないため光は見えません。

## 参考

- [Vite公式ガイド](https://vite.dev/guide/)
- [Chrome拡張機能のManifest](https://developer.chrome.com/docs/extensions/reference/manifest)

共通ヘッダー内部の幅広・高さ120px以下の背景ラッパーも透過対象です。生成クラス名のハッシュには依存せず、メニュー・入力欄・ボタンは対象から除外します。

### 内部構成

- `page-backdrop.ts`: DOM変更の監視、適用範囲、元の属性・スタイルの復元。
- `backdrop/appearance.ts`: 背景と効果の合成、属性の差分更新、四隅の角丸の保存・復元。
- `backdrop/collectors.ts` / `header.ts` / `selectors.ts`: ページ部品とヘッダーの判定。
- `styles/page-backdrop.css`: 背景、文字色、影。ぼかしなどの調整値はCSS変数。
- `light-geometry.ts`: 光の領域・マスク・描画座標の計算。動画とポスターの切り替えは `AmbientLight` が管理。
- `settings-panel-template.ts` / `panel-position.ts`: 設定UIと配置計算。入力範囲は `settings.ts` の `NUMERIC_SETTINGS` を共有。

背景属性は `data-nico-ambient-backdrop="clear|surface|soft"`。
有効なルートは `data-nico-ambient-active`、影の除去などは
`data-nico-ambient-effects` の空白区切りトークンで表します。
収集順による背景の上書きと未分類時だけの補完を区別し、効果は併存します。
全画面時はそのルートの外側の属性・スタイルを復元します。
背景検出によって透明化した履歴は内部状態に保持し、見た目の `clear` と区別します。
テスト用のモジュールは `tests/helpers/bundle.mjs` でIIFEにビルドし、依存の差し替えはViteプラグインで行います。
