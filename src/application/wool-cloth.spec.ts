import { describe, expect, it } from 'vitest';
import type { ContentPack, MapDef } from '../domain/content';
import { createNewGame, type GameState } from '../domain/game-state';
import { addItem, countOf, createInventory } from '../domain/inventory';
import { executeCommand, type Command } from './game-commands';
import { createContentIndex, type ContentIndex } from './content-index';
import mine from '../../content/mine.json';

/**
 * 羊毛 → 布（織布，加工機）→ 衣服（合成，工作台）。小屋的加工台 W 在 (0,1)，工作台 T 在 (2,1)。
 * 織布與做衣服都不耗體力（織布的加工用的是一般加工的體力與等待時間，這裡只看材料與產物）。
 */
const house: MapDef = {
  id: 'house',
  name: '小屋',
  width: 5,
  height: 3,
  rows: ['#####', 'W.T..', '.....'],
  legend: { '#': { kind: 'wall' }, '.': { kind: 'floor' }, W: { kind: 'workshop' }, T: { kind: 'workbench' } },
  spawn: { x: 1, y: 2 },
};

const content: ContentPack = {
  crops: [{ id: 'sweet-radish', name: '甜蘿蔔', seedPrice: 20, growthDays: 2, seasons: ['spring'] }],
  npcs: [],
  schedule: { periods: { noon: 720, evening: 1020 }, entries: [] },
  heartEvents: [],
  friendship: { pointsPerHeart: 100, maxHearts: 10, earlyCap: { hearts: 4, untilSeason: 'summer' }, talkPoints: 10, gift: { love: 80, neutral: 30, hate: -40 }, cropQuality: { minHearts: 2, perResident: 0.05, cap: 0.15 } },
  items: [
    { id: 'wool', name: '羊毛', kind: 'animal', maxStack: 99, sellPrice: 40 },
    { id: 'cloth', name: '布', kind: 'processed', maxStack: 99, sellPrice: 110 },
    { id: 'clothes', name: '衣服', kind: 'decor', maxStack: 20 },
  ],
  fish: [],
  crafting: [
    {
      id: 'clothes',
      name: '衣服',
      ingredients: { cloth: 2 },
      output: { item: 'clothes', count: 1 },
      unlock: { skill: 'farming', level: 3 },
      playMinutes: 1.5,
    },
  ],
  talents: { unlockLevel: 5, defs: [] },
  mine,
  processing: [{ id: 'weave-cloth', name: '織布', ingredients: { wool: 2 }, output: 'cloth', days: 2, level: 0 }],
  recipes: [],
  animals: [],
  shops: [],
  start: { mapId: 'house', gold: 400, seeds: {} },
  tuning: {
    energy: { max: 40, costs: { till: 2, water: 1, plant: 1, harvest: 1, ship: 0, chop: 3, forage: 1, mine: 2, fish: 2, cook: 1, process: 1 } },
    inventory: { capacity: 8 },
    harvest: { min: 1, max: 5 },
    time: { wakeMinute: 360, minutesPerAction: 10, daysPerSeason: 20 },
    tools: { tiers: [{ energyDiscount: 0 }, { energyDiscount: 1 }, { energyDiscount: 1 }, { energyDiscount: 2 }] },
    fishing: { biteChance: 60, bobberBonus: 10, baitBonus: 20 },
    fertilizer: { basic: { goodBonus: 20, fineBonus: 0 }, fine: { goodBonus: 30, fineBonus: 15 } },
    processing: { slots: 3 },
    skills: {
      thresholds: [0, 20, 50, 90, 140, 200, 270, 350, 440, 540, 650],
      xp: { till: 2, water: 1, plant: 2, harvest: 4, chop: 4, forage: 3, mine: 4, fish: 6, cook: 5, process: 4 },
      bonusFrom: 5,
      goodFrom: 4,
      goodChance: 0.2,
      fineFrom: 8,
      fineChance: 0.08,
    },
    gathering: { wood: { min: 1, max: 3 }, forage: { min: 1, max: 2 }, stone: { min: 1, max: 2 }, ore: { min: 1, max: 2 } },
  },
  weather: {
    spring: [{ weather: 'sunny', weight: 1 }],
    summer: [{ weather: 'sunny', weight: 1 }],
    autumn: [{ weather: 'sunny', weight: 1 }],
    winter: [{ weather: 'snow', weight: 1 }],
  },
  maps: [house],
};

const index: ContentIndex = createContentIndex(content);

function fresh(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createNewGame(content, 7),
    mapId: 'house',
    toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 },
    worldChanges: {},
    fishing: null,
    animals: [],
    cows: [],
    sheep: [],
    ...overrides,
  };
}

function bagWith(items: Record<string, number>) {
  let inventory = createInventory(8);
  for (const [id, count] of Object.entries(items)) {
    const added = addItem(inventory, index.item(id), count);
    if (!added.ok) throw new Error('背包放不下');
    inventory = added.value;
  }
  return inventory;
}

function run(state: GameState, command: Command) {
  return executeCommand(state, command, index);
}

/** 站在加工台 (0,1) 的右邊 (1,1)，面向左。 */
const atLoom = { x: 1, y: 1, facing: 'left' as const };
/** 站在工作台 (2,1) 的正下方 (2,2)，面向上。 */
const atBench = { x: 2, y: 2, facing: 'up' as const };

describe('weaving cloth at the loom (the workshop)', () => {
  it('two wool go into the loom, and the cloth is ready after two days', () => {
    const state = fresh({ inventory: bagWith({ wool: 2 }), player: atLoom });
    const out = run(state, { type: 'startProcessing', recipeId: 'weave-cloth' });
    expect(countOf(out.state.inventory, 'wool')).toBe(0);
    expect(out.state.processing).toEqual([{ recipeId: 'weave-cloth', daysLeft: 2 }]);
  });

  it('when the loom is done, the cloth is taken out at the loom', () => {
    const done = fresh({ processing: [{ recipeId: 'weave-cloth', daysLeft: 0 }], player: atLoom });
    const out = run(done, { type: 'collectProcessing' });
    expect(countOf(out.state.inventory, 'cloth')).toBe(1);
    expect(out.state.processing).toEqual([]);
  });

  it('with one wool, the loom says it needs one more', () => {
    const out = run(fresh({ inventory: bagWith({ wool: 1 }), player: atLoom }), { type: 'startProcessing', recipeId: 'weave-cloth' });
    expect(out.messages.join('\n')).toContain('羊毛 × 1');
    expect(out.state.processing).toEqual([]);
  });
});

describe('making clothes at the workbench', () => {
  it('two cloth make one clothes (a decoration: no sell price, it goes in the bag)', () => {
    const state = fresh({ skills: { farming: 1000, foraging: 0, fishing: 0, mining: 0, cooking: 0 }, inventory: bagWith({ cloth: 2 }), player: atBench });
    const out = run(state, { type: 'craft', recipeId: 'clothes' });
    expect(countOf(out.state.inventory, 'cloth')).toBe(0);
    expect(countOf(out.state.inventory, 'clothes')).toBe(1);
    expect(index.item('clothes').sellPrice).toBeUndefined();
  });

  it('the clothes recipe needs farming level 3', () => {
    const out = run(fresh({ inventory: bagWith({ cloth: 2 }), player: atBench }), { type: 'craft', recipeId: 'clothes' });
    expect(countOf(out.state.inventory, 'clothes')).toBe(0);
    expect(out.messages).toContain('技能還不夠，還不會做這個');
  });
});
