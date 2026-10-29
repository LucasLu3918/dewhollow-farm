import { SAVE_SCHEMA_VERSION } from '../../domain/game-state';
import { calendarOnDay } from '../../domain/calendar';
import { advanceRng } from '../../domain/random';
import { z } from 'zod';
import { cropItemId, DEFAULT_MAX_STACK, seedItemId, type ItemStack } from '../../domain/items';
import { describeIssue, SaveFormatError } from './save-errors';
import { gameStateV1Schema, type GameStateV1 } from './save-schema-v1';

/** 遷移時需要的、存檔本身不包含的設定。 */
export interface MigrationContext {
  /** 背包格數（來自 content/tuning.json）。 */
  inventoryCapacity: number;
  /** 每個季節的天數（來自 content/tuning.json）。 */
  daysPerSeason: number;
  /** 睡醒時間（來自 content/tuning.json）。 */
  wakeMinute: number;
  /** 預設的角色名字（來自 content/legacy.json）；v23 之前的存檔沿用它。 */
  playerName: string;
}

type Migration = (state: unknown, context: MigrationContext) => unknown;

/**
 * 遷移表：鍵為「來源版本」，每個函式把該版本升到下一版。
 * 新增存檔版本時：凍結舊 schema、加一個遷移與它的測試、再把 SAVE_SCHEMA_VERSION 加一。
 */
const MIGRATIONS: Readonly<Record<number, Migration>> = {
  1: migrateV1ToV2,
  2: migrateV2ToV3,
  3: migrateV3ToV4,
  4: migrateV4ToV5,
  5: migrateV5ToV6,
  6: migrateV6ToV7,
  7: migrateV7ToV8,
  8: migrateV8ToV9,
  9: migrateV9ToV10,
  10: migrateV10ToV11,
  11: migrateV11ToV12,
  12: migrateV12ToV13,
  13: migrateV13ToV14,
  14: migrateV14ToV15,
  15: migrateV15ToV16,
  16: migrateV16ToV17,
  17: migrateV17ToV18,
  18: migrateV18ToV19,
  19: migrateV19ToV20,
  20: migrateV20ToV21,
  21: migrateV21ToV22,
  22: migrateV22ToV23,
  23: migrateV23ToV24,
  24: migrateV24ToV25,
};

/**
 * 把任何受支援版本的存檔內容升到目前版本。
 * 版本太新、版本缺失或舊格式損毀時拋出 SaveFormatError，不會猜測或補值。
 */
export function migrateState(raw: unknown, context: MigrationContext): unknown {
  let version = versionOf(raw);
  if (version > SAVE_SCHEMA_VERSION) {
    throw new SaveFormatError(`這份存檔來自更新版本的遊戲（v${version}），請更新遊戲後再讀取`);
  }
  let state = raw;
  while (version < SAVE_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) throw new SaveFormatError(`沒有從存檔版本 v${version} 升級的方法`);
    state = migrate(state, context);
    version += 1;
  }
  return state;
}

function versionOf(raw: unknown): number {
  if (typeof raw !== 'object' || raw === null || !('schemaVersion' in raw)) {
    throw new SaveFormatError('存檔缺少存檔版本（schemaVersion）');
  }
  const version = raw.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new SaveFormatError(`存檔版本無效：${String(version)}`);
  }
  return version;
}

/**
 * v1 的田地可能沒有 dryDays（那時還沒有乾旱天數）：缺的視為 0，其餘欄位照原樣交給 v1 格式檢查。
 * 不改動輸入物件，回傳新的物件。
 */
function withDryDaysDefault(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || !('plots' in raw)) return raw;
  const { plots } = raw;
  if (typeof plots !== 'object' || plots === null) return raw;
  const filled = Object.fromEntries(
    Object.entries(plots).map(([key, plot]) => [
      key,
      typeof plot === 'object' && plot !== null && !('dryDays' in plot) ? { ...plot, dryDays: 0 } : plot,
    ]),
  );
  return { ...raw, plots: filled };
}

