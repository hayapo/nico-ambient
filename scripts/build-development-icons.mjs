import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

const publicIcons = fileURLToPath(new URL('../public/icons/', import.meta.url));
const glyphs = {
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  V: ['101', '101', '101', '101', '010'],
};

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const cornerDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= cornerDistance)
    return left;
  return aboveDistance <= cornerDistance ? above : upperLeft;
}

function decodePng(png) {
  let width;
  let height;
  const compressed = [];
  for (let offset = 8; offset < png.length; ) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0)
        throw new Error('Development icon source must be 8-bit RGBA PNG');
    }
    if (type === 'IDAT') compressed.push(data);
    offset += length + 12;
  }
  const stride = width * 4;
  const filtered = inflateSync(Buffer.concat(compressed));
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (stride + 1);
    const filter = filtered[rowOffset];
    for (let i = 0; i < stride; i++) {
      const raw = filtered[rowOffset + i + 1];
      const left = i >= 4 ? pixels[y * stride + i - 4] : 0;
      const above = y > 0 ? pixels[(y - 1) * stride + i] : 0;
      const upperLeft = y > 0 && i >= 4 ? pixels[(y - 1) * stride + i - 4] : 0;
      const predictor =
        filter === 1
          ? left
          : filter === 2
            ? above
            : filter === 3
              ? Math.floor((left + above) / 2)
              : filter === 4
                ? paeth(left, above, upperLeft)
                : 0;
      pixels[y * stride + i] = (raw + predictor) & 0xff;
    }
  }
  return { width, height, pixels };
}

function encodePng({ width, height, pixels }) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++)
    pixels.copy(
      rows,
      y * (width * 4 + 1) + 1,
      y * width * 4,
      (y + 1) * width * 4,
    );
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeDevelopmentPng(source) {
  const image = decodePng(source);
  const badgeWidth = 13;
  const badgeHeight = 8;
  const startX = Math.max(0, image.width - badgeWidth);
  const startY = Math.max(0, image.height - badgeHeight);
  const setPixel = (x, y, color) => {
    const offset = (y * image.width + x) * 4;
    image.pixels.set(color, offset);
  };
  for (let y = startY; y < image.height; y++)
    for (let x = startX; x < image.width; x++)
      setPixel(x, y, [205, 82, 24, 255]);
  for (const [letterIndex, letter] of ['D', 'E', 'V'].entries())
    for (const [rowIndex, row] of glyphs[letter].entries())
      for (let column = 0; column < 3; column++)
        if (row[column] === '1')
          setPixel(
            startX + 1 + letterIndex * 4 + column,
            startY + 1 + rowIndex,
            [255, 255, 255, 255],
          );
  return encodePng(image);
}

export async function buildDevelopmentIcons(outputDirectory) {
  await mkdir(`${outputDirectory}/icons`, { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    const source = await readFile(`${publicIcons}/icon-${size}.png`);
    await writeFile(
      `${outputDirectory}/icons/icon-${size}-dev.png`,
      makeDevelopmentPng(source),
    );
  }
}
