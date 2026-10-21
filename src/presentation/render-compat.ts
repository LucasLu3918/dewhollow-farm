/**
 * 軟體繪圖器的相容保底：判斷邏輯，純函式，不依賴 Phaser 與 DOM。
 *
 * 背景（查證過程與數據見 docs/ANIMATION_DESIGN.md「視覺驗收的注意事項」）：
 * Phaser 4.2.1 的多貼圖著色器用 `outTexDatum == float(INDEX)` 對「內插後的 varying」做精確相等比較來選貼圖。
 * GLSL 並不保證內插結果與頂點值逐位元相同；真實 GPU 剛好精確，SwiftShader 等軟體繪圖器內插「旋轉的方塊」
 * 時會有誤差，比較失敗的像素變成透明，角色被切掉一塊。
 * 保底：偵測到軟體繪圖器時，把每批貼圖數限制為 1，著色器就不再做這個比較。代價是 draw call 變多
 * （目前場景在實際 GPU 上從每畫面 1 次變成 90 次），所以只對軟體繪圖器啟用。
 */

/** 瀏覽器退回軟體繪圖時，繪圖器名稱常見的關鍵字。 */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

/** 名稱看起來是軟體繪圖器嗎？未知或被隱藏的名稱視為硬體，讓多數玩家維持原本的效能。 */
export function isSoftwareRenderer(name: string | null | undefined): boolean {
  return name !== null && name !== undefined && SOFTWARE_RENDERER.test(name);
}

export type CompatOverride = 'on' | 'off' | null;

/**
 * 網址上的強制開關：`?compat=1` 一律啟用、`?compat=0` 一律停用。
 * 瀏覽器隱藏繪圖器名稱、偵測不到時，玩家可以自己加 `?compat=1`。其他值一律忽略。
 */
export function parseCompatOverride(search: string): CompatOverride {
  const match = /[?&]compat=([^&]*)/.exec(search);
  if (match?.[1] === '1') return 'on';
  if (match?.[1] === '0') return 'off';
  return null;
}

/** 要不要啟用保底：強制開關優先，否則看是不是軟體繪圖器。 */
export function shouldUseTextureWorkaround(rendererName: string | null | undefined, override: CompatOverride): boolean {
  if (override === 'on') return true;
  if (override === 'off') return false;
  return isSoftwareRenderer(rendererName);
}

interface GlLike {
  getExtension(name: string): { UNMASKED_RENDERER_WEBGL: number } | null;
  getParameter(pname: number): unknown;
}

/**
 * 讀出真實的繪圖器名稱（需要 WEBGL_debug_renderer_info；瀏覽器可能拒絕或隱藏）。
 * 讀不到、或不是文字時回傳 null。
 */
export function readRendererName(gl: GlLike): string | null {
  try {
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    if (!extension) return null;
    const value = gl.getParameter(extension.UNMASKED_RENDERER_WEBGL);
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

/** 套用結果，供開發模式的檢查鉤子與除錯用。 */
export interface RenderCompatInfo {
  renderer: string;
  software: boolean;
  workaround: boolean;
  override: CompatOverride;
  /** 目前每批最多用幾張貼圖（啟用保底時為 1）。 */
  textureUnits: number;
  /** 這個繪圖器支援的上限。 */
  maxTextureUnits: number;
}
