import type { Calendar, Season } from './calendar';
import type { GameState, PlayerState } from './game-state';
import { createShipBox } from './shipping';
import type { Inventory } from './inventory';

/**
 * 豐收重置與傳承（M6）的規則。數值與文字在 content/legacy.json；這裡只判斷與轉換狀態，不寫死任何數字。
 * - 豐收重置：第 fromYear 年起、每年 windowSeason 的 windowDay（換年後、睡前）可以做；清空當年的東西，保留圖鑑、成就、好感、技能天賦、主線進度；
 *   每次換取作物售價加成，最多 maxResets 次。
 * - 傳承：主線完成 requiresChapter 章之後可以做；其餘全部重新開始（等同新遊戲），只保留圖鑑與成就。
 */

export interface ResetRules {
  fromYear: number;
  windowSeason: Season;
  windowDay: number;
  /** 每次豐收重置後，作物售價的加成（百分點）。 */
  bonusPercentPerReset: number;
  maxResets: number;
  /** 豐收重置要清掉的建築旗標（店家賣的 building.<旗標>，或合成效果的旗標）。 */
  resetFlags: string[];
}

export interface LegacyRules {
  /** 新角色的預設名字（原角色名）。 */
  defaultPlayerName: string;
  reset: ResetRules;
  legacy: { requiresChapter: number };
}

/** 面板與訊息用的文字（content/legacy.json）。 */
export interface LegacyTexts {
  notice: { title: string; text: string };
  /** 站在別處按公告以外的東西時的說明（要站在床邊的公告前面）。 */
  notAtNotice: string;
  reset: {
    playMinutes: number;
    menu: string;
    closed: string;
    limit: string;
    warning: string;
    /** 第一次按之前的說明、按過之後的提示。 */
    hint: string;
    armed: string;
    confirm: string;
    done: string;
    needConfirm: string;
  };
  legacy: {
    playMinutes: number;
    menu: string;
    locked: string;
    nameLabel: string;
    badName: string;
    warning: string;
    hint: string;
    armed: string;
    confirm: string;
    done: string;
    needConfirm: string;
  };
}

export interface LegacyContent extends LegacyRules, Pick<LegacyTexts, 'notAtNotice'> {
  reset: ResetRules & LegacyTexts['reset'];
  legacy: LegacyRules['legacy'] & LegacyTexts['legacy'];
  notice: LegacyTexts['notice'];
}

/**
 * 測試用的最小內容沒有 legacy.json 時的替代值：沒有小屋公告（見 load-content），所以玩家接觸不到豐收重置與傳承。
 * 正式內容一律以 content/legacy.json 為準。
 */
export const NO_LEGACY: LegacyContent = {
  defaultPlayerName: '小涵',
  notice: { title: '—', text: '—' },
  notAtNotice: '—',
  reset: {
    playMinutes: 1,
    fromYear: 2,
    windowSeason: 'spring',
    windowDay: 1,
    bonusPercentPerReset: 5,
    maxResets: 3,
    resetFlags: [],
    menu: '—',
    closed: '—',
    limit: '—',
    warning: '—',
    hint: '—',
    armed: '—',
    confirm: '—',
    done: '—',
    needConfirm: '—',
  },
  legacy: {
    playMinutes: 1,
    requiresChapter: 1,
    menu: '—',
    locked: '—',
    nameLabel: '—',
    badName: '—',
    warning: '—',
    hint: '—',
    armed: '—',
    confirm: '—',
    done: '—',
    needConfirm: '—',
  },
};

export type ResetRefusal = 'RESET_CLOSED' | 'RESET_LIMIT';
export type LegacyRefusal = 'LEGACY_LOCKED';

/** 豐收重置的時機：第 fromYear 年以後，當年的 windowSeason 的 windowDay（換年後的那一天）。 */
export function resetWindowOpen(calendar: Pick<Calendar, 'year' | 'season' | 'day'>, rules: ResetRules): boolean {
  return calendar.year >= rules.fromYear && calendar.season === rules.windowSeason && calendar.day === rules.windowDay;
}

/** 現在能不能豐收重置；不能的原因（時機或次數）。能做回傳 null。 */
export function resetRefusal(state: { calendar: Calendar; resetBonus: number }, rules: ResetRules): ResetRefusal | null {
  if (!resetWindowOpen(state.calendar, rules)) return 'RESET_CLOSED';
  if (state.resetBonus >= rules.maxResets) return 'RESET_LIMIT';
  return null;
}

/** 傳承的條件：主線已經完成 requiresChapter 章（目前的章節號比它大）。 */
export function legacyRefusal(state: { story: { chapter: number } }, rules: Pick<LegacyRules, 'legacy'>): LegacyRefusal | null {
  return state.story.chapter > rules.legacy.requiresChapter ? null : 'LEGACY_LOCKED';
}

const MAX_NAME_LENGTH = 8;

/** 新角色的名字：去掉前後空白；空白或超過 8 個字（以字元計）回傳 null。 */
export function normalizePlayerName(raw: string): string | null {
  const trimmed = raw.trim();
  const length = [...trimmed].length;
  if (length === 0 || length > MAX_NAME_LENGTH) return null;
  return trimmed;
}

/** 豐收重置換來的作物售價加成（百分點）：次數 × 每次的百分點。 */
export function cropPriceBonusPercent(resetBonus: number, rules: Pick<ResetRules, 'bonusPercentPerReset'>): number {
  return resetBonus * rules.bonusPercentPerReset;
}

/** 開局的狀態（金幣、起始的背包、出生的地圖與位置）；豐收重置把農場放回這個樣子。 */
export interface StartingKit {
  gold: number;
  inventory: Inventory;
  mapId: string;
  player: PlayerState;
}

/**
 * 豐收重置後的狀態：金幣與背包回到開局（起始種子會放回背包），田地、出貨箱、加工、動物、裝飾與穿戴清空，
 * 建築改建的旗標清掉，回到開局的地圖；圖鑑、成就、好感、技能天賦、主線、服飾圖鑑與稱號都保留。
 * 次數加一（作物售價加成隨之增加）。不檢查時機與次數，那是 resetRefusal 的事。
 */
export function harvestResetState(state: GameState, kit: StartingKit, rules: ResetRules): GameState {
  const flags = { ...state.flags };
  for (const flag of rules.resetFlags) delete flags[flag];
  return {
    ...state,
    gold: kit.gold,
    yearlyIncome: 0,
    inventory: kit.inventory,
    shipBox: createShipBox(),
    plots: {},
    processing: [],
    animals: [],
    cows: [],
    sheep: [],
    decor: {},
    wearing: {},
    flags,
    fishing: null,
    starLine: false,
    mapId: kit.mapId,
    player: kit.player,
    resetBonus: state.resetBonus + 1,
  };
}

/**
 * 傳承後的狀態：以新遊戲（fresh）為底，只保留圖鑑、成就、碎片與遊玩時數；名字寫入 playerName；代數加一。
 * 加成與收入都從零開始（新的農場）。
 */
export function legacyState(state: GameState, fresh: GameState, name: string): GameState {
  return {
    ...fresh,
    playerName: name,
    generation: state.generation + 1,
    collection: state.collection,
    achievements: state.achievements,
    dexFragments: state.dexFragments,
    playtimeSeconds: state.playtimeSeconds,
  };
}
