import { describe, expect, it } from 'vitest';
import type { ContentPack, MapDef } from '../domain/content';
import { createNewGame, type GameState } from '../domain/game-state';
import { addItem, countOf, createInventory } from '../domain/inventory';
import { executeCommand, type Command } from './game-commands';
import { createContentIndex, type ContentIndex } from './content-index';

/**
 * M4（P1）：料理。小地圖 kitchen（4×3）：K 廚房 (1,1)，床 B (0,2)；站在 (1,2) 面向上方的廚房做菜。
 */
const kitchen: MapDef = {
  id: 'kitchen',
  name: '小屋',
  width: 4,
  height: 3,
  rows: ['####', '#K.#', 'B..#'],
  legend: { '#': { kind: 'wall' }, '.': { kind: 'floor' }, K: { kind: 'kitchen' }, B: { kind: 'bed' } },
  spawn: { x: 2, y: 2 },
  npcs: [],
};

const content: ContentPack = {
  crops: [{ id: 'sweet-radish', name: '甜蘿蔔', seedPrice: 20, growthDays: 2, seasons: ['spring'] }],
  npcs: [],
  items: [
    { id: 'mint', name: '野薄荷', kind: 'forage', maxStack: 99, sellPrice: 14 },
    { id: 'egg', name: '雞蛋', kind: 'animal', maxStack: 99, sellPrice: 25 },
  ],
  fish: [{ id: 'carp', name: '鯉魚', sellPrice: 30, seasons: ['spring'], weight: 1 }],
  animals: [],
  crafting: [],
  processing: [],
  recipes: [
    { id: 'mint-tea', name: '薄荷茶', ingredients: { mint: 2 }, energy: 20, level: 0, sellPrice: 40 },
    { id: 'fried-egg', name: '煎蛋', ingredients: { egg: 1 }, energy: 15, level: 0, sellPrice: 30 },
    { id: 'fish-stew', name: '魚湯', ingredients: { 'fish.carp': 1, mint: 1 }, energy: 40, level: 3, sellPrice: 120 },
  ],
  shops: [],
  start: { mapId: 'kitchen', gold: 100, seeds: {} },
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
  maps: [kitchen],
};

const index: ContentIndex = createContentIndex(content);

function at(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createNewGame(content, 7),
    mapId: 'kitchen',
    player: { x: 1, y: 2, facing: 'up' },
    tool: 'hoe',
    toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0 },
    worldChanges: {},
    fishing: null,
    animals: [],
    energy: { current: 10, max: 40 },
    ...overrides,
  };
}

function withItems(state: GameState, items: Record<string, number>): GameState {
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

describe('cooking at the kitchen', () => {
  it('standing at the stove, a recipe uses its ingredients and makes a dish, and costs 1 energy', () => {
    const state = withItems(at(), { mint: 3 });
    const out = run(state, { type: 'cook', recipeId: 'mint-tea' });
    expect(countOf(out.state.inventory, 'mint')).toBe(1);
    expect(countOf(out.state.inventory, 'dish.mint-tea')).toBe(1);
    expect(out.state.energy.current).toBe(9);
    expect(out.state.skills.cooking).toBe(5);
  });

  it('a missing ingredient is named, and nothing is used up', () => {
    const state = withItems(at(), { mint: 1 });
    const out = run(state, { type: 'cook', recipeId: 'mint-tea' });
    expect(out.messages.join('\n')).toContain('薄荷');
    expect(countOf(out.state.inventory, 'mint')).toBe(1);
    expect(out.state.energy).toEqual(state.energy);
  });

  it('a recipe above your cooking level is refused', () => {
    const state = withItems(at(), { 'fish.carp': 1, mint: 1 });
    const out = run(state, { type: 'cook', recipeId: 'fish-stew' });
    expect(out.messages).toContain('烹飪還不夠高，做不了這道菜');
    expect(countOf(out.state.inventory, 'fish.carp')).toBe(1);
  });

  it('cooking away from the stove is refused', () => {
    const state = withItems(at({ player: { x: 2, y: 2, facing: 'left' } }), { mint: 2 });
    const out = run(state, { type: 'cook', recipeId: 'mint-tea' });
    expect(out.messages).toContain('要站在廚房前面才能做菜');
  });
});

describe('eating a dish', () => {
  it('eating restores energy, but never past the maximum, and uses up the dish', () => {
    const state = withItems(at({ energy: { current: 30, max: 40 } }), { 'dish.mint-tea': 1 });
    const out = run(state, { type: 'eat', itemId: 'dish.mint-tea' });
    expect(out.state.energy.current).toBe(40);
    expect(countOf(out.state.inventory, 'dish.mint-tea')).toBe(0);
    expect(out.messages.join('\n')).toContain('薄荷茶');
  });

  it('a dish you do not have cannot be eaten', () => {
    const out = run(at(), { type: 'eat', itemId: 'dish.mint-tea' });
    expect(out.events).toContainEqual({ type: 'refused', reason: 'NO_DISH' });
  });
});

describe('the kitchen counter', () => {
  it('talking to the kitchen opens its panel, without spending time or energy', () => {
    const state = at();
    const out = run(state, { type: 'interact' });
    expect(out.events).toContainEqual({ type: 'kitchenOpened' });
    expect(out.state.energy).toEqual(state.energy);
  });
});
