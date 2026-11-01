// コメントコマンドのポップアップには安定した意味属性がないため、自動生成IDではなく
// 固有のサイズ・位置・色選択コントロールの組み合わせで特定する。
const commandPopupSelector =
  '[class~="pos_absolute"][class~="bg-c_layer.surfaceHighEm"]' +
  ':has(> div > [data-scope="segment-group"] > label[aria-label="big"])' +
  ':has(> div > [data-scope="segment-group"] > label[aria-label="ue"])' +
  ':has(> div > [data-scope="segment-group"] > label[aria-label="white"])';
export const excludedBackdropSelector = [
  '[data-nvpc-scope="watch-floating-panel"][data-nvpc-part="floating"]',
  '[data-scope="menu"]',
  '[data-scope="hover-card"]',
  '[data-scope="dialog"]',
  commandPopupSelector,
].join(', ');
export const excludedPopupContainerSelector = [
  '[data-nvpc-scope="watch-floating-panel"][data-nvpc-part="floating"]',
  '[data-scope="menu"]:not([data-part="trigger"])',
  '[data-scope="hover-card"]:not([data-part="trigger"])',
  '[data-scope="dialog"]:not([data-part="trigger"])',
  commandPopupSelector,
].join(', ');
export const ambientSurfaceSelector = [
  '[class~="bg-c_layer.surfaceHighEm"]',
  'main [class~="bg_layer.surfaceHighEm"]',
].join(', ');
export const controllerSelector =
  '[class~="max-h_watchController.height"][class~="bg-c_monotone.L15"]:has([aria-label="video - currentTime"])';
