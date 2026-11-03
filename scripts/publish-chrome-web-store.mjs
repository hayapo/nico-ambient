import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { verifyReleaseHash } from './verify-release-hash.mjs';

const API = 'https://chromewebstore.googleapis.com';
const POLL_INTERVAL_MS = 10_000;
const MAX_POLLS = 60;
const REQUEST_TIMEOUT_MS = 120_000;
const SUCCESS_STATES = new Set(['PENDING_REVIEW', 'PUBLISHED']);

function versions(revision) {
  return (revision?.distributionChannels ?? []).map(
    (channel) => channel.crxVersion,
  );
}

export function validateArchive(archive, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error('リリースバージョンの形式が不正です。');
  }
  const manifest = JSON.parse(
    execFileSync('unzip', ['-p', archive, 'manifest.json'], {
      encoding: 'utf8',
    }),
  );
  if (manifest.version !== version) {
    throw new Error(
      'ZIPのmanifest.versionがリリースバージョンと一致しません。',
    );
  }
}

export async function publishToStore({
  token,
  publisherId,
  extensionId,
  version,
  archive,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  if (!token || !publisherId || !/^[a-p]{32}$/.test(extensionId ?? '')) {
    throw new Error(
      'CWS_ACCESS_TOKEN、CWS_PUBLISHER_ID、CWS_EXTENSION_IDを確認してください。',
    );
  }
  const name = `publishers/${encodeURIComponent(publisherId)}/items/${extensionId}`;
  async function request(action, { upload = false, body } = {}) {
    const response = await fetchImpl(
      `${API}/${upload ? 'upload/' : ''}v2/${name}:${action}`,
      {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined
            ? {}
            : {
                'Content-Type': upload ? 'application/zip' : 'application/json',
              }),
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      // POSTの再送で二重提出しないよう、通信失敗時は次の実行の状態確認に任せる。
      throw new Error(
        `Chrome Web Store ${action}: HTTP ${response.status}。ダッシュボードを確認して再実行してください。`,
      );
    }
    return response.json();
  }

  const status = await request('fetchStatus');
  const submitted = status.submittedItemRevisionStatus;
  const published = status.publishedItemRevisionStatus;
  if (submitted && !['CANCELLED', 'REJECTED'].includes(submitted.state)) {
    if (
      versions(submitted).includes(version) &&
      SUCCESS_STATES.has(submitted.state)
    ) {
      return `v${version} は提出済みです (${submitted.state})。`;
    }
    throw new Error(
      `別の提出、または手動確認が必要な提出があります (${submitted.state})。`,
    );
  }
  if (
    versions(published).includes(version) &&
    published.state === 'PUBLISHED'
  ) {
    return `v${version} は公開済みです。`;
  }
  if (
    submitted?.state === 'REJECTED' &&
    versions(submitted).includes(version)
  ) {
    throw new Error(
      'このバージョンは審査で却下されています。ダッシュボードで理由を確認してください。',
    );
  }
  if (status.lastAsyncUploadState === 'IN_PROGRESS') {
    throw new Error(
      '別のアップロードが処理中です。完了後に再実行してください。',
    );
  }

  const uploaded = await request('upload', { upload: true, body: archive });
  if (uploaded.crxVersion && uploaded.crxVersion !== version) {
    throw new Error('ストアが返したバージョンがZIPと一致しません。');
  }
  let uploadState = uploaded.uploadState;
  for (
    let poll = 0;
    uploadState === 'IN_PROGRESS' && poll < MAX_POLLS;
    poll++
  ) {
    await sleep(POLL_INTERVAL_MS);
    uploadState = (await request('fetchStatus')).lastAsyncUploadState;
  }
  if (uploadState !== 'SUCCEEDED') {
    throw new Error(
      `アップロードが完了していません (${uploadState})。審査には提出していません。`,
    );
  }

  // アップロードの完了だけでは審査が始まらないため、公開APIを明示的に呼び出す。
  const result = await request('publish', {
    body: JSON.stringify({ publishType: 'DEFAULT_PUBLISH', skipReview: false }),
  });
  if (!SUCCESS_STATES.has(result.state)) {
    throw new Error(
      `提出結果の確認が必要です (${result.state})。ダッシュボードを確認してください。`,
    );
  }
  const warnings = result.warningInfo?.warnings ?? [];
  return `v${version} を提出しました (${result.state})。審査承認後に公開されます。${warnings.length ? ` ストアの警告: ${JSON.stringify(warnings)}` : ''}`;
}

async function main() {
  const version = process.env.RELEASE_VERSION ?? '';
  const archive = process.env.RELEASE_ARCHIVE;
  if (!archive) throw new Error('RELEASE_ARCHIVEが未設定です。');
  const contents = readFileSync(archive);
  // 認証前のチェック後も、実際に送信するバイト列が同じ成果物であることを確認する。
  verifyReleaseHash(contents, process.env.RELEASE_SHA256);
  validateArchive(archive, version);
  const result = await publishToStore({
    token: process.env.CWS_ACCESS_TOKEN,
    publisherId: process.env.CWS_PUBLISHER_ID,
    extensionId: process.env.CWS_EXTENSION_ID,
    version,
    archive: contents,
  });
  console.log(result);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `\nChrome Web Store: ${result}\n`,
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
