import { keyLabel, type ActionId, type Bindings } from '../domain/keybindings';

/**
 * 狀態列底部的操作提示：依目前的按鍵表產生，玩家在設定裡改鍵後提示會跟著變。
 * 純函式，不碰 DOM；寫入頁面由 hud.ts 的 setControlsHint 負責。
 */

const NOTE = '（以上為目前的按鍵，可在設定中改）';

const MOVE_ACTIONS: readonly ActionId[] = ['moveUp', 'moveLeft', 'moveDown', 'moveRight'];
const ARROW_KEYS: readonly string[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

/** 把幾個動作的按鍵標籤用 / 連起來，例如 A/P/R/G。 */
function keysOf(bindings: Bindings, actions: readonly ActionId[]): string {
  return actions.map((action) => keyLabel(bindings[action])).join('/');
}

/** 一段提示：按鍵標籤加上說明，例如「X 互動」。 */
function segment(bindings: Bindings, actions: readonly ActionId[], text: string): string {
  return `${keysOf(bindings, actions)} ${text}`;
}

/** 移動鍵全是方向鍵時顯示「方向鍵移動」；改過的話列出每個移動鍵的標籤。 */
function movementSegment(bindings: Bindings): string {
  const allArrows = MOVE_ACTIONS.every((action) => ARROW_KEYS.includes(bindings[action]));
  return allArrows ? '方向鍵移動' : `${keysOf(bindings, MOVE_ACTIONS)} 移動`;
}

/** 產生操作提示列的文字，順序與預設提示一致。 */
export function controlsHint(bindings: Bindings): string {
  const parts = [
    movementSegment(bindings),
    segment(bindings, ['interact'], '互動'),
    segment(bindings, ['cycleTool'], '切換工具'),
    segment(bindings, ['cycleSeed'], '切換種子'),
    segment(bindings, ['takeAxe', 'takePick', 'takeRod', 'takeSickle'], '拿斧頭/鎬/釣竿/鐮刀'),
    segment(bindings, ['placeDecor', 'wear', 'takeOff'], '小屋擺放/穿/脫'),
    segment(bindings, ['skills'], '技能與天賦'),
    segment(bindings, ['residents'], '居民與好感'),
    segment(bindings, ['collection'], '圖鑑'),
    segment(bindings, ['quests'], '委託與佈告欄'),
    segment(bindings, ['manualSave'], '存檔'),
    segment(bindings, ['saves'], '存檔槽'),
    segment(bindings, ['settings'], '設定'),
    segment(bindings, ['music'], '背景音樂'),
    segment(bindings, ['mute'], '靜音'),
    segment(bindings, ['help'], '說明'),
  ];
  return `${parts.join(' · ')}${NOTE}`;
}
