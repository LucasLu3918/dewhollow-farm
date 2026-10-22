import { z } from 'zod';
import { SEASONS } from '../../domain/calendar';
import { WEATHERS } from '../../domain/weather';
import { TOOL_IDS } from '../../domain/tools';
import { SKILL_IDS } from '../../domain/skills';
import { PERIODS } from '../../domain/schedule';
import { HEART_EMOTES } from '../../domain/heart-events';

const point = z.object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative() });

const cropSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  seedPrice: z.number().int().nonnegative(),
  growthDays: z.number().int().positive(),
  seasons: z.array(z.enum(SEASONS)).min(1, '作物至少要有一個可種植的季節'),
});

const npcSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  lines: z.array(z.string().min(1)).min(1),
  gift: z.object({ cropId: z.string().min(1), count: z.number().int().positive() }).optional(),
  /** 喜歡與討厭的物品 id（送禮與作物品質，見 domain/friendship.ts）。 */
  loves: z.array(z.string().min(1)),
  hates: z.array(z.string().min(1)),
  playMinutes: z.number().positive().max(60),
});

/** 解鎖條件：日期（從某季某天起開放）或旗標；hint 是條件不符時給玩家看的話。 */
const requirementSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('date'),
    season: z.enum(SEASONS),
    day: z.number().int().positive().max(60),
    hint: z.string().min(1),
    note: z.string().optional(),
  }),
  z.object({
    type: z.literal('flag'),
    flag: z.string().min(1),
    hint: z.string().min(1),
    note: z.string().optional(),
  }),
]);

const tileSchema = z.object({
  kind: z.enum(['grass', 'field', 'path', 'wall', 'bed', 'shipbox', 'door', 'tree', 'water', 'floor', 'furniture', 'cave', 'rock', 'shop', 'forage', 'ore', 'stairs', 'trough', 'kitchen', 'workshop', 'workbench', 'tuft', 'fence']),
  item: z.string().min(1).optional(),
  seasons: z.array(z.enum(SEASONS)).min(1).optional(),
  slot: z.boolean().optional(),
  to: z.string().min(1).optional(),
  shop: z.string().min(1).optional(),
  spawn: point.optional(),
  requires: requirementSchema.optional(),
  notice: z.enum(['bulletin', 'mailbox', 'festival', 'repair']).optional(),
  festival: z.enum(['stars']).optional(),
});

const mapSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  rows: z.array(z.string()),
  legend: z.record(z.string().length(1), tileSchema),
  spawn: point,
  flock: z.enum(['animals', 'cows']).optional(),
});

const startSchema = z.object({
  mapId: z.string().min(1),
  gold: z.number().int().nonnegative(),
  seeds: z.record(z.string(), z.number().int().nonnegative()),
});

const assetSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['tile', 'object', 'overlay', 'crop', 'character']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  file: z.string().min(1).optional(),
  density: z.number().int().min(1).max(4).optional(),
  mirrorOf: z.string().min(1).optional(),
  source: z.string().min(1),
});

const textureSize = z.object({ width: z.number().int().positive(), height: z.number().int().positive() });

// 嚴格：未知的參數名稱直接拒絕，避免打錯字卻沒有任何效果。
const walkParams = z
  .strictObject({
    bob: z.number(),
    swayDegrees: z.number(),
    airStretch: z.number(),
    lift: z.number(),
    footStretch: z.number(),
    hopHeight: z.number(),
    hopStretch: z.number(),
    breatheDelayMs: z.number(),
    breathePeriodMs: z.number(),
    breatheAmount: z.number(),
  })
  .partial()
  .optional();

const bipedRigSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('biped'),
  textureSize,
  legTop: z.number().int().positive(),
  views: z.object({ down: z.string().min(1), up: z.string().min(1), left: z.string().min(1), right: z.string().min(1) }),
  // 範圍（落在圖片內）由 rigProblems 檢查，這裡只管型別，才能回報「哪一個 split 錯在哪」。
  splits: z.object({ down: z.number().int(), up: z.number().int(), left: z.number().int(), right: z.number().int().optional() }),
  hands: z.object({ down: point, up: point, left: point, right: point.optional() }).optional(),
  params: walkParams,
});

const wholeRigSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['single', 'hop']),
  textureSize,
  asset: z.string().min(1),
  params: walkParams,
});

const rigSchema = z.union([bipedRigSchema, wholeRigSchema]);

const toolSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['till', 'water', 'plant', 'harvest', 'ship', 'chop', 'forage', 'mine', 'fish', 'cook']),
  asset: z.string().min(1),
  textureSize,
  grip: point,
  swing: z.enum(['chop', 'pour', 'sow']),
});

const companionSchema = z.object({
  id: z.string().min(1),
  rig: z.string().min(1),
  follows: z.literal('player').optional(),
  home: z.object({ mapId: z.string().min(1), x: z.number().int(), y: z.number().int() }).optional(),
  reactsTo: z.string().min(1).optional(),
});

const cost = z.number().int().nonnegative();

const tuningSchema = z.object({
  energy: z.object({
    max: z.number().int().positive(),
    costs: z.object({
      till: cost,
      water: cost,
      plant: cost,
      harvest: cost,
      ship: cost,
      chop: cost,
      forage: cost,
      mine: cost,
      fish: cost,
      cook: cost,
      process: cost,
    }),
  }),
  tools: z.object({
    tiers: z.array(z.object({ energyDiscount: z.number().int().nonnegative() })).length(4, '工具要有 4 個階級（基礎、銅、銀、金）'),
  }),
  fishing: z.object({
    biteChance: z.number().int().min(0).max(100),
    bobberBonus: z.number().int().min(0).max(100),
    baitBonus: z.number().int().min(0).max(100),
  }),
  fertilizer: z.object({
    basic: z.object({ goodBonus: z.number().int().min(0).max(100), fineBonus: z.number().int().min(0).max(100) }),
    fine: z.object({ goodBonus: z.number().int().min(0).max(100), fineBonus: z.number().int().min(0).max(100) }),
  }),
  processing: z.object({ slots: z.number().int().positive() }),
  skills: z.object({
    thresholds: z.array(z.number().int().nonnegative()).min(2).max(11),
    xp: z.record(z.string(), z.number().int().nonnegative()),
    bonusFrom: z.number().int().min(1).max(10),
    goodFrom: z.number().int().min(0).max(10),
    goodChance: z.number().min(0).max(1),
    fineFrom: z.number().int().min(0).max(10),
    fineChance: z.number().min(0).max(1),
  }),
  gathering: z.object({
    wood: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }),
    forage: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }),
    stone: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }),
    ore: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }),
  }),
  inventory: z.object({ capacity: z.number().int().positive() }),
  harvest: z
    .object({ min: z.number().int().positive(), max: z.number().int().positive() })
    .refine((h) => h.min <= h.max, '收穫的最小值不可大於最大值'),
  time: z.object({
    wakeMinute: z.number().int().min(0).max(1439),
    minutesPerAction: z.number().int().positive(),
    daysPerSeason: z.number().int().positive().max(60),
  }),
});

export const tuningFileSchema = tuningSchema;

/** 礦坑的深層規則（第 41 層起）。符號與物品的關係、寬度上限等由 load-content.ts 的 mineProblems 檢查。 */
const mineOreSchema = z.object({
  item: z.string().min(1),
  symbol: z.string().length(1),
  fromLayer: z.number().int().min(1),
  toLayer: z.number().int().min(1).optional(),
  weight: z.number().positive(),
  yield: z
    .object({ min: z.number().int().min(0), max: z.number().int().min(0) })
    .refine((range) => range.min <= range.max, { message: 'yield.min 不可大於 yield.max' })
    .optional(),
});
export const mineFileSchema = z.object({
  version: z.literal(1),
  note: z.string().optional(),
  widthPerLayer: z.number().int().min(1),
  maxWidth: z.number().int().positive(),
  oreChance: z.object({
    base: z.number().min(0).max(1),
    perLayer: z.number().min(0),
    max: z.number().min(0).max(1),
  }),
  ores: z.array(mineOreSchema).min(1),
});

