import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  publishToStore,
  validateArchive,
} from '../../scripts/publish-chrome-web-store.mjs';

function mock(responses) {
  const calls = [];
  return {
    calls,
    options: {
      token: 'test-token',
      publisherId: 'publisher',
      extensionId: 'fpkipkpjhcencmbefkhjmhgnigocjknn',
      version: '1.2.3',
      archive: Buffer.from('test zip'),
      sleep: async () => {},
      fetchImpl: async (url, init) => {
        calls.push({ url, ...init });
        assert.ok(responses.length, 'Unexpected API request');
        const body = responses.shift();
        return {
          ok: !body.httpError,
          status: body.httpError ?? 200,
          json: async () => body,
        };
      },
    },
  };
}

function revision(state, version = '1.2.3') {
  return { state, distributionChannels: [{ crxVersion: version }] };
}

test('uploads the ZIP then submits for review with automatic publication', async () => {
  const { options, calls } = mock([
    {},
    { uploadState: 'SUCCEEDED', crxVersion: '1.2.3' },
    { state: 'PENDING_REVIEW' },
  ]);
  await publishToStore(options);
  assert.equal(calls[1].body, options.archive);
  assert.match(calls[1].url, /\/upload\/v2\/.*:upload$/);
  assert.equal(calls[1].headers['Content-Type'], 'application/zip');
  assert.deepEqual(JSON.parse(calls[2].body), {
    publishType: 'DEFAULT_PUBLISH',
    skipReview: false,
  });
});

test('waits for asynchronous upload before submitting', async () => {
  const { options, calls } = mock([
    {},
    { uploadState: 'IN_PROGRESS' },
    { lastAsyncUploadState: 'IN_PROGRESS' },
    { lastAsyncUploadState: 'SUCCEEDED' },
    { state: 'PENDING_REVIEW' },
  ]);
  await publishToStore(options);
  assert.equal(calls.length, 5);
  assert.match(calls.at(-1).url, /:publish$/);
});

for (const [key, state] of [
  ['submittedItemRevisionStatus', 'PENDING_REVIEW'],
  ['publishedItemRevisionStatus', 'PUBLISHED'],
]) {
  test(`does not resubmit ${state}`, async () => {
    const { options, calls } = mock([{ [key]: revision(state) }]);
    await publishToStore(options);
    assert.equal(calls.length, 1);
  });
}

for (const state of ['STAGED', 'REJECTED', 'PENDING_REVIEW']) {
  test(`stops for conflicting submission ${state}`, async () => {
    const { options, calls } = mock([
      {
        submittedItemRevisionStatus: revision(
          state,
          state === 'REJECTED' ? '1.2.3' : '1.2.2',
        ),
      },
    ]);
    await assert.rejects(publishToStore(options));
    assert.equal(calls.length, 1);
  });
}

for (const response of [
  { uploadState: 'FAILED' },
  { uploadState: 'SUCCEEDED', crxVersion: '9.0.0' },
  { httpError: 401 },
  { httpError: 500 },
]) {
  test(`does not publish or retry a failed upload: ${JSON.stringify(response)}`, async () => {
    const { options, calls } = mock([{}, response]);
    await assert.rejects(publishToStore(options));
    assert.equal(calls.length, 2);
  });
}

test('stops polling an upload after the time budget', async () => {
  const { options, calls } = mock([
    {},
    { uploadState: 'IN_PROGRESS' },
    ...Array.from({ length: 60 }, () => ({
      lastAsyncUploadState: 'IN_PROGRESS',
    })),
  ]);
  await assert.rejects(publishToStore(options), /IN_PROGRESS/);
  assert.equal(calls.length, 62);
});

test('does not blindly retry a publish request with an uncertain outcome', async () => {
  const { options, calls } = mock([
    {},
    { uploadState: 'SUCCEEDED' },
    { httpError: 503 },
  ]);
  await assert.rejects(publishToStore(options), /HTTP 503/);
  assert.equal(calls.length, 3);
});

test('validates the manifest inside the actual release ZIP', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cws-'));
  try {
    const archive = join(directory, 'release.zip');
    // ZIP作成ツールの有無に依存せず、実際の展開処理とバージョン検証を通す。
    writeFileSync(
      archive,
      Buffer.from(
        'UEsDBBQAAAAAAFgPY13Xf5x1EwAAABMAAAANAAAAbWFuaWZlc3QuanNvbnsidmVyc2lvbiI6IjEuMi4zIn1QSwECFAMUAAAAAABYD2Nd13+cdRMAAAATAAAADQAAAAAAAAAAAAAAgAEAAAAAbWFuaWZlc3QuanNvblBLBQYAAAAAAQABADsAAAA+AAAAAAA=',
        'base64',
      ),
    );
    assert.doesNotThrow(() => validateArchive(archive, '1.2.3'));
    assert.throws(() => validateArchive(archive, '1.2.4'), /一致/);
    assert.throws(() => validateArchive(archive, 'invalid'), /形式/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
