import type { ActionId } from '../domain/keybindings';
import type { Direction } from '../domain/content';
import type { TouchMode } from '../domain/settings';

/**
 * 虛擬按鍵（觸控）的排版與對應（純資料與純函式）。
 * 按下虛擬按鍵時直接送出 ActionId，與鍵盤 adapter 共用場景的動作閘門。
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

/** 方向按鈕按住時連續移動的間隔（毫秒）：比一格的移動時間稍長，避免排隊。 */
export const TOUCH_REPEAT_MS = 150;

/** Joystick thresholds are shared by fixed and floating controls and deliberately independent of pointer event rate. */
export const JOYSTICK_DEAD_ZONE = 0.22;
export const JOYSTICK_SWITCH_HYSTERESIS = 0.2;

/** Convert a normalized joystick vector into one grid direction with a dead zone and axis hysteresis. */
export function directionForJoystick(dx: number, dy: number, previous: Direction | null = null): Direction | null {
  const x = Math.max(-1, Math.min(1, dx));
  const y = Math.max(-1, Math.min(1, dy));
  if (Math.hypot(x, y) < JOYSTICK_DEAD_ZONE) return null;

  const horizontal = previous === 'left' || previous === 'right';
  const previousMagnitude = previous ? horizontal ? Math.abs(x) : Math.abs(y) : 0;
  const otherMagnitude = horizontal ? Math.abs(y) : Math.abs(x);
  if (previous) {
    const sameSign = previous === 'left' ? x < 0
      : previous === 'right' ? x > 0
        : previous === 'up' ? y < 0 : y > 0;
    if (sameSign && previousMagnitude >= otherMagnitude * (1 - JOYSTICK_SWITCH_HYSTERESIS)) return previous;
    if (!sameSign && previousMagnitude >= 0.4 && previousMagnitude >= otherMagnitude) {
      return horizontal ? x < 0 ? 'left' : 'right' : y < 0 ? 'up' : 'down';
    }
    if (otherMagnitude <= previousMagnitude * (1 + JOYSTICK_SWITCH_HYSTERESIS)) {
      return horizontal ? x < 0 ? 'left' : 'right' : y < 0 ? 'up' : 'down';
    }
  }

  if (Math.abs(x) >= Math.abs(y)) return x < 0 ? 'left' : 'right';
  return y < 0 ? 'up' : 'down';
}

/** One repeat loop arbitrates independent movement pointers; releasing an action pointer never stops movement. */
export class MoveInputScheduler {
  private readonly pointers = new Map<number, { direction: Direction; order: number }>();
  private sequence = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private active: Direction | null = null;

  constructor(private readonly onMove: (direction: Direction) => void) {}

  get activeDirection(): Direction | null {
    return this.active;
  }

  setPointer(pointerId: number, direction: Direction): void {
    const current = this.pointers.get(pointerId);
    this.pointers.set(pointerId, {
      direction,
      order: current?.direction === direction ? current.order : ++this.sequence,
    });
    this.refresh();
  }

  releasePointer(pointerId: number): void {
    if (!this.pointers.delete(pointerId)) return;
    this.refresh();
  }

  cancelAll(): void {
    this.pointers.clear();
    this.stopTimer();
    this.active = null;
  }

  private refresh(): void {
    const next = [...this.pointers.values()].sort((a, b) => b.order - a.order)[0]?.direction ?? null;
    if (next === this.active) return;
    this.stopTimer();
    this.active = next;
    if (!next) return;
    this.onMove(next);
    this.timer = setInterval(() => {
      if (this.active) this.onMove(this.active);
    }, TOUCH_REPEAT_MS);
  }

  private stopTimer(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}

/** 虛擬按鍵要不要顯示：auto 遇到粗指標或任一觸控點顯示，on 一律顯示，off 一律隱藏。 */
export function touchVisible(mode: TouchMode, coarsePointer: boolean, touchPoints = 0): boolean {
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return coarsePointer || touchPoints > 0;
}