export const itemsFileSchema = z.object({
  version: z.literal(1),
  items: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      kind: z.enum(['material', 'forage', 'ore', 'fish', 'animal', 'dish', 'processed', 'craft', 'building', 'decor']),
      maxStack: z.number().int().positive(),
      sellPrice: z.number().int().nonnegative().optional(),
    }),
  ),
});

const shopStockSchema = z.object({
  itemId: z.string().min(1),
  price: z.number().int().positive(),
  limit: z.number().int().positive().optional(),
});
const toolUpgradeSchema = z.object({
  toolId: z.enum(TOOL_IDS),
  tier: z.number().int().min(1).max(3),
  gold: z.number().int().positive(),
  items: z.record(z.string().min(1), z.number().int().positive()),
});
export const recipesFileSchema = z.object({
  version: z.literal(1),
  recipes: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      ingredients: z.record(z.string().min(1), z.number().int().positive()),
      energy: z.number().int().positive(),
      level: z.number().int().min(0).max(10),
      sellPrice: z.number().int().nonnegative(),
    }),
  ),
});
const craftEffectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('flag'), flag: z.string().min(1) }),
  z.object({ type: z.literal('bagSlots'), slots: z.number().int().positive(), max: z.number().int().positive() }),
]);
export const craftingFileSchema = z.object({
  version: z.literal(1),
  recipes: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        ingredients: z.record(z.string().min(1), z.number().int().positive()),
        output: z.object({ item: z.string().min(1), count: z.number().int().positive() }).optional(),
        effect: craftEffectSchema.optional(),
        unlock: z
          .union([
            z.object({ skill: z.enum(SKILL_IDS), level: z.number().int().min(0).max(10) }),
            z.object({ flag: z.string().min(1) }),
          ])
          .optional(),
        playMinutes: z.number().positive().max(60),
      }),
    )
    .refine((list) => list.every((r) => r.output || r.effect), '合成配方要有產物或效果'),
});
export const processingFileSchema = z.object({
  version: z.literal(1),
  recipes: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      ingredients: z.record(z.string().min(1), z.number().int().positive()),
      output: z.string().min(1),
      days: z.number().int().positive().max(14),
      level: z.number().int().min(0).max(10),
    }),
  ),
});
const milkSchema = z
  .object({
    item: z.string().min(1),
    goodChance: z.number().min(0).max(1),
    fineChance: z.number().min(0).max(1),
  })
  .refine((m) => m.fineChance <= m.goodChance, '精良奶的機率不可高於優良奶');
export const animalsFileSchema = z.object({
  version: z.literal(1),
  animals: z.array(
    z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        eggItem: z.string().min(1).optional(),
        eggQuality: z.number().min(0).max(1).optional(),
        milk: milkSchema.optional(),
      })
      .refine((a) => (a.eggItem !== undefined) !== (a.milk !== undefined), '動物要嘛下蛋、要嘛產奶，且只能是其中一種')
      .refine((a) => a.eggItem === undefined || a.eggQuality !== undefined, '下蛋的動物要有 eggQuality'),
  ),
});
export const fishFileSchema = z.object({
  version: z.literal(1),
  fish: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      sellPrice: z.number().int().positive(),
      seasons: z.array(z.enum(SEASONS)).min(1),
      weight: z.number().int().positive(),
    }),
  ),
});
export const shopsFileSchema = z.object({
  version: z.literal(1),
  shops: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      festival: z.string().min(1).optional(),
      stock: z.array(shopStockSchema),
      upgrades: z.array(toolUpgradeSchema),
    }),
  ),
});
/** 技能天賦（見 domain/talents.ts 與 content/talents.json）。 */
const talentEffectSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('extraYield'),
    action: z.enum(['harvest', 'forage', 'chop', 'mine']),
    chance: z.number().gt(0).max(1),
    item: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal('sellBonus'),
    kinds: z.array(z.enum(['seed', 'crop', 'material', 'forage', 'ore', 'fish', 'animal', 'dish', 'processed', 'craft'])).min(1),
    percent: z.number().int().positive().max(100),
  }),
  z.object({ type: z.literal('biteBonus'), points: z.number().int().positive().max(100) }),
  z.object({ type: z.literal('dishEnergy'), amount: z.number().int().positive().max(50) }),
]);
export const talentsFileSchema = z.object({
  version: z.literal(1),
  unlockLevel: z.number().int().min(1).max(10),
  talents: z.array(
    z.object({
      id: z.string().min(1),
      skill: z.enum(SKILL_IDS),
      name: z.string().min(1),
      description: z.string().min(1),
      effect: talentEffectSchema,
    }),
  ),
});

