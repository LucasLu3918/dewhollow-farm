import { keyLabel, type ActionId, type Bindings } from '../domain/keybindings';

/**
 * 狀態列底部的操作提示：依目前的按鍵表產生，玩家在設定裡改鍵後提示會跟著變。
 * 文字（每個動作的短標籤、方向鍵與說明）由呼叫端傳入，來自 content/controls.json；這裡只負責排版與順序。
 * 純函式，不碰 DOM；寫入頁面由 hud.ts 的 setControlsHint 負責。
 */

/** 每個動作的短標籤（狀態列用），例如 interact → 互動、cycleTool → 切換工具。 */
export type HintLabels = Readonly<Record<ActionId, string>>;

export interface HintText {
  /** 移動鍵全是方向鍵時顯示的文字，例如「方向鍵移動」。 */
  arrowMovement: string;
  /** 提示列最後的說明。 */
  note: string;
}

const MOVE_ACTIONS: readonly ActionId[] = ['moveUp', 'moveLeft', 'moveDown', 'moveRight'];
const ARROW_KEYS: readonly string[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

/** 把幾個動作的按鍵標籤用 / 連起來，例如 A/P/R/G。 */
function keysOf(bindings: Bindings, actions: readonly ActionId[]): string {
  return actions.map((action) => keyLabel(bindings[action])).join('/');
}

/** 一段提示：按鍵標籤加上說明，說明是各動作短標籤用 / 連起來，例如「X 互動」或「A/P/R/G 拿斧頭/鎬/釣竿/鐮刀」。 */
function segment(bindings: Bindings, labels: HintLabels, actions: readonly ActionId[]): string {
  const text = actions.map((action) => labels[action]).join('/');
  return `${keysOf(bindings, actions)} ${text}`;
}

/** 移動鍵全是方向鍵時顯示 arrowMovement；改過的話列出每個移動鍵的標籤，接上移動的短標籤。 */
function movementSegment(bindings: Bindings, labels: HintLabels, text: HintText): string {
  const allArrows = MOVE_ACTIONS.every((action) => ARROW_KEYS.includes(bindings[action]));
  return allArrows ? text.arrowMovement : `${keysOf(bindings, MOVE_ACTIONS)} ${labels.moveUp}`;
}

/** 產生操作提示列的文字，順序與預設提示一致。 */
export function controlsHint(bindings: Bindings, labels: HintLabels, text: HintText): string {
  const parts = [
    movementSegment(bindings, labels, text),
    segment(bindings, labels, ['interact']),
    segment(bindings, labels, ['cycleTool']),
    segment(bindings, labels, ['cycleSeed']),
    segment(bindings, labels, ['takeAxe', 'takePick', 'takeRod', 'takeSickle']),
    segment(bindings, labels, ['placeDecor', 'wear', 'takeOff']),
    segment(bindings, labels, ['skills']),
    segment(bindings, labels, ['residents']),
    segment(bindings, labels, ['inventory']),
    segment(bindings, labels, ['collection']),
    segment(bindings, labels, ['quests']),
    segment(bindings, labels, ['manualSave']),
    segment(bindings, labels, ['saves']),
    segment(bindings, labels, ['settings']),
    segment(bindings, labels, ['music']),
    segment(bindings, labels, ['mute']),
    segment(bindings, labels, ['help']),
  ];
  return `${parts.join(' · ')}${text.note}`;
}
