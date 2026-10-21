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
  source: z.string().min(1),
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
export const assetsFileSchema = z.object({ version: z.literal(1), assets: z.array(assetSchema) });