/** 居民行程（見 domain/schedule.ts 與 content/schedules.json）。 */
const scheduleEntrySchema = z.object({
  npcId: z.string().min(1),
  period: z.enum(PERIODS),
  weather: z.array(z.enum(WEATHERS)).min(1).optional(),
  mapId: z.string().min(1),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});
export const scheduleFileSchema = z.object({
  version: z.literal(1),
  note: z.string().optional(),
  periods: z
    .object({ noon: z.number().int().min(0).max(1439), evening: z.number().int().min(0).max(1439) })
    .refine((p) => p.noon < p.evening, '中午的分界要早於傍晚的分界'),
  entries: z.array(scheduleEntrySchema),
});

/** 心形事件（見 domain/heart-events.ts 與 content/events.json）。 */
const heartEventOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  reply: z.string().min(1),
  points: z.number().int().min(-100).max(100),
});
const heartEventSchema = z.object({
  id: z.string().min(1),
  npcId: z.string().min(1),
  hearts: z.number().int().min(1).max(10),
  phase: z.enum(SEASONS),
  mapId: z.string().min(1),
  periods: z.array(z.enum(PERIODS)).min(1),
  emote: z.enum(HEART_EMOTES),
  pages: z.array(z.string().min(1)).min(2).max(3),
  options: z.array(heartEventOptionSchema).min(1).max(2),
  playMinutes: z.number().positive().max(60),
});
export const heartEventsFileSchema = z.object({
  version: z.literal(1),
  note: z.string().optional(),
  events: z.array(heartEventSchema),
});

/** 好感規則（見 domain/friendship.ts 與 content/friendship.json）。 */
export const friendshipFileSchema = z.object({
  version: z.literal(1),
  note: z.string().optional(),
  pointsPerHeart: z.number().int().positive(),
  maxHearts: z.number().int().min(1).max(10),
  earlyCap: z.object({ hearts: z.number().int().min(0).max(10), untilSeason: z.enum(SEASONS) }),
  talkPoints: z.number().int().nonnegative(),
  gift: z.object({ love: z.number().int(), neutral: z.number().int(), hate: z.number().int() }),
  cropQuality: z.object({
    minHearts: z.number().int().min(0).max(10),
    perResident: z.number().min(0).max(1),
    cap: z.number().min(0).max(1),
  }),
});

