import { describe, expect, it } from 'vitest';
import mineRulesJson from '../../content/mine.json';
import type { ContentPack, MapDef } from '../domain/content';
import { createNewGame, type GameState } from '../domain/game-state';
import { countOf } from '../domain/inventory';
import { executeCommand, type Command } from './game-commands';
import { createContentIndex, type ContentIndex } from './content-index';

/**
 * M4b：採集點有不同的物品與季節。小地圖 grove：M 野菇（只有春）、B 野莓（只有夏）、H 野薄荷（四季）。
 */
const grove: MapDef = {
  id: 'grove',
  name: '樹林',
  width: 5,
  height: 3,
  rows: ['#####', '#MBH#', '#...#'],
  legend: {
    '#': { kind: 'wall' },
    '.': { kind: 'grass' },
    M: { kind: 'forage', item: 'mushroom', seasons: ['spring'] },
    B: { kind: 'forage', item: 'berry', seasons: ['summer'] },
    H: { kind: 'forage' },
  },
  spawn: { x: 1, y: 2 },
  npcs: [],
};

const content: ContentPack = {
  crops: [{ id: 'dew-grass', name: '晨露草', seedPrice: 10, growthDays: 1, seasons: ['spring'] }],
  npcs: [],
  items: [
    { id: 'mint', name: '野薄荷', kind: 'forage', maxStack: 99, sellPrice: 14 },
    { id: 'mushroom', name: '野菇', kind: 'forage', maxStack: 99, sellPrice: 20 },
    { id: 'berry', name: '野莓', kind: 'forage', maxStack: 99, sellPrice: 12 },
  ],
  fish: [],
  animals: [],
  recipes: [],
  crafting: [],
  talents: { unlockLevel: 5, defs: [] },
  mine: mineRulesJson,
  processing: [],
  shops: [],
  start: { mapId: 'grove', gold: 0, seeds: {} },
  tuning: {
    energy: { max: 40, costs: { till: 2, water: 1, plant: 1, harvest: 1, ship: 0, chop: 3, forage: 1, mine: 4, fish: 2, cook: 1, process: 1 } },
    inventory: { capacity: 8 },
    harvest: { min: 1, max: 2 },
    time: { wakeMinute: 360, minutesPerAction: 10, daysPerSeason: 20 },
    tools: { tiers: [{ energyDiscount: 0 }, { energyDiscount: 1 }, { energyDiscount: 1 }, { energyDiscount: 2 }] },
    fishing: { biteChance: 60, bobberBonus: 10, baitBonus: 20 },
    fertilizer: { basic: { goodBonus: 20, fineBonus: 0 }, fine: { goodBonus: 30, fineBonus: 15 } },
    processing: { slots: 3 },
    skills: {
      thresholds: [0, 20, 50, 90, 140, 200, 270, 350, 440, 540, 650],
      xp: { forage: 3 },
      bonusFrom: 5,
      goodFrom: 4,
      goodChance: 0.2,
      fineFrom: 8,
      fineChance: 0.08,
    },
    gathering: { wood: { min: 1, max: 3 }, forage: { min: 1, max: 1 }, stone: { min: 1, max: 2 }, ore: { min: 1, max: 2 } },
  },
  weather: {
    spring: [{ weather: 'sunny', weight: 1 }],
    summer: [{ weather: 'sunny', weight: 1 }],
    autumn: [{ weather: 'sunny', weight: 1 }],
    winter: [{ weather: 'snow', weight: 1 }],
  },
  maps: [grove],
};

const index: ContentIndex = createContentIndex(content);

function at(season: 'spring' | 'summer', x: number): GameState {
  const base = createNewGame(content, 3);
  return { ...base, mapId: 'grove', player: { x, y: 2, facing: 'up' }, calendar: { ...base.calendar, season } };
}

function run(state: GameState, command: Command) {
  return executeCommand(state, command, index);
}

describe('foraging spots', () => {
  it('a spot yields its own item in its season', () => {
    const out = run(at('spring', 1), { type: 'interact' });
    expect(countOf(out.state.inventory, 'mushroom')).toBe(1);
    expect(countOf(out.state.inventory, 'mint')).toBe(0);
  });

  it('a spot out of its season yields nothing and takes no energy', () => {
    const state = at('summer', 1);
    const out = run(state, { type: 'interact' });
    expect(out.messages).toContain('這裡的野菜還沒長出來');
    expect(out.state.inventory.stacks).toEqual([]);
    expect(out.state.energy).toEqual(state.energy);
  });

  it('a spot without a season yields the wild mint in any season', () => {
    const out = run(at('summer', 3), { type: 'interact' });
    expect(countOf(out.state.inventory, 'mint')).toBe(1);
  });

  it('a spot can be picked once a day', () => {
    const picked = run(at('spring', 1), { type: 'interact' }).state;
    const again = run({ ...picked, player: { x: 1, y: 2, facing: 'up' } }, { type: 'interact' });
    expect(again.messages).toContain('這裡已經採過了，明天再來');
  });
});
