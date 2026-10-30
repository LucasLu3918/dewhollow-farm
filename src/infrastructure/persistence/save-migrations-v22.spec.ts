import { describe, expect, it } from 'vitest';
import { migrateState } from './save-migrations';
import { SaveFormatError } from './save-errors';

const context = { inventoryCapacity: 24, daysPerSeason: 20, wakeMinute: 360, playerName: '小涵' };

/** 一份合法的 v21 存檔內容（裝飾、穿戴與旅行商人之前）。 */
function v21State(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 21,
    gold: 1500,
    mapId: 'house-wing',
    flags: { 'house-wing': true, cowbarn: true },
    sheep: [{ kind: 'sheep', fed: true, petted: true, milked: false, mood: 5, woolDays: 2 }],
    ...overrides,
  };
}

describe('migrateState v21 → v22（裝飾擺放、服飾穿戴、旅行商人）', () => {
  it('bumps the save to version 22', () => {
    const migrated = migrateState(v21State(), context) as Record<string, unknown>;
    expect(migrated.schemaVersion).toBe(26);
  });

  it('starts with no decor placed and nothing worn', () => {
    const migrated = migrateState(v21State(), context) as { decor: unknown; wearing: unknown };
    expect(migrated.decor).toEqual({});
    expect(migrated.wearing).toEqual({});
  });

  it('starts the traveling merchant with no purchases this week', () => {
    const migrated = migrateState(v21State(), context) as { merchant: unknown };
    expect(migrated.merchant).toEqual({ week: 0, bought: {} });
  });

  it('keeps the house expansion, the sheep and the gold exactly as they were', () => {
    const before = v21State();
    const migrated = migrateState(before, context) as Record<string, unknown>;
    for (const key of ['gold', 'mapId', 'flags', 'sheep']) expect(migrated[key]).toEqual(before[key]);
  });

  it('does not mutate the input', () => {
    const before = v21State();
    const snapshot = structuredClone(before);
    migrateState(before, context);
    expect(before).toEqual(snapshot);
  });

  it('a state from a version newer than 22 is still refused', () => {
    expect(() => migrateState({ schemaVersion: 27 }, context)).toThrow(SaveFormatError);
  });
});
