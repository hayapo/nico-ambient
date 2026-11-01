import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Script } from 'node:vm';

test('manifest entries resolve and content script is a classic script', () => {
  const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
  assert.equal(manifest.action.default_popup, 'index.html');
  const html = readFileSync(`dist/${manifest.action.default_popup}`, 'utf8');
  for (const [, asset] of html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)) {
    assert.ok(existsSync(`dist/${asset}`), `Missing popup asset: ${asset}`);
  }
  for (const entry of manifest.content_scripts) {
    for (const path of entry.js) {
      // Manifestのコンテンツスクリプトでは静的なimport/exportを使えない。
      assert.doesNotThrow(
        () => new Script(readFileSync(`dist/${path}`, 'utf8')),
      );
    }
  }
});
