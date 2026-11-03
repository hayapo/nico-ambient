import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function verifyReleaseHash(archive, expected) {
  if (!/^[a-fA-F0-9]{64}$/.test(expected ?? '')) {
    throw new Error('リリースZIPのSHA-256が未設定、または形式が不正です。');
  }
  const actual = createHash('sha256').update(archive).digest('hex');
  if (actual !== expected.toLowerCase()) {
    throw new Error('リリースZIPのSHA-256が一致しません。提出を停止します。');
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    verifyReleaseHash(
      readFileSync(process.env.RELEASE_ARCHIVE),
      process.env.RELEASE_SHA256,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
