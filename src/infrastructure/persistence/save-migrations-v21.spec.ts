import { describe, expect, it } from 'vitest';
import { migrateState } from './save-migrations';
import { SaveFormatError } from './save-errors';

const context = { inventoryCapacity: 24, daysPerSeason: 20, wakeMinute: 360 };

/** 一份合法的 v20 存檔內容（羊與布、小屋擴建之前）。牛與雞已經有了。 */
function v20State(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 20,
    gold: 900,
    mapId: 'house',
    flags: { cowbarn: true, greenhouse: true },
    animals: [{ kind: 'chicken', fed: true, petted: false, milked: false, mood: 6 }],
    cows: [{ kind: 'cow', fed: false, petted: true, milked: false, mood: 7 }],
    collection: { found: ['animal.cow'], claimed: [] },
    ...overrides,
  };
}

describe('migrateState v20 → v21（羊與布、小屋擴建、商店季節限定）', () => {
  it('bumps the save to version 21', () => {
    const migrated = migrateState(v20State(), context) as Record<string, unknown>;
    expect(migrated.schemaVersion).toBe(21);
  });

  it('starts with no sheep: the pasture was never stocked in an old save', () => {
    const migrated = migrateState(v20State(), context) as { sheep: unknown };
    expect(migrated.sheep).toEqual([]);
  });

  it('keeps the chickens and cows exactly as they were', () => {
    const before = v20State();
    const migrated = migrateState(before, context) as Record<string, unknown>;
    expect(migrated.animals).toEqual(before.animals);
    expect(migrated.cows).toEqual(before.cows);
  });

  it('does not invent a house expansion: the flags are kept as they were', () => {
    const migrated = migrateState(v20State(), context) as { flags: Record<string, boolean> };
    expect(migrated.flags).toEqual({ cowbarn: true, greenhouse: true });
    expect(migrated.flags['house-wing']).toBeUndefined();
    expect(migrated.flags['house-full']).toBeUndefined();
  });

  it('keeps everything else, including the gold and the dex', () => {
    const before = v20State();
    const migrated = migrateState(before, context) as Record<string, unknown>;
    for (const key of ['gold', 'mapId', 'collection']) expect(migrated[key]).toEqual(before[key]);
  });

  it('does not mutate the input', () => {
    const before = v20State();
    const snapshot = structuredClone(before);
    migrateState(before, context);
    expect(before).toEqual(snapshot);
  });

  it('a state from a version newer than 21 is still refused', () => {
    expect(() => migrateState({ schemaVersion: 22 }, context)).toThrow(SaveFormatError);
  });
});
