import assert from 'node:assert/strict';
import { createWriteStream } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import yazl from 'yazl';
import { verifyArchive } from '../../scripts/verify-release-archive.mjs';

const files = new Map([
  ['manifest.json', Buffer.from('{"version":"1.2.3"}')],
  ['assets/app.js', Buffer.from('original')],
]);

async function makeZip(
  archive,
  entries = [...files],
  { year = 2020, compress = false } = {},
) {
  const zip = new yazl.ZipFile();
  for (const [name, data, mode] of entries) {
    if (name.endsWith('/') && mode === undefined) {
      zip.addEmptyDirectory(name.slice(0, -1), {
        mtime: new Date(`${year}-01-01T00:00:00Z`),
      });
      continue;
    }
    zip.addBuffer(Buffer.from(data), name, {
      mtime: new Date(`${year}-01-01T00:00:00Z`),
      compress,
      mode: mode ?? (name.endsWith('/') ? 0o40755 : 0o100644),
    });
  }
  await new Promise((resolve, reject) => {
    zip.outputStream.on('error', reject);
    zip.outputStream
      .pipe(createWriteStream(archive))
      .on('finish', resolve)
      .on('error', reject);
    zip.end();
  });
}

async function rewriteName(archive, from, to) {
  assert.equal(Buffer.byteLength(from), Buffer.byteLength(to));
  const data = await readFile(archive);
  let offset = 0;
  let replacements = 0;
  while (true) {
    offset = data.indexOf(from, offset, 'utf8');
    if (offset === -1) break;
    data.write(to, offset, 'utf8');
    replacements++;
    offset += Buffer.byteLength(to);
  }
  assert.ok(replacements >= 2);
  await writeFile(archive, data);
}

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'release-archive-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dist = path.join(root, 'dist');
  await mkdir(path.join(dist, 'assets'), { recursive: true });
  for (const [name, data] of files) {
    await mkdir(path.dirname(path.join(dist, name)), { recursive: true });
    await writeFile(path.join(dist, name), data);
  }
  await writeFile(path.join(dist, 'assets/app.js.map'), 'not distributed');
  return { root, dist, archive: path.join(root, 'release.zip') };
}

test('accepts matching contents across timestamps and compression methods', async (t) => {
  const { dist, archive } = await fixture(t);
  await makeZip(archive, [['assets/', ''], ...files], { compress: false });
  const first = await verifyArchive(archive, dist);
  assert.equal(
    first,
    (await import('node:crypto'))
      .createHash('sha256')
      .update(await readFile(archive))
      .digest('hex'),
  );
  await makeZip(archive, [['assets/', ''], ...files], {
    year: 2025,
    compress: true,
  });
  assert.notEqual(first, await verifyArchive(archive, dist));
});

test('rejects changed content with the same manifest', async (t) => {
  const { dist, archive } = await fixture(t);
  await makeZip(archive, [
    ['manifest.json', files.get('manifest.json')],
    ['assets/app.js', 'modified'],
  ]);
  await assert.rejects(verifyArchive(archive, dist), /contents do not match/);
});

test('rejects missing files, extra files, and extra maps', async (t) => {
  const { dist, archive } = await fixture(t);
  await makeZip(archive, [['manifest.json', files.get('manifest.json')]]);
  await assert.rejects(verifyArchive(archive, dist), /missing files/);
  for (const name of ['extra.js', 'assets/app.js.map']) {
    await makeZip(archive, [...files, [name, 'extra']]);
    await assert.rejects(verifyArchive(archive, dist), /extra file/);
  }
});

test('rejects duplicate names and directories', async (t) => {
  const { dist, archive } = await fixture(t);
  for (const entries of [
    [...files, ['manifest.json', files.get('manifest.json')]],
    [['assets/', ''], ['assets/', ''], ...files],
  ]) {
    await makeZip(archive, entries);
    await assert.rejects(
      verifyArchive(archive, dist),
      /duplicate archive path/,
    );
  }
});

test('rejects absolute, traversal, ambiguous, and backslash paths', async (t) => {
  const { dist, archive } = await fixture(t);
  const cases = [
    ['manifest.json', '../manifest.j'],
    ['assets/app.js', '/assets/app.j'],
    ['manifest.json', './manifest.js'],
    ['assets/app.js', 'assets\\app.js'],
    ['assets/app.js', 'C:/assets/app'],
  ];
  for (const [original, unsafe] of cases) {
    await makeZip(archive, [...files]);
    await rewriteName(archive, original, unsafe);
    await assert.rejects(
      verifyArchive(archive, dist),
      /invalid (archive path|relative path|characters in fileName)|absolute path/,
    );
  }
});

test('rejects symlinks and special archive entries', async (t) => {
  const { dist, archive } = await fixture(t);
  for (const mode of [0o120777, 0o010644, 0o140644]) {
    await makeZip(archive, [
      ['assets/app.js', files.get('assets/app.js'), mode],
    ]);
    await assert.rejects(verifyArchive(archive, dist), /special file/);
  }
});

test('rejects special files anywhere in dist, including maps', async (t) => {
  const { dist, archive } = await fixture(t);
  await symlink(path.join(dist, 'manifest.json'), path.join(dist, 'link.map'));
  await makeZip(archive, [['assets/', ''], ...files]);
  await assert.rejects(verifyArchive(archive, dist), /special file/);
});

test('rejects extra directories and size mismatches', async (t) => {
  const { dist, archive } = await fixture(t);
  await makeZip(archive, [...files, ['unused/', '']]);
  await assert.rejects(verifyArchive(archive, dist), /extra directory/);
  await makeZip(archive, [
    ['manifest.json', 'larger than expected manifest content'],
  ]);
  await assert.rejects(verifyArchive(archive, dist), /size does not match/);
});
