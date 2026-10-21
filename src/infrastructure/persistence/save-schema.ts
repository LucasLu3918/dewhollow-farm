import { z } from 'zod';
import { SAVE_SCHEMA_VERSION, type GameState } from '../../domain/game-state';
import type { SaveRecord } from '../../application/ports';

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

const counts = z.record(z.string(), z.number().int().nonnegative());

/** 存檔的 schema。版本升級時在這裡加入遷移，而不是改寫舊版欄位。 */
export const gameStateSchema: z.ZodType<GameState> = z.object({
  schemaVersion: z.literal(SAVE_SCHEMA_VERSION),
  calendar,
  energy,
  gold: z.number().int().nonnegative(),
  mapId: z.string().min(1),
  player,
  plots: z.record(z.string(), plotState),
  bag: z.object({ seeds: counts, crops: counts }),
  shipBox: z.object({ items: counts }),
  flags: z.record(z.string(), z.boolean()),
  tool: z.enum(['hoe', 'can', 'seedbag']),
  selectedSeed: z.string().min(1),
  rng: z.number().int().nonnegative().max(4294967295),
});

const recordSchema = z.object({
  slot: z.string().min(1),
  savedAt: z.string().min(1),
  state: z.unknown(),
});

export class SaveFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveFormatError';
  }
}

/** 解析存檔紀錄；格式錯誤時拋出可讀的 SaveFormatError，而不是靜默忽略。 */
export function parseSaveRecord(raw: unknown): SaveRecord {
  const envelope = recordSchema.safeParse(raw);
  if (!envelope.success) {
    throw new SaveFormatError(`存檔外層格式錯誤：${envelope.error.issues[0]?.message ?? '未知'}`);
  }
  const state = gameStateSchema.safeParse(envelope.data.state);
  if (!state.success) {
    const issue = state.error.issues[0];
    const where = issue ? issue.path.join('.') || '(根)' : '(未知)';
    throw new SaveFormatError(`存檔內容格式錯誤於 ${where}：${issue?.message ?? '未知'}`);
  }
  return { slot: envelope.data.slot, savedAt: envelope.data.savedAt, state: state.data };
}
