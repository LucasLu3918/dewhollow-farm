import { describe, expect, it } from 'vitest';
import { createNewGame } from './game-state';
import type { ContentPack } from './content';

const pack = {
  crops: [
    { id: 'dew-grass', name: '晨露草', seedPrice: 10, growthDays: 1 },
    { id: 'moon-bean', name: '月光豆', seedPrice: 15, growthDays: 2 },
  ],
  npcs: [],
  maps: [
    {
      id: 'farm',
      name: '農場',
      width: 1,
      height: 1,
      rows: ['.'],
      legend: { '.': { kind: 'grass' } },
      spawn: { x: 0, y: 0 },
      npcs: [],
    },
  ],
  start: { mapId: 'farm', gold: 100, seeds: { 'moon-bean': 2 } },
  tuning: {
    energy: { max: 100, costs: { till: 2, water: 1, plant: 1, harvest: 1, ship: 0 } },
    time: { wakeMinute: 360, minutesPerAction: 10 },
  },
} as unknown as ContentPack;

describe('createNewGame', () => {
  it('selects the first crop the player actually holds as the seed', () => {
    expect(createNewGame(pack, 1).selectedSeed).toBe('moon-bean');
  });

  it('falls back to the first crop when no seeds are held', () => {
    const empty = { ...pack, start: { ...pack.start, seeds: {} } };
    expect(createNewGame(empty, 1).selectedSeed).toBe('dew-grass');
  });
});
