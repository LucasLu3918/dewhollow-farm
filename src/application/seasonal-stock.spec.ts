import { describe, expect, it } from 'vitest';
import type { ContentPack, MapDef } from '../domain/content';
import { createNewGame, type GameState } from '../domain/game-state';
import { addItem, countOf, createInventory } from '../domain/inventory';
import { executeCommand, type Command } from './game-commands';
import { createContentIndex, type ContentIndex } from './content-index';
import mine from '../../content/mine.json';

/**
 * 雜貨店的季節限定商品（shops.json 的 seasons）：夏季的遮陽帽配方、秋季的木材補充。
 * 換季時上架與下架：不在季節內的商品買不到，也不列在貨架上。配方型的商品買一次就學會（旗標 recipe:<id>）。
 */
const yard: MapDef = {
  id: 'yard',
  name: '院子',
  width: 6,
  height: 4,
  rows: ['######', '......', 'T.Q...', 'B.....'],
  legend: {
    '#': { kind: 'wall' },
    '.': { kind: 'grass' },
    Q: { kind: 'shop', shop: 'general' },
    T: { kind: 'workbench' },
    B: { kind: 'bed' },
  },
  spawn: { x: 1, y: 1 },
};

const content: ContentPack = {
  crops: [{ id: 'sweet-radish', name: '甜蘿蔔', seedPrice: 20, growthDays: 2, seasons: ['spring'] }],
  npcs: [],
  schedule: { periods: { noon: 720, evening: 1020 }, entries: [] },
  heartEvents: [],
  friendship: { pointsPerHeart: 100, maxHearts: 10, earlyCap: { hearts: 4, untilSeason: 'summer' }, talkPoints: 10, gift: { love: 80, neutral: 30, hate: -40 }, cropQuality: { minHearts: 2, perResident: 0.05, cap: 0.15 } },
  items: [
    { id: 'hay', name: '乾草', kind: 'material', maxStack: 99 },
    { id: 'wood', name: '木材', kind: 'material', maxStack: 99 },
    { id: 'flower-summer', name: '夏花', kind: 'forage', maxStack: 99, sellPrice: 6 },
    { id: 'recipe.sun-hat', name: '遮陽帽配方', kind: 'recipe', maxStack: 1 },
    { id: 'sun-hat', name: '遮陽帽', kind: 'decor', maxStack: 20 },
  ],
  fish: [],
  crafting: [
    {
      id: 'sun-hat',
      name: '遮陽帽',
      ingredients: { 'flower-summer': 2, hay: 2 },
      output: { item: 'sun-hat', count: 1 },
      unlock: { flag: 'recipe:sun-hat' },
      playMinutes: 1.5,
    },
  ],
  talents: { unlockLevel: 5, defs: [] },
  mine,
  processing: [],
  recipes: [],
  animals: [],
  shops: [
    {
      id: 'general',
      name: '雜貨店',
      stock: [
        { itemId: 'hay', price: 5 },
        { itemId: 'recipe.sun-hat', price: 180, seasons: ['summer'] },
        { itemId: 'wood', price: 12, seasons: ['autumn'] },
      ],
      upgrades: [],
    },
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
  maps: [yard],
};

const index: ContentIndex = createContentIndex(content);

function inSeason(season: 'spring' | 'summer' | 'autumn' | 'winter', overrides: Partial<GameState> = {}): GameState {
  return {
    ...createNewGame(content, 7),
    mapId: 'yard',
    calendar: { year: 1, season, day: 5, minuteOfDay: 360 },
    toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 },
    worldChanges: {},
    fishing: null,
    animals: [],
    cows: [],
    sheep: [],
    inventory: createInventory(8),
    ...overrides,
  };
}

