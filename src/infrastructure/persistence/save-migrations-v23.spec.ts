import { describe, expect, it } from 'vitest';
import { SAVE_SCHEMA_VERSION } from '../../domain/game-state';
import { SaveFormatError } from './save-errors';
import { migrateState, type MigrationContext } from './save-migrations';

const context: MigrationContext = { inventoryCapacity: 24, daysPerSeason: 20, wakeMinute: 360, playerName: '小涵' };

describe('存檔 v22 → v23（農場評級、豐收重置與傳承）', () => {
  it('目前的存檔版本是 23', () => {
    expect(SAVE_SCHEMA_VERSION).toBe(23);
  });

  it('舊存檔的本年收入、上一年收入與豐收加成都從 0 開始，代數為 1，名字沿用預設', () => {
    const migrated = migrateState({ schemaVersion: 22, gold: 10 }, context) as Record<string, unknown>;
    expect(migrated).toMatchObject({
      schemaVersion: 23,
      gold: 10,
      yearlyIncome: 0,
      previousYearIncome: 0,
      resetBonus: 0,
      generation: 1,
      playerName: '小涵',
    });
  });

  it('已經是 v23 的存檔不會再被改動', () => {
    const current = { schemaVersion: 23, yearlyIncome: 7, playerName: '小禾' };
    expect(migrateState(current, context)).toEqual(current);
  });

  it('比目前更新的版本（v24）會被拒絕，並提示更新遊戲', () => {
    expect(() => migrateState({ schemaVersion: 24 }, context)).toThrow(SaveFormatError);
    expect(() => migrateState({ schemaVersion: 24 }, context)).toThrow(/更新版本/);
  });
});