/** 委託與佈告欄（見 domain/quests.ts、domain/bulletin.ts 與 content/quests.json）。 */
const questGoalSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('deliver'), itemId: z.string().min(1), count: z.number().int().positive().max(99) }),
  z.object({ type: z.literal('harvestKinds'), count: z.number().int().positive().max(10) }),
  z.object({ type: z.literal('ship'), count: z.number().int().positive().max(999) }),
  z.object({ type: z.literal('hearts'), npcId: z.string().min(1), hearts: z.number().int().min(1).max(10) }),
  z.object({ type: z.literal('visit'), mapId: z.string().min(1) }),
  z.object({ type: z.literal('fish'), fishId: z.string().min(1), count: z.number().int().positive().max(99) }),
  z.object({ type: z.literal('mineLayer'), layer: z.number().int().min(1) }),
  z.object({ type: z.literal('cook'), recipeId: z.string().min(1), count: z.number().int().positive().max(99) }),
]);
const questUnlockSchema = z.object({
  hearts: z.object({ npcId: z.string().min(1), hearts: z.number().int().min(1).max(10) }).optional(),
  flag: z.string().min(1).optional(),
  heartEvent: z.string().min(1).optional(),
  letter: z.string().min(1).optional(),
});
const questRewardSchema = z.object({
  gold: z.number().int().nonnegative().optional(),
  items: z.record(z.string().min(1), z.number().int().positive()).optional(),
  friendship: z.number().int().nonnegative().max(200).optional(),
  flag: z.string().min(1).optional(),
  fragments: z.number().int().nonnegative().optional(),
});
const questSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['resident', 'daily', 'weekly']),
  title: z.string().min(1),
  giver: z.string().min(1).optional(),
  request: z.string().min(1),
  thanks: z.string().min(1),
  goal: questGoalSchema,
  unlock: questUnlockSchema.optional(),
  reward: questRewardSchema,
  phase: z.enum(SEASONS),
  playMinutes: z.number().positive().max(60),
});
export const questsFileSchema = z.object({
  version: z.literal(1),
  note: z.string().optional(),
  bulletin: z.object({
    postedBy: z.string().min(1),
    dailyCount: z.number().int().positive(),
    daily: z.array(z.string().min(1)),
    weekly: z.array(z.string().min(1)),
  }),
  quests: z.array(questSchema),
});

/** 節慶（見 domain/festival.ts 與 content/festivals.json）。 */
const festivalSwapSchema = z.object({
  npcId: z.string().min(1),
  give: z.object({ itemId: z.string().min(1), count: z.number().int().positive() }),
  receive: z.object({ itemId: z.string().min(1), count: z.number().int().positive() }),
});
/** 星河兌換：付出的物品換到物品或解鎖旗標（至少要有一個），每年最多 limit 次。 */
const starExchangeSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    give: z.object({ itemId: z.string().min(1), count: z.number().int().positive() }),
    receive: z.object({ itemId: z.string().min(1), count: z.number().int().positive() }).optional(),
    flag: z.string().min(1).optional(),
    limit: z.number().int().positive().max(99),
    playMinutes: z.number().positive().max(60),
  })
  .refine((line) => line.receive !== undefined || line.flag !== undefined, '星河兌換要換到物品或解鎖旗標（至少一個）');
const festivalSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  season: z.enum(SEASONS),
  day: z.number().int().positive().max(60),
  mapId: z.string().min(1),
  fromMinute: z.number().int().min(0).max(1439),
  playMinutes: z.number().positive().max(60),
  shop: z.string().min(1).optional(),
  swaps: z.array(festivalSwapSchema).optional(),
  crown: z.object({ gold: z.number().int().nonnegative() }).optional(),
  contest: z.object({ count: z.number().int().positive().max(99), gold: z.number().int().nonnegative() }).optional(),
  stars: z
    .object({
      cycleMs: z.number().int().positive(),
      zone: z
        .object({ from: z.number().min(0).max(1), to: z.number().min(0).max(1) })
        .refine((zone) => zone.from <= zone.to, '收網區間的起點不可大於終點'),
      itemId: z.string().min(1),
    })
    .optional(),
  exchange: z.array(starExchangeSchema).optional(),
});
export const festivalsFileSchema = z.object({
  version: z.literal(1),
  note: z.string().optional(),
  festivals: z.array(festivalSchema),
});

/** 社區修復（見 domain/repairs.ts 與 content/repairs.json）。 */
const repairGoalSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('kinds'),
    pool: z.array(z.string().min(1)).min(1),
    count: z.number().int().positive().max(99),
    each: z.number().int().positive().max(5),
  }),
  z.object({
    type: z.literal('total'),
    pool: z.array(z.string().min(1)).min(1),
    count: z.number().int().positive().max(99),
  }),
]);
const repairSchema = z.object({
  id: z.string().min(1),
  season: z.enum(SEASONS),
  name: z.string().min(1),
  request: z.string().min(1),
  done: z.string().min(1),
  goal: repairGoalSchema,
  reward: z.object({
    gold: z.number().int().nonnegative().optional(),
    flags: z.array(z.string().min(1)).optional(),
  }),
  playMinutes: z.number().positive().max(60),
});
export const repairsFileSchema = z.object({
  version: z.literal(1),
  note: z.string().optional(),
  repairs: z.array(repairSchema),
});

