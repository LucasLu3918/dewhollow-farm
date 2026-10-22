import { ACTION_IDS, DEFAULT_BINDINGS, bindingsAreValid, type ActionId, type Bindings } from './keybindings';

/**
 * 玩家偏好（純規則）：按鍵、字級、色盲模式、閃光與震動、觸控按鍵。
 * 偏好與存檔分開存放，不進 GameState，所以改偏好不需要升級存檔版本。
 */

/** 偏好的格式版本。格式不同時整份回到預設值（不嘗試猜測舊欄位）。 */
export const SETTINGS_SCHEMA_VERSION = 1;

export const FONT_SIZES = ['standard', 'large', 'xlarge'] as const;
export type FontSize = (typeof FONT_SIZES)[number];

/** 觸控按鍵：auto 在觸控裝置顯示，on 一律顯示，off 一律隱藏。 */
export const TOUCH_MODES = ['auto', 'on', 'off'] as const;
export type TouchMode = (typeof TOUCH_MODES)[number];

export interface EffectToggles {
  /** 鏡頭震動（命中工具時）。 */
  shake: boolean;
  /** 螢幕閃光（睡覺時的淡出淡入）。 */
  flash: boolean;
  /** 粒子效果（揮工具的木屑、水滴、腳步塵土、天氣飄落的粒子）。 */
  particles: boolean;
}

export interface Settings {
  bindings: Bindings;
  fontSize: FontSize;
  colorblind: boolean;
  effects: EffectToggles;
  touchControls: TouchMode;
}

/** 回傳預設偏好的新副本（呼叫端改它不會影響預設值）。 */
export function defaultSettings(): Settings {
  return {
    bindings: { ...DEFAULT_BINDINGS },
    fontSize: 'standard',
    colorblind: false,
    effects: { shake: true, flash: true, particles: true },
    touchControls: 'auto',
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 從不可信的原始資料（localStorage 讀出的 JSON）整理出完整的偏好。
 * 逐欄檢查：不合格的欄位用預設值，合格的欄位保留；按鍵表若不合格（缺動作、重複、或含 Esc）整張退回預設。
 */
export function sanitizeSettings(raw: unknown): Settings {
  const base = defaultSettings();
  if (!isObject(raw) || raw.schemaVersion !== SETTINGS_SCHEMA_VERSION) return base;

  const rawBindings = raw.bindings;
  if (isObject(rawBindings)) {
    // 只取認得的動作，多出來的欄位直接丟掉。
    const table: Partial<Record<ActionId, string>> = {};
    for (const action of ACTION_IDS) {
      const key = rawBindings[action];
      if (typeof key === 'string') table[action] = key;
    }
    if (bindingsAreValid(table)) base.bindings = table as Bindings;
  }
  if (typeof raw.fontSize === 'string' && (FONT_SIZES as readonly string[]).includes(raw.fontSize)) {
    base.fontSize = raw.fontSize as FontSize;
  }
  if (typeof raw.colorblind === 'boolean') base.colorblind = raw.colorblind;
  if (isObject(raw.effects)) {
    if (typeof raw.effects.shake === 'boolean') base.effects.shake = raw.effects.shake;
    if (typeof raw.effects.flash === 'boolean') base.effects.flash = raw.effects.flash;
    if (typeof raw.effects.particles === 'boolean') base.effects.particles = raw.effects.particles;
  }
  if (typeof raw.touchControls === 'string' && (TOUCH_MODES as readonly string[]).includes(raw.touchControls)) {
    base.touchControls = raw.touchControls as TouchMode;
  }
  return base;
}
