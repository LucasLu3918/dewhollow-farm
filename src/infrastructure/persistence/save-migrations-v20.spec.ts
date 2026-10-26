import { describe, expect, it } from 'vitest';
import { migrateState } from './save-migrations';
import { SaveFormatError } from './save-errors';

const context = { inventoryCapacity: 24, daysPerSeason: 20, wakeMinute: 360, playerName: '小涵' };

/** 一份合法的 v19 存檔內容（秋冬內容之前）。節慶的紀錄已經有春夏的參加與星河兌換。 */
function v19State(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 19,
    gold: 900,
    mapId: 'plaza',
    flags: { 'attended:sprout': true, 'repair:garden': true, cowbarn: true },
    festival: {
      done: { 'sprout:crown': 12 },
      contest: { year: 1, caught: 3 },
      sold: { year: 1, counts: { 'seed.star-pepper': 2 } },
      exchanged: { year: 1, counts: { 'star-string': 1 } },
    },
    story: { chapter: 3 },
    collection: { found: ['crop.moon-bean'], claimed: [] },
    ...overrides,
  };
}

describe('migrateState v19 → v20（秋冬：溫室、豐穗祭、暖燈節、主線第 4–5 章）', () => {
  it('bumps the save to the current version (21, see save-migrations-v21.spec.ts)', () => {
    const migrated = migrateState(v19State(), context) as Record<string, unknown>;
    expect(migrated.schemaVersion).toBe(24);
  });

  it('starts the harvest contest with nothing harvested', () => {
    const migrated = migrateState(v19State(), context) as { festival: Record<string, unknown> };
    expect(migrated.festival.harvest).toEqual({ year: 0, count: 0 });
  });

  it('keeps every existing festival record as it was (the done, contest, sold and exchanged tallies)', () => {
    const before = v19State();
    const migrated = migrateState(before, context) as { festival: Record<string, unknown> };
    expect(migrated.festival).toEqual({ ...(before.festival as object), harvest: { year: 0, count: 0 } });
  });

  it('keeps the remodel flags (the greenhouse is not built yet, and nothing is invented)', () => {
    const migrated = migrateState(v19State(), context) as { flags: Record<string, boolean> };
    expect(migrated.flags).toEqual({ 'attended:sprout': true, 'repair:garden': true, cowbarn: true });
    expect(migrated.flags.greenhouse).toBeUndefined();
  });

  it('keeps the main story where it was, so chapters 4 and 5 start after chapter 3 is done', () => {
    const migrated = migrateState(v19State(), context) as { story: unknown };
    expect(migrated.story).toEqual({ chapter: 3 });
  });

  it('keeps everything else, including the gold and the dex', () => {
    const before = v19State();
    const migrated = migrateState(before, context) as Record<string, unknown>;
    for (const key of ['gold', 'mapId', 'collection']) expect(migrated[key]).toEqual(before[key]);
  });

  it('does not mutate the input', () => {
    const before = v19State();
    const snapshot = structuredClone(before);
    migrateState(before, context);
    expect(before).toEqual(snapshot);
  });

  it('a state from a version newer than 21 is still refused', () => {
    expect(() => migrateState({ schemaVersion: 25 }, context)).toThrow(SaveFormatError);
  });

  it('a v19 save without a festival record gets an empty harvest tally (the other records are not invented)', () => {
    const migrated = migrateState({ schemaVersion: 19, gold: 1 }, context) as { festival: Record<string, unknown> };
    expect(migrated.festival).toEqual({ harvest: { year: 0, count: 0 } });
  });

  it('refuses a v19 save whose version is not a number', () => {
    expect(() => migrateState({ schemaVersion: 19, festival: 'nope' }, context)).toThrow('存檔 v19 格式錯誤');
  });
});