/** 隨機事件（見 domain/random-events.ts 與 content/events-random.json）。 */
const randomEventEffectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('grant'), items: z.record(z.string().min(1), z.number().int().positive()) }),
  z.object({ type: z.literal('yield'), action: z.enum(['harvest', 'forage', 'chop', 'mine']), chance: z.number().min(0).max(1) }),
  z.object({ type: z.literal('bite'), points: z.number().int().min(0).max(100) }),
  z.object({
    type: z.literal('concert'),
    mapId: z.string().min(1),
    period: z.enum(PERIODS),
    spots: z.array(z.object({ npcId: z.string().min(1), x: z.number().int().nonnegative(), y: z.number().int().nonnegative() })).min(1),
  }),
]);
const randomEventSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  message: z.string().min(1),
  seasons: z.array(z.enum(SEASONS)).min(1),
  weathers: z.array(z.enum(WEATHERS)),
  weekdays: z.array(z.number().int().min(0).max(6)),
  period: z.enum(['day', 'night']),
  effect: randomEventEffectSchema,
  playMinutes: z.number().positive().max(60),
});
export const randomEventsFileSchema = z.object({
  version: z.literal(1),
  note: z.string().optional(),
  chance: z.number().int().min(0).max(100),
  events: z.array(randomEventSchema),
});

/** 主線章節（見 domain/story.ts 與 content/main-quest.json）。每個步驟恰好一個旗標或一件委託。 */
const storyStepSchema = z
  .object({
    hint: z.string().min(1),
    flag: z.string().min(1).optional(),
    quest: z.string().min(1).optional(),
  })
  .refine((step) => (step.flag !== undefined) !== (step.quest !== undefined), '步驟要恰好有旗標（flag）或委託（quest）其中之一');
const storyChapterSchema = z.object({
  id: z.string().min(1),
  number: z.number().int().positive(),
  title: z.string().min(1),
  window: z.string().min(1),
  phase: z.enum(SEASONS),
  intro: z.string().min(1),
  complete: z.string().min(1),
  steps: z.array(storyStepSchema).min(1),
  reward: z.object({
    gold: z.number().int().nonnegative().optional(),
    items: z.record(z.string().min(1), z.number().int().positive()).optional(),
    flag: z.string().min(1).optional(),
  }),
  playMinutes: z.number().positive().max(60),
});
export const mainQuestFileSchema = z.object({
  version: z.literal(1),
  note: z.string().optional(),
  chapters: z.array(storyChapterSchema),
});

/** 信件（見 domain/mail.ts 與 content/letters.json）。 */
const letterSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  title: z.string().min(1),
  body: z.array(z.string().min(1)).min(1),
  phase: z.enum(SEASONS),
  playMinutes: z.number().positive().max(60),
  due: z.object({ season: z.enum(SEASONS), day: z.number().int().positive().max(60) }).optional(),
  unlock: questUnlockSchema.optional(),
});
export const lettersFileSchema = z.object({
  version: z.literal(1),
  note: z.string().optional(),
  letters: z.array(letterSchema),
});

export const cropsFileSchema = z.array(cropSchema);
export const npcsFileSchema = z.array(npcSchema);
export const mapFileSchema = mapSchema;
export const startFileSchema = startSchema;
export const rigsFileSchema = z.object({ version: z.literal(1), rigs: z.array(rigSchema) });
export const toolsFileSchema = z.object({ version: z.literal(1), tools: z.array(toolSchema) });
export const companionsFileSchema = z.object({ version: z.literal(1), companions: z.array(companionSchema) });
export const assetsFileSchema = z.object({ version: z.literal(1), assets: z.array(assetSchema) });

