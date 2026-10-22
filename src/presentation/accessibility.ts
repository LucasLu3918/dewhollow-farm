import type { EffectToggles, FontSize } from '../domain/settings';

/**
 * 無障礙的呈現規則（純函式，不依賴 DOM 或 Phaser）：字級倍率、色盲模式的文字標記、閃光與震動的開關。
 */

/** 字級倍率（乘在 HUD 與面板的字級上，見 styles.css 的 --font-scale）。 */
const FONT_SCALE: Record<FontSize, number> = {
  standard: 1,
  large: 1.25,
  xlarge: 1.5,
};

export const FONT_SIZE_LABELS: Record<FontSize, string> = {
  standard: '標準',
  large: '大',
  xlarge: '特大',
};

export function fontScaleOf(size: FontSize): number {
  return FONT_SCALE[size];
}

/** 訊息列上的等級：錯誤或一般結果。 */
export type MarkedLevel = 'error' | 'info';

/**
 * 色盲模式下訊息前面加的文字標記：錯誤用 ✕、結果用 ✓，不只靠紅色與白色區分。
 * 模式關閉時回傳空字串，訊息文字與原本完全相同。
 */
export function levelMarker(level: MarkedLevel, colorblind: boolean): string {
  if (!colorblind) return '';
  return level === 'error' ? '✕ ' : '✓ ';
}

/**
 * 實際要用的效果開關：系統要求「減少動態」時全部關閉；否則看玩家的個別開關。
 * 兩者任一開啟就減少，所以這裡是 AND（系統不要求，且玩家也開著，效果才會出現）。
 */
export function reducedEffects(systemReduced: boolean, toggles: EffectToggles): EffectToggles {
  return {
    shake: !systemReduced && toggles.shake,
    flash: !systemReduced && toggles.flash,
    particles: !systemReduced && toggles.particles,
  };
}
