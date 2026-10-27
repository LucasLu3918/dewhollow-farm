import { ACTION_IDS, DEFAULT_BINDINGS, bindingsAreValid, type ActionId, type Bindings } from './keybindings';

/**
 * 玩家偏好（純規則）：按鍵、字級、色盲模式、閃光與震動、觸控按鍵。
 * 偏好與存檔分開存放，不進 GameState，所以改偏好不需要升級存檔版本。
 */

/** 偏好的格式版本；v1 為舊版平面欄位，v2 將偏好放入 version envelope。 */
export const SETTINGS_SCHEMA_VERSION = 2;

export const FONT_SIZES = ['standard', 'large', 'xlarge'] as const;
export type FontSize = (typeof FONT_SIZES)[number];

/** 觸控按鍵：auto 在觸控裝置顯示，on 一律顯示，off 一律隱藏。 */
export const TOUCH_MODES = ['auto', 'on', 'off'] as const;
export type TouchMode = (typeof TOUCH_MODES)[number];

export const HANDEDNESSES = ['right', 'left'] as const;
export type Handedness = (typeof HANDEDNESSES)[number];

export const CONTROL_STYLES = ['dpad', 'fixed-joystick', 'floating-joystick'] as const;
export type ControlStyle = (typeof CONTROL_STYLES)[number];

export const BUTTON_SCALES = ['small', 'standard', 'large'] as const;
export type ButtonScale = (typeof BUTTON_SCALES)[number];

export const CONTROLS_PLACEMENTS = ['external', 'overlay'] as const;
export type ControlsPlacement = (typeof CONTROLS_PLACEMENTS)[number];

export interface MobileSettings {
  handedness: Handedness;
  controlStyle: ControlStyle;
  buttonScale: ButtonScale;
  controlsPlacement: ControlsPlacement;
  continuousActions: boolean;
}

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
  mobile: MobileSettings;
}

/** 回傳預設偏好的新副本（呼叫端改它不會影響預設值）。 */
export function defaultSettings(): Settings {
  return {
    bindings: { ...DEFAULT_BINDINGS },
    fontSize: 'standard',
    colorblind: false,
    effects: { shake: true, flash: true, particles: true },
    touchControls: 'auto',
    // Preserve the existing layout: right-hand action buttons, D-pad, normal size, outside the canvas.
    mobile: {
      handedness: 'right',
      controlStyle: 'dpad',
      buttonScale: 'standard',
      controlsPlacement: 'external',
      continuousActions: false,
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 新增動作時補齊舊版 key table；舊預設的 I/C 會遷移到新的背包/圖鑑/種子配置。 */
function bindingsWithInventory(rawBindings: Record<string, unknown>): Partial<Record<ActionId, string>> {
  const table: Partial<Record<ActionId, string>> = {};
  for (const action of ACTION_IDS) {
    const key = rawBindings[action];
    if (typeof key === 'string') table[action] = key;
  }
  if (typeof rawBindings.inventory === 'string') return table;

  // The previous defaults assigned I to collection and C to seed cycling. Preserve
  // user mappings while moving those defaults away from the new inventory binding.
  if (table.collection === 'i') table.collection = 'c';
  if (table.cycleSeed === 'c') table.cycleSeed = 'n';
  const occupied = new Set(Object.values(table));
  const candidates = ['i', ...'abcdefghijklmnopqrstuvwxyz'.split('').filter((key) => key !== 'i')];
  const inventoryKey = candidates.find((key) => !occupied.has(key));
  if (inventoryKey) table.inventory = inventoryKey;
  return table;
}

/**
 * 從不可信的原始資料（localStorage 讀出的 JSON）整理出完整的偏好。
 * 逐欄檢查：不合格的欄位用預設值，合格的欄位保留；按鍵表若不合格（缺動作、重複、或含 Esc）整張退回預設。
 */
export function sanitizeSettings(raw: unknown): Settings {
  const base = defaultSettings();
  if (!isObject(raw)) return base;

  // v1 stored preference fields beside schemaVersion. v2 stores them in an explicit payload envelope.
  const fields = raw.schemaVersion === 1 ? raw : raw.schemaVersion === SETTINGS_SCHEMA_VERSION && isObject(raw.settings) ? raw.settings : null;
  if (!fields) return base;

  const rawBindings = fields.bindings;
  if (isObject(rawBindings)) {
    // 只取認得的動作，多出來的欄位直接丟掉；舊表新增動作時保留原有有效綁定。
    const table = bindingsWithInventory(rawBindings);
    if (bindingsAreValid(table)) base.bindings = table as Bindings;
  }
  if (typeof fields.fontSize === 'string' && (FONT_SIZES as readonly string[]).includes(fields.fontSize)) {
    base.fontSize = fields.fontSize as FontSize;
  }
  if (typeof fields.colorblind === 'boolean') base.colorblind = fields.colorblind;
  if (isObject(fields.effects)) {
    if (typeof fields.effects.shake === 'boolean') base.effects.shake = fields.effects.shake;
    if (typeof fields.effects.flash === 'boolean') base.effects.flash = fields.effects.flash;
    if (typeof fields.effects.particles === 'boolean') base.effects.particles = fields.effects.particles;
  }
  if (typeof fields.touchControls === 'string' && (TOUCH_MODES as readonly string[]).includes(fields.touchControls)) {
    base.touchControls = fields.touchControls as TouchMode;
  }
  if (isObject(fields.mobile)) {
    if (typeof fields.mobile.handedness === 'string' && (HANDEDNESSES as readonly string[]).includes(fields.mobile.handedness)) {
      base.mobile.handedness = fields.mobile.handedness as Handedness;
    }
    if (typeof fields.mobile.controlStyle === 'string' && (CONTROL_STYLES as readonly string[]).includes(fields.mobile.controlStyle)) {
      base.mobile.controlStyle = fields.mobile.controlStyle as ControlStyle;
    }
    if (typeof fields.mobile.buttonScale === 'string' && (BUTTON_SCALES as readonly string[]).includes(fields.mobile.buttonScale)) {
      base.mobile.buttonScale = fields.mobile.buttonScale as ButtonScale;
    }
    if (typeof fields.mobile.controlsPlacement === 'string' && (CONTROLS_PLACEMENTS as readonly string[]).includes(fields.mobile.controlsPlacement)) {
      base.mobile.controlsPlacement = fields.mobile.controlsPlacement as ControlsPlacement;
    }
    if (typeof fields.mobile.continuousActions === 'boolean') {
      base.mobile.continuousActions = fields.mobile.continuousActions;
    }
  }
  return base;
}

/** 未知未來格式必須保持唯讀，避免新版資料被舊版的安全預設值覆寫。 */
export function isFutureSettingsVersion(raw: unknown): boolean {
  return isObject(raw) && typeof raw.schemaVersion === 'number' && Number.isInteger(raw.schemaVersion) && raw.schemaVersion > SETTINGS_SCHEMA_VERSION;
}
