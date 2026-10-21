import { describe, expect, it } from 'vitest';
import type { ContentPack, MapDef } from '../domain/content';
import { createNewGame, type GameState } from '../domain/game-state';
import { addItem, countOf, createInventory } from '../domain/inventory';
import { newAnimal } from '../domain/animals';
import { executeCommand, type Command } from './game-commands';
import { createContentIndex, type ContentIndex } from './content-index';

/**
 * M4（P1）：畜牧。小地圖 yard（5×4，雜貨店櫃檯在 (2,2)，床在 (0,3)）與雞舍 coop（5×3，座位在 (1,1)，乾草槽在 (3,1)）。
 */
const yard: MapDef = {
  id: 'yard',
  name: '院子',
  width: 5,
  height: 4,
  rows: ['#####', '.....', '..Q..', 'B....'],
  legend: {
    '#': { kind: 'wall' },
    '.': { kind: 'grass' },
    Q: { kind: 'shop', shop: 'general' },
    B: { kind: 'bed' },
  },
  spawn: { x: 1, y: 1 },
  npcs: [],
};

const coop: MapDef = {
  id: 'coop',
  name: '雞舍',
  width: 5,
  height: 3,
  rows: ['#####', '#P.T#', '#####'],
  legend: { '#': { kind: 'wall' }, '.': { kind: 'floor' }, P: { kind: 'floor', slot: true }, T: { kind: 'trough' } },
  spawn: { x: 2, y: 1 },
  npcs: [],
};

const content: ContentPack = {
  crops: [{ id: 'sweet-radish', name: '甜蘿蔔', seedPrice: 20, growthDays: 2, seasons: ['spring'] }],
  npcs: [],
  items: [
    { id: 'hay', name: '乾草', kind: 'material', maxStack: 99, sellPrice: 2 },
    { id: 'egg', name: '雞蛋', kind: 'animal', maxStack: 99, sellPrice: 25 },
  ],
  fish: [],
  crafting: [],
  talents: { unlockLevel: 5, defs: [] },
  processing: [],
  recipes: [],
  animals: [{ id: 'chicken', name: '雞', eggItem: 'egg', eggQuality: 0.3 }],
  shops: [
    { id: 'general', name: '雜貨店', stock: [{ itemId: 'hay', price: 5 }, { itemId: 'animal.chicken', price: 300 }], upgrades: [] },
  ],
  start: { mapId: 'yard', gold: 400, seeds: {} },
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
  maps: [yard, coop],
};

const index: ContentIndex = createContentIndex(content);

function fresh(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createNewGame(content, 7),
    mapId: 'yard',
    toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 },
    worldChanges: {},
    fishing: null,
    animals: [],
    ...overrides,
  };
}

function with_(state: GameState, items: Record<string, number>): GameState {
  let inventory = createInventory(8);
  for (const [id, count] of Object.entries(items)) {
    const added = addItem(inventory, index.item(id), count);
    if (!added.ok) throw new Error('背包放不下');
    inventory = added.value;
  }
  return { ...state, inventory: { ...state.inventory, stacks: inventory.stacks } };
}

function run(state: GameState, command: Command) {
  return executeCommand(state, command, index);
}

describe('buying a chicken', () => {
  it('at the general store, a chicken costs 300 gold and moves into the coop', () => {
    const state = { ...fresh({ player: { x: 2, y: 3, facing: 'up' } }), mapId: 'yard' };
    const out = run(state, { type: 'buy', shopId: 'general', itemId: 'animal.chicken', count: 1 });
    expect(out.state.gold).toBe(400 - 300);
    expect(out.state.animals).toEqual([newAnimal('chicken')]);
  });

  it('a full coop refuses another chicken, and nothing is taken', () => {
    const full = fresh({ animals: [newAnimal('chicken')], gold: 1000, player: { x: 2, y: 3, facing: 'up' } });
    const out = run(full, { type: 'buy', shopId: 'general', itemId: 'animal.chicken', count: 1 });
    expect(out.state.animals).toHaveLength(1);
    expect(out.state.gold).toBe(1000);
    expect(out.messages).toContain('雞舍已經滿了');
  });
});

describe('caring for the chickens', () => {
  it('feeding uses one hay and feeds everyone; with no hay it is refused', () => {
    const inCoop = (state: GameState) => ({ ...state, mapId: 'coop', player: { x: 2, y: 1, facing: 'right' as const } });
    const hungry = inCoop(with_(fresh({ animals: [newAnimal('chicken')] }), { hay: 2 }));
    const fed = run(hungry, { type: 'interact' });
    expect(countOf(fed.state.inventory, 'hay')).toBe(1);
    expect(fed.state.animals[0]?.fed).toBe(true);

    const noHay = run(inCoop(fresh({ animals: [newAnimal('chicken')] })), { type: 'interact' });
    expect(noHay.messages).toContain('沒有乾草了（雜貨店有賣）');
  });

  it('petting the chicken in its seat raises its mood and marks it petted', () => {
    const state = fresh({ animals: [newAnimal('chicken')], mapId: 'coop', player: { x: 1, y: 2, facing: 'up' } });
    const out = run(state, { type: 'interact' });
    expect(out.state.animals[0]).toMatchObject({ petted: true, mood: 6 });
    expect(out.messages).toContain('摸了摸雞');
  });

  it('an empty seat is just floor', () => {
    const state = fresh({ mapId: 'coop', player: { x: 1, y: 2, facing: 'up' } });
    expect(run(state, { type: 'interact' }).events).toContainEqual({ type: 'refused', reason: 'NOTHING_HERE' });
  });
});

describe('the new day in the coop', () => {
  it('a fed chicken lays an egg for the bag; a hungry one lays none; care resets for the next day', () => {
    const sleepy = (animals: GameState['animals']) =>
      run({ ...fresh({ animals, player: { x: 1, y: 3, facing: 'left' }, energy: { current: 10, max: 40 } }) }, { type: 'interact' });
    const laid = sleepy([{ ...newAnimal('chicken'), fed: true }]);
    expect(countOf(laid.state.inventory, 'egg')).toBe(1);
    expect(laid.state.animals[0]?.fed).toBe(false);
    expect(laid.messages.join('\n')).toContain('雞下了 1 顆蛋');

    const hungry = sleepy([newAnimal('chicken')]);
    expect(countOf(hungry.state.inventory, 'egg')).toBe(0);
  });
});
