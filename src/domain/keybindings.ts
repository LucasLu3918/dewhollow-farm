/**
 * 按鍵綁定（純規則，不依賴瀏覽器）：每個動作一個按鍵，同一個按鍵不能指派給兩個動作，Esc 保留給關閉面板。
 * 按鍵以正規化後的 `KeyboardEvent.key` 表示（字母一律小寫），例如 'x'、'ArrowUp'、'?'。
 */

export const ACTION_IDS = [
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'interact',
  'cycleTool',
  'cycleSeed',
  'takeAxe',
  'takePick',
  'takeRod',
  'takeSickle',
  'manualSave',
  'placeDecor',
  'wear',
  'takeOff',
  'skills',
  'residents',
  'collection',
  'quests',
  'saves',
  'settings',
  'help',
  'music',
  'mute',
] as const;

export type ActionId = (typeof ACTION_IDS)[number];

export type Bindings = Readonly<Record<ActionId, string>>;

/** 遊戲出貨時的預設按鍵；與改版前的按鍵完全相同。 */
export const DEFAULT_BINDINGS: Bindings = Object.freeze({
  moveUp: 'ArrowUp',
  moveDown: 'ArrowDown',
  moveLeft: 'ArrowLeft',
  moveRight: 'ArrowRight',
  interact: 'x',
  cycleTool: 'z',
  cycleSeed: 'c',
  takeAxe: 'a',
  takePick: 'p',
  takeRod: 'r',
  takeSickle: 'g',
  manualSave: 's',
  placeDecor: 'v',
  wear: 'e',
  takeOff: 'q',
  skills: 'k',
  residents: 'f',
  collection: 'i',
  quests: 'j',
  saves: 'l',
  settings: 'o',
  help: '?',
  music: 'b',
  mute: 'm',
});

/** 不能指派的按鍵：Esc 保留給關閉面板。 */
export const RESERVED_KEYS: readonly string[] = ['Escape'];

/** 只按修飾鍵時的名稱；它們本身不能當作按鍵。 */
const MODIFIER_KEYS: readonly string[] = ['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Fn', 'Dead', 'Unidentified'];

/** 把瀏覽器的按鍵名稱正規化：單一字母一律小寫（Shift 或 CapsLock 不影響動作）。 */
export function normalizeKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

/** 這個按鍵（正規化後）是否能被指派。 */
export function bindableKeyProblem(key: string): 'RESERVED' | 'UNBINDABLE' | null {
  const normalized = normalizeKey(key);
  if (normalized === '') return 'UNBINDABLE';
  if (RESERVED_KEYS.includes(normalized)) return 'RESERVED';
  if (MODIFIER_KEYS.includes(normalized)) return 'UNBINDABLE';
  return null;
}

/** 按下的按鍵對應到哪個動作；沒有對應就是 null。 */
export function actionForKey(bindings: Bindings, rawKey: string): ActionId | null {
  const key = normalizeKey(rawKey);
  for (const action of ACTION_IDS) {
    if (bindings[action] === key) return action;
  }
  return null;
}

/** 目前使用這個按鍵的其他動作（不包括 except 自己）。 */
function actionUsing(bindings: Bindings, key: string, except: ActionId): ActionId | null {
  for (const action of ACTION_IDS) {
    if (action !== except && bindings[action] === key) return action;
  }
  return null;
}

export type AssignResult =
  | { ok: true; bindings: Bindings; swappedWith?: ActionId }
  | { ok: false; reason: 'RESERVED' | 'UNBINDABLE' }
  | { ok: false; reason: 'CONFLICT'; conflict: ActionId };

/**
 * 把 action 改成 rawKey。
 * - 按鍵已被另一個動作使用：不改動，回傳 CONFLICT 並指出是哪個動作；玩家同意交換時帶 swap: true，兩者互換按鍵。
 * - Esc 與修飾鍵不能指派。
 * 不會修改傳入的 bindings，回傳的是新的表。
 */
export function assignKey(bindings: Bindings, action: ActionId, rawKey: string, options: { swap?: boolean } = {}): AssignResult {
  const problem = bindableKeyProblem(rawKey);
  if (problem) return { ok: false, reason: problem };
  const key = normalizeKey(rawKey);
  if (bindings[action] === key) return { ok: true, bindings: { ...bindings } };
  const other = actionUsing(bindings, key, action);
  if (other === null) return { ok: true, bindings: { ...bindings, [action]: key } };
  if (!options.swap) return { ok: false, reason: 'CONFLICT', conflict: other };
  return {
    ok: true,
    bindings: { ...bindings, [action]: key, [other]: bindings[action] },
    swappedWith: other,
  };
}

/** 整張表是否合格：每個動作都有按鍵、按鍵都能指派、彼此不重複。 */
export function bindingsAreValid(bindings: Partial<Record<ActionId, string>>): boolean {
  const seen = new Set<string>();
  for (const action of ACTION_IDS) {
    const key = bindings[action];
    if (typeof key !== 'string' || bindableKeyProblem(key) !== null) return false;
    const normalized = normalizeKey(key);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
  }
  return true;
}

/** 恢復預設：回傳預設表的新副本。 */
export function resetBindings(): Bindings {
  return { ...DEFAULT_BINDINGS };
}

const ARROW_SYMBOLS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
};

/** 給玩家看的按鍵名稱：方向鍵用箭頭，空白寫成 Space，字母大寫。 */
export function keyLabel(key: string): string {
  if (key in ARROW_SYMBOLS) return ARROW_SYMBOLS[key] ?? key;
  if (key === ' ') return 'Space';
  if (key.length === 1) return key.toUpperCase();
  return key;
}
