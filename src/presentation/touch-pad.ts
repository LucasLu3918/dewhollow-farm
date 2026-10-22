import type { ActionId, Bindings } from '../domain/keybindings';
import type { TouchMode } from '../domain/settings';

/**
 * 虛擬按鍵（觸控）的排版與對應（純資料與純函式）。
 * 按下虛擬按鍵時，送出的是「該動作目前綁定的按鍵」，走的是鍵盤同一條路徑（MapScene 的 handleKey），
 * 所以改了按鍵，觸控也跟著改，不另寫一套規則。
 * 按鈕上的文字與完整名稱來自 content/controls.json（由呼叫端傳入），這裡只定義排版與分組。
 */

/**
 * move 是方向鍵組（十字排列，按住會連續移動）；act 是常用的動作鍵組，永遠看得到；
 * menu 是次要的選單（技能、居民、圖鑑、委託、存檔）與 tool 是直接拿工具與小屋動作（擺放、穿上、脫下），
 * 兩組都收在「更多」裡，按了才展開，讓遊戲畫面能佔住手機的大部分高度。
 */
export type TouchGroup = 'move' | 'act' | 'menu' | 'tool';

/** 虛擬按鍵的排版：哪個動作放在哪一組，陣列順序即畫面順序。 */
export const TOUCH_LAYOUT = [
  { action: 'moveUp', group: 'move' },
  { action: 'moveLeft', group: 'move' },
  { action: 'moveRight', group: 'move' },
  { action: 'moveDown', group: 'move' },
  { action: 'interact', group: 'act' },
  { action: 'cycleTool', group: 'act' },
  { action: 'cycleSeed', group: 'act' },
  { action: 'skills', group: 'menu' },
  { action: 'residents', group: 'menu' },
  { action: 'collection', group: 'menu' },
  { action: 'quests', group: 'menu' },
  { action: 'manualSave', group: 'menu' },
  { action: 'takeAxe', group: 'tool' },
  { action: 'takePick', group: 'tool' },
  { action: 'takeRod', group: 'tool' },
  { action: 'takeSickle', group: 'tool' },
  { action: 'placeDecor', group: 'tool' },
  { action: 'wear', group: 'tool' },
  { action: 'takeOff', group: 'tool' },
] as const satisfies readonly { action: ActionId; group: TouchGroup }[];

/** 出現在虛擬按鍵上的動作。 */
export type TouchAction = (typeof TOUCH_LAYOUT)[number]['action'];

/** 單一虛擬按鍵的文字：short label 與給螢幕閱讀器的完整名稱。 */
export interface TouchText {
  /** 按鈕上的文字（功能名稱，不寫按鍵字母，改鍵後也不會不一致）。 */
  label: string;
  /** 給螢幕閱讀器的名稱。 */
  name: string;
}

export type TouchLabels = Readonly<Record<TouchAction, TouchText>>;

export interface TouchButton extends TouchText {
  action: TouchAction;
  group: TouchGroup;
}

/** 依排版與文字組出每個虛擬按鈕（順序同 TOUCH_LAYOUT）。 */
export function buildTouchButtons(labels: TouchLabels): TouchButton[] {
  return TOUCH_LAYOUT.map((entry) => {
    const text = labels[entry.action];
    return { action: entry.action, label: text.label, name: text.name, group: entry.group };
  });
}

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
