const SAMPLE_WIDTH = 96;
const SAMPLE_HEIGHT = 64;
type FieldGeometry = {
  left: number;
  top: number;
  width: number;
  height: number;
  fieldWidth: number;
  fieldHeight: number;
};

// 周縁の色を内外へ延長する。透明な穴を残すとCSSのぼかしがページ色を拾い、
// 明るい縁や暗い縁が映像に重なるため、動画の中心も不透明な周縁色で埋める。
export function createEdgeField(context: CanvasRenderingContext2D) {
  const sample = document.createElement('canvas');
  sample.width = SAMPLE_WIDTH;
  sample.height = SAMPLE_HEIGHT;
  const sampler = sample.getContext('2d', { willReadFrequently: true });
  if (!sampler) throw new Error('Canvas context unavailable');
  const output = context.createImageData(
    context.canvas.width,
    context.canvas.height,
  );

  return (input: CanvasImageSource, geometry: FieldGeometry) => {
    sampler.drawImage(input, 0, 0, sample.width, sample.height);
    const source = sampler.getImageData(0, 0, sample.width, sample.height).data;
    const { width, height } = output;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = ((x + 0.5) / width) * geometry.fieldWidth - geometry.left;
        const py = ((y + 0.5) / height) * geometry.fieldHeight - geometry.top;
        let u = Math.max(0, Math.min(1, px / geometry.width));
        let v = Math.max(0, Math.min(1, py / geometry.height));
        if (px > 0 && px < geometry.width && py > 0 && py < geometry.height) {
          // 中心色まで混ぜると周縁の色が薄まるため、最寄りの辺の色を内側へ延長する。
          const nearest = Math.min(
            px,
            geometry.width - px,
            py,
            geometry.height - py,
          );
          if (nearest === px) u = 0;
          else if (nearest === geometry.width - px) u = 1;
          else if (nearest === py) v = 0;
          else v = 1;
        }
        const sx = Math.round(u * (sample.width - 1));
        const sy = Math.round(v * (sample.height - 1));
        const from = (sy * sample.width + sx) * 4;
        const to = (y * width + x) * 4;
        output.data[to] = source[from];
        output.data[to + 1] = source[from + 1];
        output.data[to + 2] = source[from + 2];
        output.data[to + 3] = 255;
      }
    }
    context.putImageData(output, 0, 0);
  };
}
