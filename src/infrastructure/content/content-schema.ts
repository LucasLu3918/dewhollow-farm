import { z } from 'zod';

const point = z.object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative() });

const cropSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  seedPrice: z.number().int().nonnegative(),
  growthDays: z.number().int().positive(),
});

const npcSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  lines: z.array(z.string().min(1)).min(1),
  gift: z.object({ cropId: z.string().min(1), count: z.number().int().positive() }).optional(),
});

const tileSchema = z.object({
  kind: z.enum(['grass', 'field', 'path', 'wall', 'bed', 'shipbox', 'door']),
  to: z.string().min(1).optional(),
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
  action: z.enum(['till', 'water', 'plant', 'harvest', 'ship']),
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
    }),
  }),
  inventory: z.object({ capacity: z.number().int().positive() }),
  harvest: z
    .object({ min: z.number().int().positive(), max: z.number().int().positive() })
    .refine((h) => h.min <= h.max, '收穫的最小值不可大於最大值'),
  time: z.object({
    wakeMinute: z.number().int().min(0).max(1439),
    minutesPerAction: z.number().int().positive(),
  }),
});

export const tuningFileSchema = tuningSchema;
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
  footstep: z.object({ dust: hexColorSchema, sound: z.string().min(1) }),
});
export const terrainFileSchema = z.object({ version: z.literal(1), terrains: z.array(terrainSchema) });
export type TerrainDef = z.infer<typeof terrainSchema>;
export type TerrainFile = z.infer<typeof terrainFileSchema>;
