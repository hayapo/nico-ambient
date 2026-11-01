export const FIELD_SIZE = { width: 96, height: 64 } as const;
const MAX_BLUR = 60;
const BLUR_RATIO = 0.08;
const BLUR_PADDING = 3;
export function lightGeometry(
  rect: DOMRect,
  spread: number,
  brightness: number,
) {
  // 短辺を基準にすると縦長・横長のプレイヤーでも、広がり設定の体感が揃う。
  const distance = (Math.min(rect.width, rect.height) * spread) / 100;
  const blur = Math.min(
    MAX_BLUR,
    Math.min(rect.width, rect.height) * BLUR_RATIO,
  );
  const padding = blur * BLUR_PADDING;
  const canvasWidth = rect.width + 2 * (distance + padding);
  const canvasHeight = rect.height + 2 * (distance + padding);
  const layerStyle = {
    opacity: String(brightness / 100),
    // 2方向のマスクを交差させることで、矩形の四隅まで一様に広がるのを防ぐ。
    // マスクはぼかし後に適用し、spreadが光の到達距離を直接決めるようにする。
    maskImage: `linear-gradient(to right, transparent ${rect.left - distance}px, #000 ${rect.left}px, #000 ${rect.right}px, transparent ${rect.right + distance}px), linear-gradient(to bottom, transparent ${rect.top - distance}px, #000 ${rect.top}px, #000 ${rect.bottom}px, transparent ${rect.bottom + distance}px)`,
    maskComposite: 'intersect',
    // 光を動画の下まで連続させても、前面の動画が隠すため映像上には出ない。
    // 動画形状に合わせて別途切り抜くと、座標差で細い光漏れが生じるため切り抜かない。
  };
  const canvasStyle = {
    position: 'absolute',
    left: `${rect.left - distance - padding}px`,
    top: `${rect.top - distance - padding}px`,
    width: `${canvasWidth}px`,
    height: `${canvasHeight}px`,
    filter: `blur(${blur}px) saturate(1.15)`,
  };

  return {
    layerStyle,
    canvasStyle,
    field: {
      left: distance + padding,
      top: distance + padding,
      width: rect.width,
      height: rect.height,
      fieldWidth: canvasWidth,
      fieldHeight: canvasHeight,
    },
  };
}
