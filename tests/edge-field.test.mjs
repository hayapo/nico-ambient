import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEdgeField } from '../src/scripts/edge-field.ts';

test('edge projection has no alpha hole or center-color contamination at any spread', () => {
  const source = new Uint8ClampedArray(96 * 64 * 4);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 96; x++) {
      const color = x > 20 && x < 75 && y > 15 && y < 49 ? 255 : 16;
      source.set([color, color, color, 255], (y * 96 + x) * 4);
    }
  }
  const original = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      getContext: () => ({
        drawImage() {},
        getImageData: () => ({ data: source }),
      }),
    }),
  };
  try {
    let result;
    const draw = createEdgeField({
      canvas: { width: 96, height: 64 },
      createImageData: (width, height) => ({
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
      }),
      putImageData: (image) => {
        result = image.data;
      },
    });
    for (const spread of [1, 100, 200, 400]) {
      const offset = (360 * spread) / 100 + 86.4;
      draw(
        {},
        {
          left: offset,
          top: offset,
          width: 640,
          height: 360,
          fieldWidth: 640 + 2 * offset,
          fieldHeight: 360 + 2 * offset,
        },
      );
      for (let i = 0; i < result.length; i += 4) {
        assert.deepEqual(
          Array.from(result.slice(i, i + 4)),
          [16, 16, 16, 255],
          `spread ${spread}, pixel ${i / 4}`,
        );
      }
    }
    // 左右を平均すると本来の辺色が失われるため、内側へ延長した後も各辺の色が保たれることを確認する。
    for (let y = 0; y < 64; y++) {
      source.set([255, 0, 0, 255], y * 96 * 4);
      source.set([0, 0, 255, 255], (y * 96 + 95) * 4);
    }
    draw(
      {},
      {
        left: 800,
        top: 800,
        width: 640,
        height: 360,
        fieldWidth: 2240,
        fieldHeight: 1960,
      },
    );
    assert.deepEqual(
      Array.from(result.slice(32 * 96 * 4, 32 * 96 * 4 + 4)),
      [255, 0, 0, 255],
    );
    assert.deepEqual(
      Array.from(result.slice((32 * 96 + 95) * 4, (32 * 96 + 96) * 4)),
      [0, 0, 255, 255],
    );
  } finally {
    if (original === undefined) delete globalThis.document;
    else globalThis.document = original;
  }
});