/** v1 → v2：背包改為通用物品堆疊、出貨箱改為物品條目、新增遊玩時數。 */
function migrateV1ToV2(raw: unknown, context: MigrationContext): unknown {
  const parsed = gameStateV1Schema.safeParse(withDryDaysDefault(raw));
  if (!parsed.success) {
    // 一次列出所有有問題的欄位（最多 5 個），方便對照舊存檔，不必重試一次只看到一個。
    const listed = parsed.error.issues.slice(0, 5).map((issue) => describeIssue(issue));
    throw new SaveFormatError(`存檔 v1 格式錯誤於 ${listed.join('；')}`);
  }
  const { bag, shipBox, ...rest }: GameStateV1 = parsed.data;

  const stacks: ItemStack[] = [
    ...stacksOf(bag.seeds, seedItemId),
    ...stacksOf(bag.crops, cropItemId),
  ];
  return {
    ...rest,
    schemaVersion: 2,
    // 舊存檔放得下的東西，遷移後一定要放得下，所以容量不足時加大，而不是丟掉物品。
    inventory: { capacity: Math.max(context.inventoryCapacity, stacks.length), stacks },
    shipBox: { entries: entriesOf(shipBox.items, cropItemId) },
    playtimeSeconds: 0,
  };
}

function stacksOf(counts: Record<string, number>, toItemId: (cropId: string) => string): ItemStack[] {
  const stacks: ItemStack[] = [];
  for (const [cropId, total] of Object.entries(counts)) {
    for (let left = total; left > 0; left -= DEFAULT_MAX_STACK) {
      stacks.push({ itemId: toItemId(cropId), quality: 'normal', count: Math.min(left, DEFAULT_MAX_STACK) });
    }
  }
  return stacks;
}

function entriesOf(counts: Record<string, number>, toItemId: (cropId: string) => string): ItemStack[] {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([cropId, count]) => ({ itemId: toItemId(cropId), quality: 'normal' as const, count }));
}

/**
 * v2 → v3：日曆改為四季（v2 的 day 是從開始算起的總天數，全部發生在春天）、新增今天與明天的天氣。
 * 舊存檔沒有天氣紀錄，所以今天與明天都設為晴；之後的天氣照常抽。
 */
function migrateV2ToV3(raw: unknown, context: MigrationContext): unknown {
  const parsed = z
    .object({
      calendar: z.object({
        day: z.number().int().positive(),
        minuteOfDay: z.number().int().nonnegative(),
      }),
    })
    .safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v2 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  const state = raw as Record<string, unknown>;
  const { day, minuteOfDay } = parsed.data.calendar;
  return {
    ...state,
    schemaVersion: 3,
    calendar: calendarOnDay(day, context.daysPerSeason, minuteOfDay),
    weather: 'sunny',
    forecast: 'sunny',
  };
}

/**
 * v3 → v4：新增工具階級（全部為基礎）與世界變化（砍樹、採野薄荷，還沒有任何紀錄）。
 * 斧頭是新的工具，之後的循環順序排在最後，舊存檔的 tool 不需要改。
 */
function migrateV3ToV4(raw: unknown): unknown {
  const parsed = z.object({ tool: z.enum(['hoe', 'can', 'seedbag']) }).safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v3 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  return {
    ...(raw as Record<string, unknown>),
    schemaVersion: 4,
    toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0 },
    worldChanges: {},
  };
}

/**
 * v4 → v5：礦坑（種子與檢查點），工具新增鎬與釣竿（階級都是基礎）。
 * 舊存檔的礦坑種子由舊的隨機數狀態推出，所以同一份舊存檔每次讀取都得到同一個礦坑。
 */
function migrateV4ToV5(raw: unknown): unknown {
  const parsed = z.object({ rng: z.number().int().nonnegative().max(4294967295) }).safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v4 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  return {
    ...(raw as Record<string, unknown>),
    schemaVersion: 5,
    toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0 },
    mineSeed: advanceRng(parsed.data.rng),
    mineCheckpoint: 1,
  };
}

