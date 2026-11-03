import { createHash } from 'node:crypto';
import { createReadStream, lstatSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import yauzl from 'yauzl';

function distributionFiles(dist) {
  const root = path.resolve(dist);
  if (!lstatSync(root).isDirectory())
    throw new Error('dist must be a regular directory');
  const files = new Map();
  const directories = new Set();
  function walk(directory) {
    for (const name of readdirSync(directory)) {
      const absolute = path.join(directory, name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      const info = lstatSync(absolute);
      if (info.isDirectory()) {
        directories.add(relative);
        walk(absolute);
      } else if (info.isFile()) {
        if (!relative.endsWith('.map')) files.set(relative, absolute);
      } else {
        throw new Error(`dist contains a special file: ${relative}`);
      }
    }
  }
  walk(root);
  return { files, directories };
}

function openZip(archive) {
  return new Promise((resolve, reject) => {
    yauzl.open(
      archive,
      { lazyEntries: true, strictFileNames: true },
      (error, zip) => {
        if (error) reject(error);
        else resolve(zip);
      },
    );
  });
}

function readEntry(zip, entry, target) {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error) return reject(error);
      compareStreams(stream, createReadStream(target)).then((equal) => {
        if (!equal)
          reject(new Error(`file contents do not match: ${entry.fileName}`));
        else resolve();
      }, reject);
    });
  });
}

async function compareStreams(left, right) {
  try {
    const a = left[Symbol.asyncIterator]();
    const b = right[Symbol.asyncIterator]();
    let leftChunk = Buffer.alloc(0);
    let rightChunk = Buffer.alloc(0);
    let leftOffset = 0;
    let rightOffset = 0;
    let leftDone = false;
    let rightDone = false;
    while (true) {
      if (leftOffset === leftChunk.length && !leftDone) {
        const next = await a.next();
        leftDone = next.done;
        leftChunk = next.done ? Buffer.alloc(0) : next.value;
        leftOffset = 0;
      }
      if (rightOffset === rightChunk.length && !rightDone) {
        const next = await b.next();
        rightDone = next.done;
        rightChunk = next.done ? Buffer.alloc(0) : next.value;
        rightOffset = 0;
      }
      if (leftDone || rightDone) return leftDone && rightDone;
      const length = Math.min(
        leftChunk.length - leftOffset,
        rightChunk.length - rightOffset,
      );
      if (
        !leftChunk
          .subarray(leftOffset, leftOffset + length)
          .equals(rightChunk.subarray(rightOffset, rightOffset + length))
      )
        return false;
      leftOffset += length;
      rightOffset += length;
    }
  } finally {
    left.destroy();
    right.destroy();
  }
}

function checkEntryType(entry) {
  const directory = entry.fileName.endsWith('/');
  const host = entry.versionMadeBy >>> 8;
  const mode = (entry.externalFileAttributes >>> 16) & 0xffff;
  const type = mode & 0o170000;
  const isDosDirectory = (entry.externalFileAttributes & 0x10) !== 0;
  if (
    (host === 3 && type !== 0 && type !== (directory ? 0o040000 : 0o100000)) ||
    (isDosDirectory !== directory && isDosDirectory)
  ) {
    throw new Error(`archive contains a special file: ${entry.fileName}`);
  }
  return directory;
}

export async function verifyArchive(archive, dist) {
  const { files, directories } = distributionFiles(dist);
  const zip = await openZip(archive);
  const seen = new Set();
  const actual = new Set();
  try {
    await new Promise((resolve, reject) => {
      zip.on('error', reject);
      zip.on('end', resolve);
      zip.on('entry', (entry) => {
        (async () => {
          const name = entry.fileName;
          if (
            !name ||
            name.includes('\\') ||
            name.includes(':') ||
            name.includes('\0')
          )
            throw new Error(`invalid archive path: ${name}`);
          const directory = checkEntryType(entry);
          const relative = directory ? name.slice(0, -1) : name;
          if (
            !relative ||
            relative
              .split('/')
              .some((part) => !part || part === '.' || part === '..')
          )
            throw new Error(`invalid archive path: ${name}`);
          if (seen.has(relative))
            throw new Error(`duplicate archive path: ${relative}`);
          seen.add(relative);
          if (directory) {
            if (!directories.has(relative) || entry.uncompressedSize !== 0)
              throw new Error(`extra directory: ${relative}`);
          } else {
            if (!files.has(relative))
              throw new Error(`extra file: ${relative}`);
            const size = lstatSync(files.get(relative)).size;
            if (entry.uncompressedSize !== size)
              throw new Error(`file size does not match: ${relative}`);
            actual.add(relative);
            await readEntry(zip, entry, files.get(relative));
          }
          zip.readEntry();
        })().catch(reject);
      });
      zip.readEntry();
    });
  } finally {
    zip.close();
  }
  const missing = [...files.keys()].filter((name) => !actual.has(name));
  if (missing.length) throw new Error(`missing files: ${missing.join(', ')}`);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(archive)) hash.update(chunk);
  return hash.digest('hex');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    if (process.argv.length !== 4)
      throw new Error('Usage: verify-release-archive.mjs ARCHIVE DIST');
    console.log(await verifyArchive(process.argv[2], process.argv[3]));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
