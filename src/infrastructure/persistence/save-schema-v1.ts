import { z } from 'zod';

/**
 * v1（MVP）存檔的格式，只用來在遷移前驗證舊資料。
 * 凍結不動：之後新增欄位請寫在新版本與遷移函式，不要回頭改這裡。
 */
const counts = z.record(z.string(), z.number().int().nonnegative());

export const gameStateV1Schema = z.object({
  schemaVersion: z.literal(1),
  calendar: z.object({
    year: z.number().int().positive(),
    season: z.literal('spring'),
    day: z.number().int().positive(),
    minuteOfDay: z.number().int().nonnegative(),
  }),
  energy: z.object({ current: z.number().int().nonnegative(), max: z.number().int().positive() }),
  gold: z.number().int().nonnegative(),
  mapId: z.string().min(1),
  player: z.object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    facing: z.enum(['up', 'down', 'left', 'right']),
  }),
  plots: z.record(
    z.string(),
    z.object({
      watered: z.boolean(),
      crop: z.object({ cropId: z.string().min(1), growthDays: z.number().int().nonnegative() }).nullable(),
      dryDays: z.number().int().nonnegative(),
    }),
  ),
  bag: z.object({ seeds: counts, crops: counts }),
  shipBox: z.object({ items: counts }),
  flags: z.record(z.string(), z.boolean()),
  tool: z.enum(['hoe', 'can', 'seedbag']),
  selectedSeed: z.string().min(1),
  rng: z.number().int().nonnegative().max(4294967295),
});

export type GameStateV1 = z.infer<typeof gameStateV1Schema>;
