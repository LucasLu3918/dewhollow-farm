import type { ActionId, Bindings } from '../domain/keybindings';
import type { TouchMode } from '../domain/settings';

/**
 * 虛擬按鍵（觸控）的排版與對應（純資料與純函式）。
 * 按下虛擬按鍵時，送出的是「該動作目前綁定的按鍵」，走的是鍵盤同一條路徑（MapScene 的 handleKey），
 * 所以改了按鍵，觸控也跟著改，不另寫一套規則。
 */

export interface TouchButton {
  action: ActionId;
  /** 按鈕上的文字（功能名稱，不寫按鍵字母，改鍵後也不會不一致）。 */
  label: string;
  /** 給螢幕閱讀器的名稱。 */
  name: string;
  /** move 是方向鍵組（十字排列，按住會連續移動）；act 是動作鍵組。 */
  group: 'move' | 'act';
}

export const TOUCH_BUTTONS: readonly TouchButton[] = [
  { action: 'moveUp', label: '↑', name: '向上移動', group: 'move' },
  { action: 'moveLeft', label: '←', name: '向左移動', group: 'move' },
  { action: 'moveRight', label: '→', name: '向右移動', group: 'move' },
  { action: 'moveDown', label: '↓', name: '向下移動', group: 'move' },
  { action: 'interact', label: '互動', name: '互動', group: 'act' },
  { action: 'cycleTool', label: '工具', name: '切換工具', group: 'act' },
  { action: 'cycleSeed', label: '種子', name: '切換種子', group: 'act' },
  { action: 'skills', label: '技能', name: '技能與天賦', group: 'act' },
  { action: 'residents', label: '居民', name: '居民與好感', group: 'act' },
  { action: 'collection', label: '圖鑑', name: '圖鑑與成就', group: 'act' },
  { action: 'quests', label: '委託', name: '委託與佈告欄', group: 'act' },
  { action: 'manualSave', label: '存檔', name: '手動存檔', group: 'act' },
];

/** 這個虛擬按鈕要送出的按鍵（目前綁定的那一個）。 */
export function touchKeyFor(action: ActionId, bindings: Bindings): string {
  return bindings[action];
}

/** 方向按鈕按住時連續移動的間隔（毫秒）：比一格的移動時間稍長，避免排隊。 */
export const TOUCH_REPEAT_MS = 150;

/** 虛擬按鍵要不要顯示：auto 只在觸控裝置（pointer: coarse）顯示，on 一律顯示，off 一律隱藏。 */
export function touchVisible(mode: TouchMode, coarsePointer: boolean): boolean {
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return coarsePointer;
}