/** v5 → v6：技能與經驗，舊存檔的五項技能都從 0 開始。 */
function migrateV5ToV6(raw: unknown): unknown {
  const parsed = z.object({ schemaVersion: z.literal(5) }).safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v5 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  return {
    ...(raw as Record<string, unknown>),
    schemaVersion: 6,
    skills: { farming: 0, foraging: 0, fishing: 0, mining: 0, cooking: 0 },
  };
}

/** v6 → v7：釣魚（投竿後等待收線的魚，舊存檔沒有）。 */
function migrateV6ToV7(raw: unknown): unknown {
  const parsed = z.object({ schemaVersion: z.literal(6) }).safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v6 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  return { ...(raw as Record<string, unknown>), schemaVersion: 7, fishing: null };
}

/** v7 → v8：畜牧（雞舍的動物），舊存檔還沒有動物。 */
function migrateV7ToV8(raw: unknown): unknown {
  const parsed = z.object({ schemaVersion: z.literal(7) }).safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v7 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  return { ...(raw as Record<string, unknown>), schemaVersion: 8, animals: [] };
}

/**
 * v22 → v23：農場評級與豐收重置、傳承。舊存檔還沒有賺過本年收入（0）、沒有上一年（0）、沒有豐收重置（0 次）；
 * 農場是第 1 代，角色名字沿用預設（content/legacy.json）。
 */
function migrateV22ToV23(raw: unknown, context: MigrationContext): unknown {
  const parsed = z.object({ schemaVersion: z.literal(22) }).safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v22 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  return {
    ...(raw as Record<string, unknown>),
    schemaVersion: 23,
    yearlyIncome: 0,
    previousYearIncome: 0,
    resetBonus: 0,
    playerName: context.playerName,
    generation: 1,
  };
}

/** v23 → v24：每一份存檔新增四格快捷欄，舊玩家從空欄開始。 */
function migrateV23ToV24(raw: unknown): unknown {
  const parsed = z.object({ schemaVersion: z.literal(23) }).safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v23 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  return {
    ...(raw as Record<string, unknown>),
    schemaVersion: 24,
    hotbar: [null, null, null, null],
  };
}

/** v24 → v25：小屋改為 22×20 格，將三種小屋內已保存座標平移到新室內；農場座標不變。 */
function migrateV24ToV25(raw: unknown): unknown {
  const parsed = z.object({ schemaVersion: z.literal(24) }).safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v24 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  const state = raw as Record<string, unknown>;
  const mapId = state.mapId;
  const player = typeof mapId === 'string' && isHouseMapId(mapId) ? remapHousePoint(state.player) : null;
  const decor = remapHouseDecor(state.decor);
  const worldChanges = remapHouseWorldChanges(state.worldChanges);
  return {
    ...state,
    schemaVersion: 25,
    ...(player ? { player } : {}),
    ...(decor ? { decor } : {}),
    ...(worldChanges ? { worldChanges } : {}),
  };
}

const HOUSE_LAYOUT_OFFSET = { x: 6, y: 7 } as const;

function isHouseMapId(mapId: string): boolean {
  return mapId === 'house' || mapId === 'house-wing' || mapId === 'house-full';
}

function remapHousePoint(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || !('x' in value) || !('y' in value)) return value;
  const point = value as Record<string, unknown>;
  if (typeof point.x !== 'number' || typeof point.y !== 'number') return value;
  return { ...point, x: point.x + HOUSE_LAYOUT_OFFSET.x, y: point.y + HOUSE_LAYOUT_OFFSET.y };
}

function remapHouseDecor(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  const decor = value as Record<string, unknown>;
  return Object.fromEntries(Object.entries(decor).map(([roomId, placements]) => [
    roomId,
    isHouseMapId(roomId) && Array.isArray(placements)
      ? placements.map((placement) => remapHousePoint(placement))
      : placements,
  ]));
}

function remapHouseWorldChanges(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  const changes = value as Record<string, unknown>;
  return Object.fromEntries(Object.entries(changes).map(([key, change]) => {
    const match = /^(house|house-wing|house-full),(-?\d+),(-?\d+)$/.exec(key);
    if (!match) return [key, change];
    const x = Number(match[2]) + HOUSE_LAYOUT_OFFSET.x;
    const y = Number(match[3]) + HOUSE_LAYOUT_OFFSET.y;
    return [`${match[1]},${x},${y}`, change];
  }));
}

