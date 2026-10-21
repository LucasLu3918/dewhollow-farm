/** 玩家是否要求「減少動態」（作業系統或瀏覽器的 prefers-reduced-motion 設定）。設定畫面在 M7。 */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
