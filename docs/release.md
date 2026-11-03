# CI・リリース運用

開発ブランチはdevelopから作り、PRはdevelopへ送ります。リリース時はdevelopからmainへのPRを作成し、CI成功後にマージします。mainへのpushを受けてCIを再実行し、成功後にGitHub ActionsのEnvironment承認を待ってからタグ・ZIP・GitHub Releaseを作成し、Chrome Web Storeへアップロードして審査に提出します。

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
7. ActionsのRelease実行で公開ジョブをレビュー・承認します。承認後、`vX.Y.Z`タグ、`nico-ambient-X.Y.Z.zip`、GitHub Releaseを作成します。続けて専用ワークフロー`publish-chrome-web-store.yml`を呼び出し、GitHub Releaseから同じZIPを取得してChrome Web Storeへアップロード・審査提出します。ストア提出ジョブも`release-approval`を使用するため、承認待ちになった場合はActions画面で承認してください。Googleの審査承認後にストアで公開されます。ワークフローは審査完了までは待ちません。

CIはバージョン一致、Biome、型チェック・ビルド、Node.jsテスト（ZIP検証を含む）、5ブラウザープロジェクトを確認します。WebKitは現在ポスター画像による描画検証であり、動画ストリームの検証ではありません。

## 失敗時

失敗したRelease実行のRe-run jobsで再実行してください。バージョンは再採番しません。同じタグが同じコミットを指す場合だけ再利用し、別コミットを指す場合は停止します。新規ZIP・既存ZIPともに、再ビルドした`dist`と内容が一致した場合だけ使用します。再実行でも既存の同名ZIPは置き換えません。Chrome Web Storeへの提出だけが失敗した場合は、Release実行のRe-run failed jobsで失敗したジョブだけを再実行できます。成功済みのビルド・GitHub Release作成をやり直す必要はありません。

mainの初回pushでもReleaseが実行されます。必要な設定と公開内容を確認してからmainへpushしてください。

## 依存パッケージの保護

CIとReleaseのビルドでは、Node.js・pnpmの準備後、依存インストール前にAikido Safe Chainを導入します。共通の`.github/actions/setup-safe-chain/action.yml`で公式インストーラーのバージョンとSHA-256を固定し、検証後に`--ci`でセットアップします。次のステップで`pnpm safe-chain-verify`を実行し、保護が有効なことを確認してから依存をインストールします。

導入や検証に失敗するとジョブを停止します。追加のAPIトークンは不要です。バージョン更新時は公式READMEに記載されたインストーラーのバージョンとSHA-256を同時に更新してください。

公式手順：https://github.com/AikidoSec/safe-chain#usage-in-cicd

## Chrome Web Storeの自動提出

`.github/workflows/release.yml`はCI・ビルド・タグ・GitHub Releaseの作成を担当し、成功後に`.github/workflows/publish-chrome-web-store.yml`を`workflow_call`で呼び出します。Chrome側は公開済みのZIPをダウンロードし、OIDC認証・アップロード・審査提出だけを担当します。再ビルドやGitHub Releaseへの書き込みは行いません。

再利用ワークフローでもOIDCの`workflow_ref`は呼び出し元の`release.yml`を表すため、前述のGoogle Cloud側の条件とEnvironment変数は変更不要です。呼び出し先は別の`job_workflow_ref`クレームで識別されます。詳細は[GitHubのOIDCと再利用ワークフローの説明](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-with-reusable-workflows)を参照してください。

`release-approval` EnvironmentのVariablesに以下を登録します（Secretsではありません）。

