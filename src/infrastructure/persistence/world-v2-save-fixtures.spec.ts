import { describe, expect, it } from 'vitest';
import v1 from '../../../tests/fixtures/saves/v1-farm.json';
import v23 from '../../../tests/fixtures/saves/v23-house-wing.json';
import v24 from '../../../tests/fixtures/saves/v24-farm.json';
import { parseSaveRecord } from './save-schema';

// 全部資料均為合成資料，不含任何玩家存檔。
const context = { inventoryCapacity: 24, daysPerSeason: 20, wakeMinute: 360, playerName: '小涵' };

describe('world-v2 synthetic save fixtures', () => {
  it('migrates v1 plots and inventory without changing the input', () => {
    const original = structuredClone(v1);
    const state = parseSaveRecord(v1, context).state;
    expect(v1).toEqual(original);
    expect(state.schemaVersion).toBe(24);
    expect(state.plots['4,3']).toEqual({ watered: true, crop: { cropId: 'moon-bean', growthDays: 1 }, dryDays: 0 });
    expect(state.plots['5,3']).toEqual({ watered: false, crop: null, dryDays: 0 });
    expect(state.inventory.stacks).toContainEqual({ itemId: 'seed.moon-bean', quality: 'normal', count: 2 });
    expect(state.shipBox.entries).toContainEqual({ itemId: 'crop.sweet-radish', quality: 'normal', count: 2 });
  });

  it('migrates v23 with empty hotbar and preserves house and farm data', () => {
    const state = parseSaveRecord(v23, context).state;
    expect(state).toMatchObject({ schemaVersion: 24, mapId: 'house-wing', player: v23.state.player,
      plots: v23.state.plots, decor: v23.state.decor, gold: v23.state.gold, flags: v23.state.flags,
      hotbar: [null, null, null, null] });
  });

  it('validates the current v24 record and preserves its populated hotbar', () => {
    const state = parseSaveRecord(v24, context).state;
    expect(state).toEqual(v24.state);
    expect(state.hotbar[0]).toEqual({ kind: 'tool', tool: 'hoe' });
  });
});
