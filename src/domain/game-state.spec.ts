import { describe, expect, it } from 'vitest';
import { countOf } from './inventory';
import { createNewGame } from './game-state';
import type { ContentPack } from './content';

const pack = {
  crops: [
    { id: 'dew-grass', name: '晨露草', seedPrice: 10, growthDays: 1, seasons: ['spring' as const] },
    { id: 'moon-bean', name: '月光豆', seedPrice: 15, growthDays: 2, seasons: ['spring' as const] },
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
  weather: {
    spring: [{ weather: 'sunny' as const, weight: 1 }],
    summer: [{ weather: 'sunny' as const, weight: 1 }],
    autumn: [{ weather: 'sunny' as const, weight: 1 }],
    winter: [{ weather: 'snow' as const, weight: 1 }],
  },
  tuning: {
    energy: { max: 100, costs: { till: 2, water: 1, plant: 1, harvest: 1, ship: 0 } },
    inventory: { capacity: 12 },
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

  it('puts the starting seeds into an inventory sized by the tuning', () => {
    const state = createNewGame(pack, 1);
    expect(state.inventory.capacity).toBe(12);
    expect(countOf(state.inventory, 'seed.moon-bean')).toBe(2);
  });

  it('starts with an empty shipping box and no play time', () => {
    const state = createNewGame(pack, 1);
    expect(state.shipBox).toEqual({ entries: [] });
    expect(state.playtimeSeconds).toBe(0);
  });

  it('refuses a starting loadout that does not fit in the bag', () => {
    const tiny = { ...pack, tuning: { ...pack.tuning, inventory: { capacity: 0 } } } as ContentPack;
    expect(() => createNewGame(tiny, 1)).toThrow('背包放不下起始種子');
  });
});