| 変数 | 値 |
| --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions/providers/github` |
| `GCP_SERVICE_ACCOUNT` | Chrome Web Storeのアカウントに登録したサービスアカウントのメールアドレス |
| `CWS_PUBLISHER_ID` | ストアのパブリッシャーID |
| `CWS_EXTENSION_ID` | `fpkipkpjhcencmbefkhjmhgnigocjknn` |

Google CloudでChrome Web Store APIを有効化し、GitHub OIDC用Workload Identity Providerとサービスアカウントの`roles/iam.workloadIdentityUser`バインディングを設定してください。Providerの条件はリポジトリの数値IDと所有者の数値IDに加え、`refs/heads/main`、`repo:hayapo/nico-ambient:environment:release-approval`、`hayapo/nico-ambient/.github/workflows/release.yml@refs/heads/main`に制限します。サービスアカウントはChrome Web Store Developer DashboardのAccountにも登録する必要があります。

`google-github-actions/auth@v3`で短命のアクセストークンを取得します。サービスアカウントキーやリフレッシュトークンの保存は不要です。`id-token: write`はChrome Web Store用ワークフローの呼び出しと、その提出ジョブにのみ付与しています。GitHub Release作成ジョブには付与しません。

`scripts/publish-chrome-web-store.mjs`はZIPのmanifestとリリースバージョンの一致を確認してから、API v2でアップロードし、非同期処理が完了したら`publishType: DEFAULT_PUBLISH`、`skipReview: false`で審査に提出します。ストアの公開範囲・配信率はダッシュボードの設定を引き継ぎます。必要なストア情報や申告は事前にダッシュボードで記入してください。

再実行時に同じバージョンが審査中・公開済みならスキップします。この判定はバージョンに基づき、ストア内のZIPとバイト単位で同一であることを保証するものではありません。別バージョンが審査中、公開待ち、同じバージョンが却下済み、他のアップロードが処理中の場合は停止します。アップロード完了後に提出が失敗した場合は、再実行で同じZIPを再アップロードしてから提出します。ダッシュボードからの同時アップロードは避けてください。

APIのエラーやタイムアウト時は失敗扱いにし、POSTをその場で再送しません。ストアの状態を確認してから同じReleaseを再実行してください。テストはAPIをモックし、実際のアップロード・審査提出は行いません。

- [Chrome Web Store API: upload](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/media/upload)
- [Chrome Web Store API: publish](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/publish)

## リリースZIPの内容・ハッシュ検証

Release作成ジョブは`node scripts/verify-release-archive.mjs ARCHIVE dist`で検証します。`yauzl`でZIPをディスクへ展開せず読み取ります。`dist`から`.map`を除いた通常ファイルの一覧と、ZIP内の通常ファイルの一覧・内容が完全一致することを確認します。ZIP側の余分な`.map`も拒否します。絶対パス・`..`・曖昧なパス・重複パス・シンボリックリンク・特殊ファイルは拒否し、ビルド内に存在する通常のディレクトリエントリーは許容します。圧縮方式やタイムスタンプが異なっても内容が同じなら再利用できます。

検証済みZIPのSHA-256はRelease作成ジョブの出力からChrome提出ワークフローの必須入力`sha256`に渡します。Chrome側はダウンロード直後、OIDC認証より前に照合します。空値・形式不正・不一致の場合は停止します。送信直前にも、送信するバイト列そのものを照合します。同じGitHub Releaseに置かれたチェックサムファイルは信頼元にしません。

Chrome側だけの再実行では成功済みジョブのSHA-256を引き継ぐ構成です。全ジョブを再実行した場合は対象コミットを再ビルドして既存ZIPの内容と比較します。依存関係やビルド環境の変化によって出力が変わった場合も停止します。不一致時はZIPを削除・上書きして検証を回避せず、Releaseアセットの変更履歴とビルド差分を確認してください。意図的な内容変更は新しいバージョンでリリースします。

ローカル検証コマンド:

```sh
node --test tests/node/release-archive.test.mjs tests/node/release-hash.test.mjs tests/node/chrome-web-store.test.mjs
```

## GitHub Actionsで部分再実行を検証する

実際の審査提出を伴わない`Verify release integrity retry`ワークフローを追加しています。Google認証・Environment承認・Release作成・ストアAPI呼び出しはありません。GitHub上の実行確認は変更をpushした後に行います（ローカルのテストではActionsの出力引き継ぎまでは検証できません）。

1. `verify-release-integrity.yml`がデフォルトブランチに入った後、Actionsから`Verify release integrity retry`を手動実行します。
2. `prepare`がテストZIPを作成・検証し、ハッシュとArtifact名をジョブ出力に設定します。
3. 再利用ワークフロー内の`verify`がZIPを取得し、ハッシュ照合に成功した後、初回だけ意図的に失敗します。
4. **Re-run failed jobs**を選択します（Re-run all jobsでは部分再実行の検証になりません）。
5. `prepare`が再実行されず、`verify`が成功することを確認します。これにより成功済みジョブから再利用ワークフローへのハッシュとArtifact名の引き継ぎを確認します。

Artifactの保存期間は7日です。期限切れの場合は新しい手動実行からやり直してください。実行結果を確認するまでは、部分再実行経路をGitHub上で検証済みとは扱いません。

## CIジョブ

CIは`develop`・`main`向けPRの作成・更新時と、リリースワークフローからの呼び出し時に実行します。pushでは起動しないため、PR更新に伴うpushとの重複実行を避けられます。

`lint`（バージョン一致・Biome）と`test`（型チェック・ビルド・Node.jsテスト・ブラウザーテスト）は並列で実行します。`checks`は両方が成功した場合だけ成功する集約ジョブです。失敗・キャンセル・スキップの場合は失敗するため、既存のブランチ保護で必須にしている`checks`を引き続き使用できます。