function run(state: GameState, command: Command) {
  return executeCommand(state, command, index);
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

/** 站在雜貨店櫃檯（2,2）的正下方，面向上。 */
const atCounter = { x: 2, y: 3, facing: 'up' as const };
/** 站在工作台 (0,2) 的右邊 (1,2)，面向左。 */
const atBench = { x: 1, y: 2, facing: 'left' as const };

describe('the summer recipe at the general store', () => {
  it('in summer, the sun-hat recipe is sold for 180 gold and marks the recipe as learned', () => {
    const state = inSeason('summer', { gold: 500, player: atCounter });
    const out = run(state, { type: 'buy', shopId: 'general', itemId: 'recipe.sun-hat', count: 1 });
    expect(out.state.gold).toBe(320);
    expect(out.state.flags['recipe:sun-hat']).toBe(true);
    expect(out.state.inventory).toEqual(state.inventory);
  });

  it('the recipe is learned once: buying it again is refused and takes no gold', () => {
    const learned = inSeason('summer', { gold: 500, flags: { 'recipe:sun-hat': true }, player: atCounter });
    const out = run(learned, { type: 'buy', shopId: 'general', itemId: 'recipe.sun-hat', count: 1 });
    expect(out.state.gold).toBe(500);
    expect(out.messages).toContain('已經有了，不用再做一個');
  });

  it('in spring the recipe is not on the shelf: the purchase is refused and nothing is taken', () => {
    const out = run(inSeason('spring', { gold: 500, player: atCounter }), { type: 'buy', shopId: 'general', itemId: 'recipe.sun-hat', count: 1 });
    expect(out.state.gold).toBe(500);
    expect(out.state.flags['recipe:sun-hat']).toBeUndefined();
    expect(out.messages).toContain('雜貨店這個季節還沒進這批貨');
  });

  it('in autumn the shelf no longer sells the summer recipe, so it cannot be bought then', () => {
    const autumn = inSeason('autumn', { gold: 500, player: atCounter });
    const out = run(autumn, { type: 'buy', shopId: 'general', itemId: 'recipe.sun-hat', count: 1 });
    expect(out.state.gold).toBe(500);
    expect(out.messages).toContain('雜貨店這個季節還沒進這批貨');
  });

  it('a learned recipe can be crafted at the workbench', () => {
    const learned = inSeason('summer', { flags: { 'recipe:sun-hat': true }, player: atBench, inventory: bagWith({ 'flower-summer': 2, hay: 2 }) });
    const out = run(learned, { type: 'craft', recipeId: 'sun-hat' });
    expect(countOf(out.state.inventory, 'sun-hat')).toBe(1);
    expect(countOf(out.state.inventory, 'flower-summer')).toBe(0);
  });

  it('without the recipe, the workbench says where to get it', () => {
    const out = run(inSeason('summer', { player: atBench }), { type: 'craft', recipeId: 'sun-hat' });
    expect(out.messages).toContain('還沒有這個配方，要先找到或買到它');
  });
});

describe('the autumn wood restock', () => {
  it('in autumn, wood is sold at 12 gold each', () => {
    const out = run(inSeason('autumn', { gold: 100, player: atCounter }), { type: 'buy', shopId: 'general', itemId: 'wood', count: 3 });
    expect(out.state.gold).toBe(64);
    expect(countOf(out.state.inventory, 'wood')).toBe(3);
  });

  it('in spring there is no wood on the shelf', () => {
    const out = run(inSeason('spring', { gold: 100, player: atCounter }), { type: 'buy', shopId: 'general', itemId: 'wood', count: 1 });
    expect(out.state.gold).toBe(100);
    expect(countOf(out.state.inventory, 'wood')).toBe(0);
    expect(out.messages).toContain('雜貨店這個季節還沒進這批貨');
  });

  it('the all-year hay is sold in every season', () => {
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
      const out = run(inSeason(season, { gold: 100, player: atCounter }), { type: 'buy', shopId: 'general', itemId: 'hay', count: 1 });
      expect(out.state.gold).toBe(95);
    }
  });
});
