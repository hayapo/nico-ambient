import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { verifyReleaseHash } from '../../scripts/verify-release-hash.mjs';

const archive = Buffer.from('approved ZIP');
const sha256 = createHash('sha256').update(archive).digest('hex');

test('accepts the approved artifact hash, including uppercase hex', () => {
  assert.doesNotThrow(() => verifyReleaseHash(archive, sha256));
  assert.doesNotThrow(() => verifyReleaseHash(archive, sha256.toUpperCase()));
});

for (const value of [
  undefined,
  '',
  ' ',
  'a'.repeat(63),
  'a'.repeat(65),
  'z'.repeat(64),
  `${sha256}\n`,
]) {
  test(`rejects missing or malformed SHA-256: ${JSON.stringify(value)}`, () => {
    assert.throws(() => verifyReleaseHash(archive, value), /形式/);
  });
}

test('rejects an asset replaced while awaiting approval or before retry', () => {
  assert.throws(
    () => verifyReleaseHash(Buffer.from('replaced ZIP'), sha256),
    /一致/,
  );
});
