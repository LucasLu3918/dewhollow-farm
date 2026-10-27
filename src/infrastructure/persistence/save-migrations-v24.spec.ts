import { describe, expect, it } from 'vitest';
import { SAVE_SCHEMA_VERSION } from '../../domain/game-state';
import { SaveFormatError } from './save-errors';
import { migrateState, type MigrationContext } from './save-migrations';

const context: MigrationContext = { inventoryCapacity: 24, daysPerSeason: 20, wakeMinute: 360, playerName: '小涵' };

describe('存檔 v23 → v24（每份存檔的四格快捷欄）', () => {
  it('records schema version 24', () => {
    expect(SAVE_SCHEMA_VERSION).toBe(24);
  });

  it('migrates a v23 save to four empty slots without mutating the old record', () => {
    const old = { schemaVersion: 23, inventory: { capacity: 24, stacks: [] }, gold: 50 };
    const before = structuredClone(old);

    expect(migrateState(old, context)).toEqual({
      schemaVersion: 24,
      inventory: { capacity: 24, stacks: [] },
      gold: 50,
      hotbar: [null, null, null, null],
    });
    expect(old).toEqual(before);
  });

  it('rejects future schema versions', () => {
    expect(() => migrateState({ schemaVersion: 25 }, context)).toThrow(SaveFormatError);
  });
});
