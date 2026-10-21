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
export const companionsFileSchema = z.object({ version: z.literal(1), companions: z.array(companionSchema) });
export const assetsFileSchema = z.object({ version: z.literal(1), assets: z.array(assetSchema) });