/**
 * v21 → v22：裝飾擺放（每個房間的裝飾位置）、服飾穿戴（每個角色穿的一件）、旅行商人本週的購買數量。
 * 舊存檔沒有擺過裝飾、沒有穿過衣服，也還沒買過旅行商人的東西，所以三者都從空開始。
 */
function migrateV21ToV22(raw: unknown): unknown {
  const parsed = z.object({ schemaVersion: z.literal(21) }).safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v21 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  return {
    ...(raw as Record<string, unknown>),
    schemaVersion: 22,
    decor: {},
    wearing: {},
    merchant: { week: 0, bought: {} },
  };
}

/**
 * v20 → v21：羊與布、小屋擴建、商店季節限定。舊存檔沒有羊（羊圈是空的），小屋擴建的旗標也還沒有（不補）；
 * 季節限定的商品不需要購買紀錄（配方的旗標與木材都是一次性或不限量的）。
 */
function migrateV20ToV21(raw: unknown): unknown {
  const parsed = z.object({ schemaVersion: z.literal(20) }).safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v20 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  // 舊存檔沒有 sheep 欄位就是空的羊圈；已經有（例如手動編輯過的測試存檔）就照原樣保留，之後由 schema 檢查。
  return { ...(raw as Record<string, unknown>), schemaVersion: 21, sheep: (raw as { sheep?: unknown }).sheep ?? [] };
}

/**
 * v19 → v20：秋冬內容。溫室是地圖上的改建（旗標，舊存檔還沒有）；豐穗祭的收成比賽從 0 開始；
 * 主線停在舊存檔的章節，第 4、5 章照常接在後面。不回補舊存檔的收成或點燈。
 */
function migrateV19ToV20(raw: unknown): unknown {
  const parsed = z
    .object({ schemaVersion: z.literal(19), festival: z.record(z.string(), z.unknown()).optional() })
    .safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v19 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  return {
    ...(raw as Record<string, unknown>),
    schemaVersion: 20,
    festival: { ...(parsed.data.festival ?? {}), harvest: { year: 0, count: 0 } },
  };
}

/**
 * v18 → v19：圖鑑與成就都從空開始。舊存檔已經有的魚、作物、節慶與成就進度不回補：
 * 圖鑑只計入遷移之後才取得的東西，成就只看遷移之後發生的事件（避免一次跳出一堆獎勵）。
 */
function migrateV18ToV19(raw: unknown): unknown {
  const parsed = z.object({ schemaVersion: z.literal(18) }).safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v18 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  return {
    ...(raw as Record<string, unknown>),
    schemaVersion: 19,
    collection: { found: [], claimed: [] },
    achievements: { unlocked: [], counters: {}, titles: [] },
  };
}

/**
 * v17 → v18：社區修復的紀錄（還沒有捐過任何東西）、今天的隨機事件（今天沒有事件，day 為 0）。
 */
function migrateV17ToV18(raw: unknown): unknown {
  const parsed = z.object({ schemaVersion: z.literal(17) }).safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v17 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  return {
    ...(raw as Record<string, unknown>),
    schemaVersion: 18,
    repairs: {},
    dailyEvent: { day: 0, id: null },
  };
}

/**
 * v16 → v17：星河兌換的紀錄（今年還沒有兌換過）。碎片是背包裡的素材，本來就跨年保留，不需要遷移。
 */
function migrateV16ToV17(raw: unknown): unknown {
  const parsed = z.object({ schemaVersion: z.literal(16), festival: z.record(z.string(), z.unknown()) }).safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v16 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  return {
    ...(raw as Record<string, unknown>),
    schemaVersion: 17,
    festival: { ...parsed.data.festival, exchanged: { year: 0, counts: {} } },
  };
}

