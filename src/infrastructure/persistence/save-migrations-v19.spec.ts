import { describe, expect, it } from 'vitest';
import { migrateState } from './save-migrations';
import { SaveFormatError } from './save-errors';

const context = { inventoryCapacity: 24, daysPerSeason: 20, wakeMinute: 360, playerName: '小涵' };

/** 一份合法的 v18 存檔內容（圖鑑與成就之前）。舊存檔已經有魚、已經參加過節慶、收成過。 */
function v18State(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 18,
    gold: 420,
    mapId: 'plaza',
    inventory: { capacity: 24, stacks: [{ itemId: 'fish.carp', quality: 'normal', count: 3 }, { itemId: 'crop.dew-grass', quality: 'normal', count: 2 }] },
    flags: { 'attended:sprout': true, 'repair:garden': true },
    festival: { done: { 'sprout:crown': 12 }, contest: { year: 1, caught: 3 }, sold: { year: 0, counts: {} }, exchanged: { year: 0, counts: {} } },
    repairs: {},
    dailyEvent: { day: 0, id: null },
    ...overrides,
  };
}

describe('migrateState v18 → v19（圖鑑與成就）', () => {
  it('bumps the save to version 19', () => {
    const migrated = migrateState(v18State(), context) as Record<string, unknown>;
    expect(migrated.schemaVersion).toBe(24);
  });

  it('starts the dex with nothing found and nothing claimed', () => {
    const migrated = migrateState(v18State(), context) as Record<string, unknown>;
    expect(migrated.collection).toEqual({ found: [], claimed: [] });
  });

  it('starts achievements with nothing unlocked, no counters and no titles', () => {
    const migrated = migrateState(v18State(), context) as Record<string, unknown>;
    expect(migrated.achievements).toEqual({ unlocked: [], counters: {}, titles: [] });
  });

  it('does not backfill: fish already caught, a festival already attended, and crops already grown stay out of the dex and the achievements', () => {
    const migrated = migrateState(v18State(), context) as { collection: { found: string[] }; achievements: { unlocked: string[]; counters: Record<string, number> } };
    expect(migrated.collection.found).toEqual([]);
    expect(migrated.achievements.unlocked).toEqual([]);
    expect(migrated.achievements.counters).toEqual({});
  });

  it('keeps everything else as it was, including the inventory and the flags', () => {
    const before = v18State();
    const migrated = migrateState(before, context) as Record<string, unknown>;
    // 節慶紀錄不在這裡比較：之後的 v19→v20 會加上收成比賽的紀錄（見 save-migrations-v20.spec.ts）。
    for (const key of ['gold', 'mapId', 'inventory', 'flags', 'repairs', 'dailyEvent']) {
      expect(migrated[key]).toEqual(before[key]);
    }
  });

  it('does not mutate the input', () => {
    const before = v18State();
    const snapshot = structuredClone(before);
    migrateState(before, context);
    expect(before).toEqual(snapshot);
  });

  it('a state from a version newer than 19 is still refused', () => {
    expect(() => migrateState({ schemaVersion: 25 }, context)).toThrow(SaveFormatError);
  });
});
