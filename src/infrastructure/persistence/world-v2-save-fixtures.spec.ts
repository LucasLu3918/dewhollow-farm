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
    expect(state.schemaVersion).toBe(25);
    expect(state.plots['4,3']).toEqual({ watered: true, crop: { cropId: 'moon-bean', growthDays: 1 }, dryDays: 0 });
    expect(state.plots['5,3']).toEqual({ watered: false, crop: null, dryDays: 0 });
    expect(state.inventory.stacks).toContainEqual({ itemId: 'seed.moon-bean', quality: 'normal', count: 2 });
    expect(state.shipBox.entries).toContainEqual({ itemId: 'crop.sweet-radish', quality: 'normal', count: 2 });
  });

  it('migrates v23 with empty hotbar and preserves house and farm data', () => {
    const state = parseSaveRecord(v23, context).state;
    expect(state).toMatchObject({ schemaVersion: 25, mapId: 'house-wing', player: { x: v23.state.player.x + 6, y: v23.state.player.y + 7, facing: v23.state.player.facing },
      plots: v23.state.plots, decor: { 'house-wing': v23.state.decor['house-wing'].map((piece) => ({ ...piece, x: piece.x + 6, y: piece.y + 7 })) }, gold: v23.state.gold, flags: v23.state.flags,
      hotbar: [null, null, null, null] });
  });

  it('migrates a v24 farm record and any saved house decor to v25 while preserving its hotbar', () => {
    const state = parseSaveRecord(v24, context).state;
    expect(state).toMatchObject({
      ...v24.state,
      schemaVersion: 25,
      decor: { 'house-wing': [{ itemId: 'night-canvas', x: 17, y: 11 }] },
    });
    expect(state.hotbar[0]).toEqual({ kind: 'tool', tool: 'hoe' });
  });
});
