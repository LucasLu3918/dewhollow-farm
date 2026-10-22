import { z } from 'zod';
import { SAVE_SCHEMA_VERSION, type GameState } from '../../domain/game-state';
import { SEASONS } from '../../domain/calendar';
import { WEATHERS } from '../../domain/weather';
import { TOOL_IDS } from '../../domain/tools';
import type { SaveRecord } from '../../application/ports';
import { describeIssue, SaveFormatError } from './save-errors';
import { migrateState, type MigrationContext } from './save-migrations';

export { SaveFormatError } from './save-errors';

const calendar = z.object({
  year: z.number().int().positive(),
  season: z.enum(SEASONS),
  day: z.number().int().positive(),
  minuteOfDay: z.number().int().nonnegative(),
});

const energy = z.object({
  current: z.number().int().nonnegative(),
  max: z.number().int().positive(),
});

const player = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  facing: z.enum(['up', 'down', 'left', 'right']),
});

const plotState = z.object({
  fertilizer: z.enum(['basic', 'fine']).optional(),
  watered: z.boolean(),
  crop: z
    .object({ cropId: z.string().min(1), growthDays: z.number().int().nonnegative() })
    .nullable(),
  dryDays: z.number().int().nonnegative(),
});

const itemStack = z.object({
  itemId: z.string().min(1),
  quality: z.enum(['normal', 'good', 'fine']),
  count: z.number().int().positive(),
});

const inventory = z
  .object({ capacity: z.number().int().positive(), stacks: z.array(itemStack) })
  .refine((inv) => inv.stacks.length <= inv.capacity, '背包的堆疊數超過格數');

const animal = z.object({
  kind: z.string().min(1),
  fed: z.boolean(),
  petted: z.boolean(),
  milked: z.boolean(),
  mood: z.number().int().min(0).max(10),
  /** 羊毛長了幾天（只有羊有；沒有這個欄位就是還沒開始長）。 */
  woolDays: z.number().int().nonnegative().optional(),
});

