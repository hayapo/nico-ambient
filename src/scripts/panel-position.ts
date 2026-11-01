const INSET = 12;
const MIN_SIDE_WIDTH = 220;
const PANEL_WIDTH = 280;
export function panelLayout(
  rect: DOMRect,
  innerWidth: number,
  innerHeight: number,
) {
  const inset = INSET;
  const rightSpace = Math.max(0, innerWidth - rect.right - inset * 2);
  const leftSpace = Math.max(0, rect.left - inset * 2);
  const viewportWidth = Math.max(0, innerWidth - inset * 2);
  const placeRight = rightSpace >= leftSpace;
  const sideSpace = Math.max(leftSpace, rightSpace);
  const overlapsPlayer = sideSpace < Math.min(MIN_SIDE_WIDTH, viewportWidth);
  const panelWidth = overlapsPlayer
    ? viewportWidth
    : Math.min(PANEL_WIDTH, sideSpace);

  return {
    maxWidth: `${panelWidth}px`,
    maxHeight: `${Math.max(0, innerHeight - inset * 2)}px`,
    position(box: DOMRect) {
      const proposedLeft = overlapsPlayer
        ? (rect.left + rect.right - box.width) / 2
        : placeRight
          ? rect.right + inset
          : rect.left - box.width - inset;
      const left = `${Math.max(
        inset,
        Math.min(innerWidth - box.width - inset, proposedLeft),
      )}px`;
      const top = `${Math.max(inset, Math.min(innerHeight - box.height - inset, rect.bottom - box.height))}px`;
      return { left, top };
    },
  };
}