/** 音效：程式合成用的音軌（見 src/presentation/audio/synth.ts）。 */
const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/, '顏色必須是小寫的 #rrggbb');
const voiceSchema = z
  .object({
    wave: z.enum(['sine', 'triangle', 'square', 'sawtooth', 'noise']),
    from: z.number().min(20).max(8000),
    /** 省略表示音高不變。 */
    to: z.number().min(20).max(8000).optional(),
    start: z.number().min(0).max(1),
    duration: z.number().positive().max(1),
    gain: z.number().min(0).max(1),
    attack: z.number().min(0),
  })
  .refine((voice) => voice.attack <= voice.duration, { message: 'attack 不可長於 duration' });
const soundRecipeSchema = z.object({ voices: z.array(voiceSchema).min(1) });
export const soundsFileSchema = z.object({
  version: z.literal(1),
  master: z.number().min(0).max(1),
  sounds: z.record(z.string(), soundRecipeSchema),
});
export type SoundRecipe = z.infer<typeof soundRecipeSchema>;
export type SoundsFile = z.infer<typeof soundsFileSchema>;

/**
 * 背景音樂：程式合成的循環曲（見 src/presentation/audio/music-track.ts 與 music-player.ts）。
 * 音符是 [度數, 拍數]；度數 null 為休止符，度數 0 為主音，負數為低音。
 */
const musicNoteSchema = z.tuple([z.number().int().nullable(), z.number().positive().max(16)]);
const musicScaleSchema = z
  .array(z.number().int().min(0).max(11))
  .min(2, '音階至少要有兩個音')
  .refine((steps) => steps[0] === 0 && steps.every((step, i) => i === 0 || step > (steps[i - 1] ?? -1)), '音階要從 0 開始，由低到高排列');
const musicVoiceSchema = z.object({
  wave: z.enum(['sine', 'triangle', 'square', 'sawtooth']),
  gain: z.number().min(0).max(1),
  octaves: z.number().int().min(-3).max(3),
  notes: z.array(musicNoteSchema).min(1),
});
const musicTrackSchema = z.object({
  id: z.string().min(1),
  season: z.enum(SEASONS),
  period: z.enum(['day', 'night']),
  tonic: z.number().int().min(24).max(96),
  scale: z.string().min(1),
  bpm: z.number().min(30).max(240),
  melody: musicVoiceSchema,
  bass: musicVoiceSchema,
});
export const musicFileSchema = z.object({
  version: z.literal(1),
  master: z.number().min(0).max(1),
  fadeSeconds: z.number().positive().max(10),
  rainKeepsTrack: z.boolean(),
  source: z.string().min(1),
  note: z.string().optional(),
  scales: z.record(z.string().min(1), musicScaleSchema),
  tracks: z.array(musicTrackSchema).min(1),
});
export type MusicFile = z.infer<typeof musicFileSchema>;
export type MusicTrackDef = MusicFile['tracks'][number];
export type MusicVoiceDef = MusicTrackDef['melody'];

/** 地形：走在上面的腳步（塵土顏色與音效）。 */
const terrainSchema = z.object({
  kind: z.string().min(1),
  /** 戶外才會有雪地腳步（室內不下雪）。 */
  outdoor: z.boolean().default(false),
  footstep: z.object({ dust: hexColorSchema, sound: z.string().min(1) }),
});
export const terrainFileSchema = z.object({ version: z.literal(1), terrains: z.array(terrainSchema) });
export type TerrainDef = z.infer<typeof terrainSchema>;
export type TerrainFile = z.infer<typeof terrainFileSchema>;

/** 天氣表：每個季節可能出現的天氣與權重（見 domain/weather.ts）。 */
const weatherChanceSchema = z.object({
  weather: z.enum(WEATHERS),
  weight: z.number().int().positive(),
});
export const weatherFileSchema = z.object({
  version: z.literal(1),
  seasons: z.object({
    spring: z.array(weatherChanceSchema).min(1),
    summer: z.array(weatherChanceSchema).min(1),
    autumn: z.array(weatherChanceSchema).min(1),
    winter: z.array(weatherChanceSchema).min(1),
  }),
});
export type WeatherFile = z.infer<typeof weatherFileSchema>;