/**
 * v15 → v16：主線（從序章開始，第 1 章）、節慶紀錄（每項活動都還沒參與）、夜釣星星（沒有甩竿）。
 * 舊存檔的田開墾過、作物出過貨也不會補記到主線步驟上，主線的步驟之後照常達成。
 */
function migrateV15ToV16(raw: unknown): unknown {
  const parsed = z.object({ schemaVersion: z.literal(15) }).safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v15 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  return {
    ...(raw as Record<string, unknown>),
    schemaVersion: 16,
    story: { chapter: 1 },
    festival: { done: {}, contest: { year: 0, caught: 0 }, sold: { year: 0, counts: {} } },
    starLine: false,
  };
}

/**
 * v14 → v15：委託（舊存檔一件都還沒接過）、佈告欄（還沒抽過，day 為 0）、信箱（沒有信）、圖鑑碎片（0）。
 */
function migrateV14ToV15(raw: unknown): unknown {
  const parsed = z.object({ schemaVersion: z.literal(14) }).safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v14 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  return {
    ...(raw as Record<string, unknown>),
    schemaVersion: 15,
    quests: {},
    board: { day: 0, daily: [], weekly: null },
    mail: {},
    dexFragments: 0,
  };
}

/**
 * v13 → v14：居民好感（每位居民都從 0 顆心開始，今天還沒對話或送禮）、已觸發的心形事件（沒有）、待處理的事件（沒有）。
 */
function migrateV13ToV14(raw: unknown): unknown {
  const parsed = z.object({ schemaVersion: z.literal(13) }).safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v13 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  return {
    ...(raw as Record<string, unknown>),
    schemaVersion: 14,
    friendship: {},
    heartEvents: [],
    pendingHeartEvent: null,
  };
}

/**
 * v12 → v13：牛舍與牛奶。舊存檔的雞都還沒有擠奶的紀錄（milked 為 false），牛舍還沒有牛。
 * 牛舍是否改建記在旗標裡（flags），舊存檔沒有這個旗標，也就是還沒改建。
 */
function migrateV12ToV13(raw: unknown): unknown {
  const parsed = z
    .object({
      schemaVersion: z.literal(12),
      animals: z.array(z.object({ kind: z.string().min(1), fed: z.boolean(), petted: z.boolean(), mood: z.number() })),
    })
    .safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v12 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  return {
    ...(raw as Record<string, unknown>),
    schemaVersion: 13,
    animals: parsed.data.animals.map((animal) => ({ ...animal, milked: false })),
    cows: [],
  };
}

/**
 * v11 → v12：技能天賦（舊存檔的五項技能都還沒有選過天賦）與鐮刀（階級為基礎）。
 * 天賦與鐮刀共用這一次升版，之後的新欄位要另外升版。
 */
function migrateV11ToV12(raw: unknown): unknown {
  const parsed = z.object({ schemaVersion: z.literal(11), toolTiers: z.record(z.string(), z.number()) }).safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v11 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  return {
    ...(raw as Record<string, unknown>),
    schemaVersion: 12,
    toolTiers: { ...parsed.data.toolTiers, sickle: 0 },
    talents: {},
  };
}

/** v10 → v11：施肥（田的 fertilizer 是選填欄位，舊存檔的田都沒有肥料）；只升版本。 */
function migrateV10ToV11(raw: unknown): unknown {
  const parsed = z.object({ schemaVersion: z.literal(10) }).safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v10 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  return { ...(raw as Record<string, unknown>), schemaVersion: 11 };
}

/** v9 → v10：加工機；舊存檔還沒有加工，從空的開始。 */
function migrateV9ToV10(raw: unknown): unknown {
  const parsed = z.object({ schemaVersion: z.literal(9) }).safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v9 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  return { ...(raw as Record<string, unknown>), schemaVersion: 10, processing: [] };
}

/** v8 → v9：料理（食譜與料理的物品都是內容定義，存檔不需要新欄位）；只升版本。 */
function migrateV8ToV9(raw: unknown): unknown {
  const parsed = z.object({ schemaVersion: z.literal(8) }).safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v8 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  return { ...(raw as Record<string, unknown>), schemaVersion: 9 };
}

