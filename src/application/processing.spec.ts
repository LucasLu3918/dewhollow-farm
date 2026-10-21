import { describe, expect, it } from 'vitest';
import mineRulesJson from '../../content/mine.json';
import type { ContentPack, MapDef } from '../domain/content';
import { createNewGame, type GameState } from '../domain/game-state';
import { addItem, countOf, createInventory } from '../domain/inventory';
import { executeCommand, type Command } from './game-commands';
import { createContentIndex, type ContentIndex } from './content-index';

/**
 * M4（P1）：加工機（醃漬、烘乾）。小地圖 house：W 加工台 (1,1)，床 B (0,2)；
 * 站在 (1,2) 面向上方的加工台；面向左邊的床就能睡覺。
 */
const house: MapDef = {
  id: 'house',
  name: '小屋',
  width: 4,
  height: 3,
  rows: ['####', '#W.#', 'B..#'],
  legend: { '#': { kind: 'wall' }, '.': { kind: 'floor' }, W: { kind: 'workshop' }, B: { kind: 'bed' } },
  spawn: { x: 1, y: 2 },
};

function makeContent(slots: number): ContentPack {
  return {
    crops: [{ id: 'sweet-radish', name: '甜蘿蔔', seedPrice: 20, growthDays: 2, seasons: ['spring'] }],
    npcs: [],
    schedule: { periods: { noon: 720, evening: 1020 }, entries: [] },
    heartEvents: [],
    friendship: { pointsPerHeart: 100, maxHearts: 10, earlyCap: { hearts: 4, untilSeason: 'summer' }, talkPoints: 10, gift: { love: 80, neutral: 30, hate: -40 }, cropQuality: { minHearts: 2, perResident: 0.05, cap: 0.15 } },
    items: [
      { id: 'mint', name: '野薄荷', kind: 'forage', maxStack: 99, sellPrice: 14 },
      { id: 'dried-mint', name: '乾薄荷', kind: 'processed', maxStack: 99, sellPrice: 40 },
      { id: 'pickle-radish', name: '醃蘿蔔', kind: 'processed', maxStack: 99, sellPrice: 150 },
      { id: 'dried-carp', name: '魚乾', kind: 'processed', maxStack: 99, sellPrice: 60 },
    ],
    fish: [{ id: 'carp', name: '鯉魚', sellPrice: 30, seasons: ['spring'], weight: 1 }],
    animals: [],
    recipes: [],
    crafting: [],
    talents: { unlockLevel: 5, defs: [] },
    mine: mineRulesJson,
    processing: [
      { id: 'dried-mint', name: '烘乾薄荷', ingredients: { mint: 2 }, output: 'dried-mint', days: 1, level: 0 },
      { id: 'pickle-radish', name: '醃蘿蔔', ingredients: { 'crop.sweet-radish': 1 }, output: 'pickle-radish', days: 2, level: 2 },
      { id: 'dried-carp', name: '烘乾鯉魚', ingredients: { 'fish.carp': 1 }, output: 'dried-carp', days: 1, level: 2 },
    ],
    shops: [],
    start: { mapId: 'house', gold: 100, seeds: {} },
    tuning: {
      energy: { max: 40, costs: { till: 2, water: 1, plant: 1, harvest: 1, ship: 0, chop: 3, forage: 1, mine: 2, fish: 2, cook: 1, process: 1 } },
      inventory: { capacity: 8 },
      harvest: { min: 1, max: 5 },
      time: { wakeMinute: 360, minutesPerAction: 10, daysPerSeason: 20 },
      tools: { tiers: [{ energyDiscount: 0 }, { energyDiscount: 1 }, { energyDiscount: 1 }, { energyDiscount: 2 }] },
      fishing: { biteChance: 60, bobberBonus: 10, baitBonus: 20 },
    fertilizer: { basic: { goodBonus: 20, fineBonus: 0 }, fine: { goodBonus: 30, fineBonus: 15 } },
      processing: { slots },
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
}

const content = makeContent(3);
const index: ContentIndex = createContentIndex(content);

function at(facing: 'up' | 'left' = 'up', overrides: Partial<GameState> = {}): GameState {
  return {
    ...createNewGame(content, 7),
    mapId: 'house',
    player: { x: 1, y: 2, facing },
    tool: 'hoe',
    toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 },
    worldChanges: {},
    fishing: null,
    animals: [],
    processing: [],
    energy: { current: 30, max: 40 },
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

function run(state: GameState, command: Command, idx: ContentIndex = index) {
  return executeCommand(state, command, idx);
}

describe('processing at the workshop', () => {
  it('putting a batch in uses its ingredients, costs 1 energy, and gives cooking experience', () => {
    const state = withItems(at(), { mint: 2 });
    const out = run(state, { type: 'startProcessing', recipeId: 'dried-mint' });
    expect(countOf(out.state.inventory, 'mint')).toBe(0);
    expect(out.state.processing).toEqual([{ recipeId: 'dried-mint', daysLeft: 1 }]);
    expect(out.state.energy.current).toBe(29);
    expect(out.state.skills.cooking).toBe(4);
  });

  it('a pickling batch takes the days in its recipe', () => {
    const skilled = at('up', { skills: { ...createNewGame(content, 7).skills, cooking: 50 } });
    const state = withItems(skilled, { 'crop.sweet-radish': 1 });
    const out = run(state, { type: 'startProcessing', recipeId: 'pickle-radish' });
    expect(out.state.processing).toEqual([{ recipeId: 'pickle-radish', daysLeft: 2 }]);
  });

  it('is refused unless the player stands in front of the workshop, and nothing is used up', () => {
    const state = withItems(at('left'), { mint: 2 });
    const out = run(state, { type: 'startProcessing', recipeId: 'dried-mint' });
    expect(out.messages).toContain('要站在加工台前面才能加工');
    expect(out.state.processing).toEqual([]);
    expect(countOf(out.state.inventory, 'mint')).toBe(2);
    expect(out.state.energy).toEqual(state.energy);
  });

  it('names the missing ingredient and uses nothing', () => {
    const state = withItems(at(), { mint: 1 });
    const out = run(state, { type: 'startProcessing', recipeId: 'dried-mint' });
    expect(out.messages.join('\n')).toContain('野薄荷 × 1');
    expect(countOf(out.state.inventory, 'mint')).toBe(1);
    expect(out.state.processing).toEqual([]);
  });

  it('a recipe above your cooking level is refused', () => {
    const state = withItems(at(), { 'fish.carp': 1 });
    const out = run(state, { type: 'startProcessing', recipeId: 'dried-carp' });
    expect(out.messages).toContain('烹飪還不夠高，做不了這道菜');
    expect(countOf(out.state.inventory, 'fish.carp')).toBe(1);
  });

  it('a full machine takes no more batches and keeps the ingredients', () => {
    const small = createContentIndex(makeContent(1));
    const busy = withItems(at('up', { processing: [{ recipeId: 'dried-mint', daysLeft: 1 }] }), { mint: 2 });
    const out = run(busy, { type: 'startProcessing', recipeId: 'dried-mint' }, small);
    expect(out.messages).toContain('加工機已經在忙，等有空位再來');
    expect(out.state.processing).toHaveLength(1);
    expect(countOf(out.state.inventory, 'mint')).toBe(2);
  });

  it('interacting with the workshop opens it', () => {
    const out = run(at(), { type: 'interact' });
    expect(out.events).toContainEqual({ type: 'workshopOpened' });
  });
});

describe('processing over the night', () => {
  it('each sleep counts every batch down by one day, and a finished batch waits in the machine', () => {
    const state = at('left', {
      processing: [
        { recipeId: 'pickle-radish', daysLeft: 2 },
        { recipeId: 'dried-mint', daysLeft: 1 },
      ],
    });
    const slept = run(state, { type: 'interact' });
    expect(slept.events).toContainEqual({ type: 'slept' });
    expect(slept.state.processing).toEqual([
      { recipeId: 'pickle-radish', daysLeft: 1 },
      { recipeId: 'dried-mint', daysLeft: 0 },
    ]);
    expect(slept.messages.join('\n')).toContain('加工機裡有 1 批完成了');
  });
});

describe('collecting finished batches', () => {
  it('moves finished products into the bag and keeps the batches still cooking', () => {
    const jobs = [
      { recipeId: 'dried-mint', daysLeft: 0 },
      { recipeId: 'pickle-radish', daysLeft: 1 },
    ];
    const state = at('up', { processing: jobs });
    const out = run(state, { type: 'collectProcessing' });
    expect(countOf(out.state.inventory, 'dried-mint')).toBe(1);
    expect(out.state.processing).toEqual([{ recipeId: 'pickle-radish', daysLeft: 1 }]);
    expect(out.messages.join('\n')).toContain('乾薄荷');
  });

  it('says so when nothing is finished yet', () => {
    const state = at('up', { processing: [{ recipeId: 'dried-mint', daysLeft: 1 }] });
    const out = run(state, { type: 'collectProcessing' });
    expect(out.messages).toContain('加工機裡還沒有完成的成品');
    expect(out.state).toEqual(state);
  });

  it('keeps the finished batch in the machine when the bag is full', () => {
    const full = addItem(createInventory(1), index.item('mint'), 99);
    if (!full.ok) throw new Error('背包放不下');
    const state = { ...at('up', { processing: [{ recipeId: 'dried-mint', daysLeft: 0 }] }), inventory: full.value };
    const out = run(state, { type: 'collectProcessing' });
    expect(out.messages).toContain('背包已滿');
    expect(out.state.processing).toEqual([{ recipeId: 'dried-mint', daysLeft: 0 }]);
  });
});
