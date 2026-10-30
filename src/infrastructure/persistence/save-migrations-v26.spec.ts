import { describe, expect, it } from 'vitest';
import { SAVE_SCHEMA_VERSION } from '../../domain/game-state';
import { migrateState, type MigrationContext } from './save-migrations';

const context: MigrationContext = { inventoryCapacity: 24, daysPerSeason: 20, wakeMinute: 360, playerName: '小涵' };

describe('存檔 v25 → v26（獨立溫室地圖）', () => {
  it('把舊溫室作物和玩家座標移入溫室，同時保留農場田地狀態', () => {
    const greenhousePlot = { watered: true, crop: { cropId: 'bell-pumpkin', growthDays: 3 }, fertilizer: 'fine', dryDays: 0 };
    const farmPlot = { watered: false, crop: null, dryDays: 0 };
    const old = {
      schemaVersion: 25,
      mapId: 'farm',
      player: { x: 30, y: 22, facing: 'left' },
      plots: { '31,22': greenhousePlot, '10,13': farmPlot },
    };
    const before = structuredClone(old);

    expect(SAVE_SCHEMA_VERSION).toBe(26);
    expect(migrateState(old, context)).toMatchObject({
      schemaVersion: 26,
      mapId: 'greenhouse',
      player: { x: 3, y: 2, facing: 'left' },
      plots: {
        'greenhouse|7,2': greenhousePlot,
        'farm|10,13': farmPlot,
      },
    });
    expect(old).toEqual(before);
  });

  it('does not move farm players and leaves already map-scoped keys intact', () => {
    const scoped = { watered: false, crop: null, dryDays: 0 };
    expect(migrateState({
      schemaVersion: 25,
      mapId: 'farm',
      player: { x: 7, y: 9, facing: 'down' },
      plots: { 'greenhouse|2,2': scoped },
    }, context)).toMatchObject({
      schemaVersion: 26,
      mapId: 'farm',
      player: { x: 7, y: 9 },
      plots: { 'greenhouse|2,2': scoped },
    });
  });

  it('gives an existing scoped plot precedence over a colliding legacy coordinate in either key order', () => {
    const scoped = { watered: false, crop: null, dryDays: 2 };
    const legacy = { watered: true, crop: null, dryDays: 0 };
    for (const plots of [
      { '4,3': legacy, 'farm|4,16': scoped },
      { 'farm|4,16': scoped, '4,3': legacy },
    ]) {
      expect(migrateState({ schemaVersion: 25, plots }, context)).toMatchObject({
        plots: { 'farm|4,16': scoped },
      });
    }
  });

  it('moves all three legacy farm field blocks one-to-one into the redesigned beds', () => {
    const oldPlots = {
      '4,3': { watered: true, crop: { cropId: 'moon-bean', growthDays: 1 }, dryDays: 0 },
      '9,5': { watered: false, crop: null, dryDays: 2 },
      '12,3': { watered: true, crop: { cropId: 'sweet-radish', growthDays: 2 }, fertilizer: 'fine', dryDays: 0 },
      '17,5': { watered: false, crop: null, dryDays: 0 },
      '18,14': { watered: true, crop: { cropId: 'dew-grass', growthDays: 0 }, dryDays: 0 },
      '23,16': { watered: false, crop: null, dryDays: 1 },
    };
    expect(migrateState({ schemaVersion: 25, plots: oldPlots }, context)).toMatchObject({
      schemaVersion: 26,
      plots: {
        'farm|4,16': oldPlots['4,3'],
        'farm|12,18': oldPlots['9,5'],
        'farm|4,20': oldPlots['12,3'],
        'farm|12,22': oldPlots['17,5'],
        'farm|4,24': oldPlots['18,14'],
        'farm|12,26': oldPlots['23,16'],
      },
    });
  });

  it('maps every old greenhouse bed cell into a new greenhouse field and skips the new aisles', () => {
    const legacyCoordinates = [
      '28,21', '29,21', '31,21', '32,21',
      '28,22', '29,22', '30,22', '31,22', '32,22',
      '28,23', '29,23', '30,23', '31,23', '32,23',
      '28,24', '29,24', '30,24', '31,24', '32,24',
    ];
    const expectedCoordinates = [
      '1,1', '2,1', '7,1', '8,1',
      '1,2', '2,2', '3,2', '7,2', '8,2',
      '1,3', '2,3', '3,3', '7,3', '8,3',
      '1,5', '2,5', '3,5', '7,5', '8,5',
    ];
    const plots = Object.fromEntries(legacyCoordinates.map((key, index) => [key, { watered: index % 2 === 0, crop: null, dryDays: index % 3 }]));
    const migrated = migrateState({ schemaVersion: 25, mapId: 'farm', plots }, context) as { plots: Record<string, unknown> };

    expect(Object.keys(migrated.plots)).toHaveLength(legacyCoordinates.length);
    for (const [index, legacyKey] of legacyCoordinates.entries()) {
      expect(migrated.plots[`greenhouse|${expectedCoordinates[index]}`]).toEqual(plots[legacyKey]);
    }
  });
});
