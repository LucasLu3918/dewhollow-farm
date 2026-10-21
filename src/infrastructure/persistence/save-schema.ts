import { z } from 'zod';
import { SAVE_SCHEMA_VERSION, type GameState } from '../../domain/game-state';
import type { SaveRecord } from '../../application/ports';
import { describeIssue, SaveFormatError } from './save-errors';
import { migrateState, type MigrationContext } from './save-migrations';

export { SaveFormatError } from './save-errors';

const calendar = z.object({
  year: z.number().int().positive(),
  season: z.literal('spring'),
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

/** 目前版本的存檔 schema。版本升級時凍結舊版（見 save-schema-v1.ts）並在 save-migrations.ts 加遷移。 */
export const gameStateSchema: z.ZodType<GameState> = z.object({
  schemaVersion: z.literal(SAVE_SCHEMA_VERSION),
  calendar,
  energy,
  gold: z.number().int().nonnegative(),
  mapId: z.string().min(1),
  player,
  plots: z.record(z.string(), plotState),
  inventory,
  shipBox: z.object({ entries: z.array(itemStack) }),
  flags: z.record(z.string(), z.boolean()),
  tool: z.enum(['hoe', 'can', 'seedbag']),
  selectedSeed: z.string().min(1),
  rng: z.number().int().nonnegative().max(4294967295),
  playtimeSeconds: z.number().int().nonnegative(),
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
