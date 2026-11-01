# CI・リリース運用

開発ブランチはdevelopから作り、PRはdevelopへ送ります。リリース時はdevelopからmainへのPRを作成し、CI成功後にマージします。mainへのpushを受けてCIを再実行し、成功後にGitHub ActionsのEnvironment承認を待ってからタグ・ZIP・GitHub Releaseを作成します。

## 初期設定

- mainとdevelopをGitHubに作成してください。mainの直接pushを禁止し、PRとCIのchecksジョブを必須にしてください。リリース承認はPRではなくEnvironmentで行うため、mainのブランチルールでPR承認を必須にする必要はありません。
- Repository Settings → Environmentsで`release-approval` Environmentを作り、Required reviewersにリリースを承認する人を指定してください。単独運用で自分が承認する場合はPrevent self-reviewを有効にしないでください。設定しない場合、公開ジョブは承認待ちにならず続行します。
- developへのバージョン更新pushをトークンの所有者が行えるよう、ブランチ保護と権限を設定してください。

## リリース

1. ActionsのPrepare releaseを開き、実行ブランチにdevelopを選びます。
2. major・minor・patchを選びます。patchは以前の計画のminor-minorに相当します。
3. package.jsonとpublic/manifest.jsonを同時更新するコミットがdevelopに追加され、main向けPRが作成されます。
4. `GITHUB_TOKEN`でPRを作成するため、PRのCIはGitHubの承認待ちになります。Actions画面またはPRの表示からワークフローを承認すると、CIが実行されます。既存のリリースPRがある場合はバージョンを再更新せず、タイトルを同期します。developへの追加コミットは同じPRに反映されます。
5. CI成功を確認し、リリースPRをmainへマージします。継続的にdevelopからmainへマージするため、マージコミットを使用してください。
6. ReleaseワークフローがCIを再実行します。成功すると`release-approval` EnvironmentのRequired reviewersによる承認待ちになります。
7. ActionsのRelease実行で公開ジョブをレビュー・承認します。承認後、`vX.Y.Z`タグ、`nico-ambient-X.Y.Z.zip`、GitHub Releaseを作成します。

CIはバージョン一致、Biome、型チェック・ビルド、Node.jsテスト、5ブラウザープロジェクトを確認します。WebKitは現在ポスター画像による描画検証であり、動画ストリームの検証ではありません。

## 失敗時

失敗したRelease実行のRe-run jobsで再実行してください。バージョンは再採番しません。同じタグが同じコミットを指す場合だけ再利用し、別コミットを指す場合は停止します。公開前にZIPをアップロードし、再実行では同名ZIPを置き換えます。

mainの初回pushでもReleaseが実行されます。必要な設定と公開内容を確認してからmainへpushしてください。

## 依存パッケージの保護

CIとReleaseのビルドでは、Node.js・pnpmの準備後、依存インストール前にAikido Safe Chainを導入します。共通の`.github/actions/setup-safe-chain/action.yml`で公式インストーラーのバージョンとSHA-256を固定し、検証後に`--ci`でセットアップします。次のステップで`pnpm safe-chain-verify`を実行し、保護が有効なことを確認してから依存をインストールします。

導入や検証に失敗するとジョブを停止します。追加のAPIトークンは不要です。バージョン更新時は公式READMEに記載されたインストーラーのバージョンとSHA-256を同時に更新してください。

公式手順：https://github.com/AikidoSec/safe-chain#usage-in-cicd