/** 目前版本的存檔 schema。版本升級時凍結舊版（見 save-schema-v1.ts）並在 save-migrations.ts 加遷移。 */
export const gameStateSchema: z.ZodType<GameState> = z.object({
  schemaVersion: z.literal(SAVE_SCHEMA_VERSION),
  calendar,
  weather: z.enum(WEATHERS),
  forecast: z.enum(WEATHERS),
  energy,
  gold: z.number().int().nonnegative(),
  mapId: z.string().min(1),
  player,
  plots: z.record(z.string(), plotState),
  inventory,
  shipBox: z.object({ entries: z.array(itemStack) }),
  flags: z.record(z.string(), z.boolean()),
  tool: z.enum(TOOL_IDS),
  toolTiers: z.object({
    hoe: z.number().int().min(0).max(3),
    can: z.number().int().min(0).max(3),
    seedbag: z.number().int().min(0).max(3),
    axe: z.number().int().min(0).max(3),
    pick: z.number().int().min(0).max(3),
    rod: z.number().int().min(0).max(3),
    sickle: z.number().int().min(0).max(3),
  }),
  skills: z.object({
    farming: z.number().int().nonnegative(),
    foraging: z.number().int().nonnegative(),
    fishing: z.number().int().nonnegative(),
    mining: z.number().int().nonnegative(),
    cooking: z.number().int().nonnegative(),
  }),
  /** 每項技能已選的天賦 id；沒選過就沒有這個欄位。 */
  talents: z.object({
    farming: z.string().min(1).optional(),
    foraging: z.string().min(1).optional(),
    fishing: z.string().min(1).optional(),
    mining: z.string().min(1).optional(),
    cooking: z.string().min(1).optional(),
  }),
  fishing: z.object({ fishId: z.string().min(1) }).nullable(),
  /** 雞舍的雞、牛舍的牛與羊圈的羊：餵飽、摸過、擠過奶（牛）、羊毛長了幾天（羊）與心情；牛舍是否改建在 flags.cowbarn。 */
  animals: z.array(animal),
  cows: z.array(animal),
  sheep: z.array(animal),
  processing: z.array(z.object({ recipeId: z.string().min(1), daysLeft: z.number().int().nonnegative() })),
  /** 居民好感：點數與今日紀錄（對話、送禮的總天數；沒有紀錄是 null）。 */
  friendship: z.record(
    z.string().min(1),
    z.object({
      points: z.number().int().nonnegative(),
      talkedDay: z.number().int().positive().nullable(),
      giftedDay: z.number().int().positive().nullable(),
    }),
  ),
  heartEvents: z.array(z.string().min(1)),
  pendingHeartEvent: z.string().min(1).nullable(),
  /** 委託紀錄（接過的才有）：進行中或已完成、數量進度、收成過的作物種類。 */
  quests: z.record(
    z.string().min(1),
    z.object({
      status: z.enum(['active', 'done']),
      progress: z.number().int().nonnegative(),
      seen: z.array(z.string().min(1)),
    }),
  ),
  /** 佈告欄今天的抽取（day 為總天數，0 表示還沒抽過）。 */
  board: z.object({
    day: z.number().int().nonnegative(),
    daily: z.array(z.string().min(1)),
    weekly: z.string().min(1).nullable(),
  }),
  /** 信箱：信件的已讀狀態（沒有紀錄代表還沒送到）。 */
  mail: z.record(z.string().min(1), z.enum(['unread', 'read'])),
  dexFragments: z.number().int().nonnegative(),
  /** 主線進度：目前要完成的章節號（全部完成後是章節數加一）。 */
  story: z.object({ chapter: z.number().int().positive() }),
  /** 節慶紀錄：每項活動最後一次參與的年份、釣魚比賽（哪一年、幾條）、夜市攤位（哪一年、各項售出數）、星河兌換（哪一年、各項次數）。 */
  festival: z.object({
    done: z.record(z.string().min(1), z.number().int().positive()),
    contest: z.object({ year: z.number().int().nonnegative(), caught: z.number().int().nonnegative() }),
    sold: z.object({ year: z.number().int().nonnegative(), counts: z.record(z.string().min(1), z.number().int().positive()) }),
    exchanged: z.object({ year: z.number().int().nonnegative(), counts: z.record(z.string().min(1), z.number().int().positive()) }),
    /** 收成比賽（豐穗祭）：哪一年、指定作物已收成幾個。 */
    harvest: z.object({ year: z.number().int().nonnegative(), count: z.number().int().nonnegative() }),
  }),
  /** 夜釣星星是否正在等收網（甩竿後為真）。 */
  starLine: z.boolean(),
  /** 社區修復：每項修復的紀錄（年份、各物品已捐的數量、是否完成）。 */
  repairs: z.record(
    z.string().min(1),
    z.object({
      year: z.number().int().nonnegative(),
      donated: z.record(z.string().min(1), z.number().int().positive()),
      done: z.boolean(),
    }),
  ),
  /** 今天的隨機事件（day 為事件那天的總天數；id 為 null 表示今天沒有事件）。 */
  dailyEvent: z.object({ day: z.number().int().nonnegative(), id: z.string().min(1).nullable() }),
  /** 圖鑑：已發現的條目（物品 id）與已領過的門檻獎勵（`類別:門檻`）。 */
  collection: z.object({
    found: z.array(z.string().min(1)),
    claimed: z.array(z.string().min(1)),
  }),
  /** 成就：已達成的成就 id、計數器（事件次數）與稱號。 */
  achievements: z.object({
    unlocked: z.array(z.string().min(1)),
    counters: z.record(z.string().min(1), z.number().int().nonnegative()),
    titles: z.array(z.string().min(1)),
  }),
  /** 小屋裡擺的裝飾，依房間（地圖 id）記位置。 */
  decor: z.record(
    z.string().min(1),
    z.array(z.object({ itemId: z.string().min(1), x: z.number().int().nonnegative(), y: z.number().int().nonnegative() })),
  ),
  /** 身上穿的衣服或帽子，依角色 id 記（沒有這一角色的紀錄就是沒穿）。 */
  wearing: z.record(z.string().min(1), z.string().min(1)),
  /** 旅行商人本週的購買數量（week 為那一週週一的總天數）。 */
  merchant: z.object({
    week: z.number().int().nonnegative(),
    bought: z.record(z.string().min(1), z.number().int().positive()),
  }),
  mineSeed: z.number().int().nonnegative().max(4294967295),
  /** 礦坑沒有底，檢查點可以是任何正整數層（見 domain/mine.ts）。 */
  mineCheckpoint: z.number().int().min(1),
  worldChanges: z.record(z.string(), z.enum(['chopped', 'picked', 'mined', 'cleared', 'cut'])),
  selectedSeed: z.string().min(1),
  rng: z.number().int().nonnegative().max(4294967295),
  playtimeSeconds: z.number().int().nonnegative(),
  /** 農場評級與豐收重置、傳承：本年收入、上一年收入、豐收次數、角色名字與代數（見 domain/income.ts、legacy.ts）。 */
  yearlyIncome: z.number().int().nonnegative(),
  previousYearIncome: z.number().int().nonnegative(),
  resetBonus: z.number().int().min(0).max(3),
  playerName: z.string().min(1).max(8),
  generation: z.number().int().positive(),
});

const recordSchema = z.object({
  slot: z.string().min(1),
  savedAt: z.string().min(1),
  state: z.unknown(),
});

/**
 * 解析存檔紀錄：先依版本遷移到目前格式，再驗證。
 * 格式錯誤時拋出可讀的 SaveFormatError，而不是靜默忽略。
 */
export function parseSaveRecord(raw: unknown, context: MigrationContext): SaveRecord {
  const envelope = recordSchema.safeParse(raw);
  if (!envelope.success) {
    throw new SaveFormatError(`存檔外層格式錯誤：${envelope.error.issues[0]?.message ?? '未知'}`);
  }
  const migrated = migrateState(envelope.data.state, context);
  const state = gameStateSchema.safeParse(migrated);
  if (!state.success) {
    throw new SaveFormatError(`存檔內容格式錯誤於 ${describeIssue(state.error.issues[0])}`);
  }
  return { slot: envelope.data.slot, savedAt: envelope.data.savedAt, state: state.data };
}
