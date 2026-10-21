import { z } from 'zod';
import { SEASONS } from '../../domain/calendar';
import { WEATHERS } from '../../domain/weather';
import { TOOL_IDS } from '../../domain/tools';
import { SKILL_IDS } from '../../domain/skills';

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
});

const tileSchema = z.object({
  kind: z.enum(['grass', 'field', 'path', 'wall', 'bed', 'shipbox', 'door', 'tree', 'water', 'floor', 'furniture', 'cave', 'rock', 'shop', 'forage', 'ore', 'stairs', 'trough', 'kitchen', 'workshop', 'workbench', 'tuft']),
  item: z.string().min(1).optional(),
  seasons: z.array(z.enum(SEASONS)).min(1).optional(),
  slot: z.boolean().optional(),
  to: z.string().min(1).optional(),
  shop: z.string().min(1).optional(),
  spawn: point.optional(),
});

const mapSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  rows: z.array(z.string()),
  legend: z.record(z.string().length(1), tileSchema),
  spawn: point,
  npcs: z.array(z.object({ npcId: z.string().min(1), x: z.number().int(), y: z.number().int() })),
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

export const itemsFileSchema = z.object({
  version: z.literal(1),
  items: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      kind: z.enum(['material', 'forage', 'ore', 'fish', 'animal', 'dish', 'processed', 'craft']),
      maxStack: z.number().int().positive(),
      sellPrice: z.number().int().nonnegative().optional(),
    }),
  ),
});

const shopStockSchema = z.object({ itemId: z.string().min(1), price: z.number().int().positive() });
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
        unlock: z.object({ skill: z.enum(SKILL_IDS), level: z.number().int().min(0).max(10) }).optional(),
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
export const animalsFileSchema = z.object({
  version: z.literal(1),
  animals: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      eggItem: z.string().min(1),
      eggQuality: z.number().min(0).max(1),
    }),
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
