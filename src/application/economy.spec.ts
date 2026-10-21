import { describe, expect, it } from 'vitest';
import type { ContentPack } from '../domain/content';
import { createNewGame, type GameState, type ToolId } from '../domain/game-state';
import { addItem, countOf, createInventory } from '../domain/inventory';
import { changeAt, withChange } from '../domain/world-changes';
import { executeCommand, type Command } from './game-commands';
import { createContentIndex, type ContentIndex } from './content-index';

/**
 * M4（P0）：採集與砍伐、雜貨店、鐵匠升級。
 * 小地圖 yard（5×4）：
 *   row0 #####   row1 .T.H.   （T 樹 (1,1)、H 野薄荷 (3,1)）
 *   row2 ..Q.I   （Q 雜貨店櫃檯 (2,2)、I 鐵匠櫃檯 (4,2)）
 *   row3 B.ff.   （B 床 (0,3)、田 (2,3)(3,3)）
 */
const content: ContentPack = {
  crops: [{ id: 'sweet-radish', name: '甜蘿蔔', seedPrice: 20, growthDays: 2, seasons: ['spring'] }],
  npcs: [],
  crafting: [],
  processing: [],
  recipes: [],
  animals: [],
  fish: [],
  items: [
    { id: 'wood', name: '木材', kind: 'material', maxStack: 99, sellPrice: 6 },
    { id: 'mint', name: '野薄荷', kind: 'forage', maxStack: 99, sellPrice: 14 },
    { id: 'copper-ore', name: '銅礦石', kind: 'ore', maxStack: 99, sellPrice: 20 },
  ],
  shops: [
    { id: 'general', name: '雜貨店', stock: [{ itemId: 'seed.sweet-radish', price: 25 }], upgrades: [] },
    {
      id: 'smithy',
      name: '鐵匠',
      stock: [],
      upgrades: [
        { toolId: 'hoe', tier: 1, gold: 300, items: { wood: 10 } },
        { toolId: 'hoe', tier: 2, gold: 800, items: { 'copper-ore': 5, wood: 20 } },
      ],
    },
  ],
  start: { mapId: 'yard', gold: 400, seeds: { 'sweet-radish': 2 } },
  tuning: {
    energy: { max: 20, costs: { till: 2, water: 1, plant: 1, harvest: 1, ship: 0, chop: 3, forage: 1, mine: 2, fish: 2, cook: 1, process: 1 } },
    inventory: { capacity: 8 },
    harvest: { min: 1, max: 5 },
    time: { wakeMinute: 360, minutesPerAction: 10, daysPerSeason: 20 },
    tools: { tiers: [{ energyDiscount: 0 }, { energyDiscount: 1 }, { energyDiscount: 1 }, { energyDiscount: 2 }] },
    fishing: { biteChance: 60, bobberBonus: 10, baitBonus: 20 },
    fertilizer: { basic: { goodBonus: 20, fineBonus: 0 }, fine: { goodBonus: 30, fineBonus: 15 } },
    processing: { slots: 3 },
    skills: { thresholds: [0, 20, 50, 90, 140, 200, 270, 350, 440, 540, 650], xp: { till: 2, water: 1, plant: 2, harvest: 4, chop: 4, forage: 3, mine: 4 }, bonusFrom: 5, goodFrom: 4, goodChance: 0.2, fineFrom: 8, fineChance: 0.08 },
    gathering: { wood: { min: 1, max: 3 }, forage: { min: 1, max: 2 }, stone: { min: 1, max: 2 }, ore: { min: 1, max: 2 } },
  },
  weather: {
    spring: [{ weather: 'sunny', weight: 1 }],
    summer: [{ weather: 'sunny', weight: 1 }],
    autumn: [{ weather: 'sunny', weight: 1 }],
    winter: [{ weather: 'snow', weight: 1 }],
  },
  maps: [
    {
      id: 'yard',
      name: '院子',
      width: 5,
      height: 4,
      rows: ['#####', '.T.H.', '..Q.I', 'B.ff.'],
      legend: {
        '#': { kind: 'wall' },
        '.': { kind: 'grass' },
        T: { kind: 'tree' },
        H: { kind: 'forage' },
        Q: { kind: 'shop', shop: 'general' },
        I: { kind: 'shop', shop: 'smithy' },
        B: { kind: 'bed' },
        f: { kind: 'field' },
      },
      spawn: { x: 1, y: 2 },
      npcs: [],
    },
  ],
};

const index: ContentIndex = createContentIndex(content);

function at(state: GameState, x: number, y: number, facing: GameState['player']['facing'], tool: ToolId = 'axe'): GameState {
  return { ...state, player: { x, y, facing }, tool };
}

/** 放進背包一些物品（之後的購買、升級要用）。 */
function withItems(state: GameState, counts: Record<string, number>): GameState {
  let inventory = createInventory(8);
  for (const [id, count] of Object.entries(counts)) {
    const added = addItem(inventory, index.item(id), count);
    if (!added.ok) throw new Error(`背包放不下 ${id}`);
    inventory = added.value;
  }
  return { ...state, inventory: { ...state.inventory, stacks: inventory.stacks } };
}

function run(state: GameState, command: Command) {
  return executeCommand(state, command, index);
}

function fresh(overrides: Partial<GameState> = {}): GameState {
  return { ...createNewGame(content, 7), mapId: 'yard', toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0 }, worldChanges: {}, ...overrides };
}

describe('chopping a tree with the axe', () => {
  it('gives wood, costs 3 energy, and leaves plain grass behind', () => {
    const state = at(fresh(), 1, 2, 'up');
    const out = run(state, { type: 'interact' });
    const wood = countOf(out.state.inventory, 'wood');
    expect(wood).toBeGreaterThanOrEqual(1);
    expect(wood).toBeLessThanOrEqual(3);
    expect(out.state.energy.current).toBe(state.energy.current - 3);
    expect(changeAt(out.state.worldChanges, 'yard', 1, 1)).toBe('chopped');
    expect(out.events).toContainEqual({ type: 'acted', action: 'chop', x: 1, y: 1 });
  });

  it('a chopped tree cannot be chopped again: there is only grass there now', () => {
    const once = run(at(fresh(), 1, 2, 'up'), { type: 'interact' }).state;
    const again = run(once, { type: 'interact' });
    expect(again.events).toContainEqual({ type: 'refused', reason: 'NOTHING_HERE' });
    expect(again.state.energy).toEqual(once.energy);
  });
});

describe('foraging wild mint', () => {
  it('picks mint once; the spot is empty until the next morning', () => {
    const state = at(fresh(), 3, 2, 'up', 'hoe');
    const picked = run(state, { type: 'interact' });
    const mint = countOf(picked.state.inventory, 'mint');
    expect(mint).toBeGreaterThanOrEqual(1);
    expect(mint).toBeLessThanOrEqual(2);
    expect(picked.state.energy.current).toBe(state.energy.current - 1);

    const again = run(picked.state, { type: 'interact' });
    expect(again.messages).toContain('這裡已經採過了，明天再來');
    expect(again.state.energy).toEqual(picked.state.energy);
  });

  it('sleeping brings the mint back, but a chopped tree stays chopped', () => {
    const chopped = fresh({ worldChanges: withChange({}, 'yard', 1, 1, 'chopped') });
    const picked = run(at(chopped, 3, 2, 'up', 'hoe'), { type: 'interact' }).state;
    const toBed = at(picked, 1, 3, 'left', 'hoe');
    const slept = run(toBed, { type: 'interact' }).state;
    expect(changeAt(slept.worldChanges, 'yard', 3, 1)).toBeUndefined();
    expect(changeAt(slept.worldChanges, 'yard', 1, 1)).toBe('chopped');
    expect(slept.calendar.day).toBe(2);
  });
});

describe('the general store', () => {
  it('buying seeds takes gold and adds the seeds, when standing at the counter', () => {
    const state = at(fresh(), 2, 3, 'up', 'hoe');
    const out = run(state, { type: 'buy', shopId: 'general', itemId: 'seed.sweet-radish', count: 2 });
    expect(out.state.gold).toBe(400 - 50);
    expect(countOf(out.state.inventory, 'seed.sweet-radish')).toBe(2 + 2);
    expect(out.messages.join('\n')).toContain('買了');
  });

  it('buying away from the counter is refused and costs nothing', () => {
    const out = run(at(fresh(), 1, 2, 'down', 'hoe'), { type: 'buy', shopId: 'general', itemId: 'seed.sweet-radish', count: 1 });
    expect(out.state.gold).toBe(400);
    expect(out.messages).toContain('要站在櫃檯前面才能買');
    expect(out.events).toContainEqual({ type: 'refused', reason: 'NOT_AT_SHOP' });
  });

  it('running out of gold is refused', () => {
    const state = at(fresh({ gold: 10 }), 2, 3, 'up', 'hoe');
    const out = run(state, { type: 'buy', shopId: 'general', itemId: 'seed.sweet-radish', count: 2 });
    expect(out.state.gold).toBe(10);
    expect(out.messages).toContain('金幣不夠');
  });
});

describe('the smithy', () => {
  it('a copper hoe costs 300 gold and 10 wood, and then tilling costs 1 energy instead of 2', () => {
    const state = at(withItems(fresh(), { wood: 10 }), 4, 3, 'up', 'hoe');
    const upgraded = run(state, { type: 'upgrade', shopId: 'smithy', toolId: 'hoe' });
    expect(upgraded.state.gold).toBe(400 - 300);
    expect(countOf(upgraded.state.inventory, 'wood')).toBe(0);
    expect(upgraded.state.toolTiers.hoe).toBe(1);

    const tilling = at(upgraded.state, 3, 2, 'down', 'hoe');
    const tilled = run(tilling, { type: 'interact' });
    expect(tilled.state.energy.current).toBe(tilling.energy.current - 1);
  });

  it('the next tier needs copper ore, which the player cannot have yet: refused, nothing changes', () => {
    const state = at(withItems(fresh({ gold: 2000, toolTiers: { hoe: 1, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0 } }), { wood: 50 }), 4, 3, 'up', 'hoe');
    const out = run(state, { type: 'upgrade', shopId: 'smithy', toolId: 'hoe' });
    expect(out.state.toolTiers.hoe).toBe(1);
    expect(out.state.gold).toBe(2000);
    expect(out.messages.join('\n')).toContain('銅礦石');
    expect(out.events).toContainEqual({ type: 'refused', reason: 'NO_MATERIAL' });
  });

  it('upgrading only works at the smithy counter', () => {
    const state = at(withItems(fresh(), { wood: 10 }), 2, 3, 'up', 'hoe');
    const out = run(state, { type: 'upgrade', shopId: 'smithy', toolId: 'hoe' });
    expect(out.state.toolTiers.hoe).toBe(0);
    expect(out.events).toContainEqual({ type: 'refused', reason: 'NOT_AT_SHOP' });
  });
});

describe('shop counters', () => {
  it('talking to a counter opens the shop, without spending energy or time', () => {
    const state = at(fresh(), 2, 3, 'up', 'hoe');
    const out = run(state, { type: 'interact' });
    expect(out.events).toContainEqual({ type: 'shopOpened', shopId: 'general' });
    expect(out.state.energy).toEqual(state.energy);
    expect(out.state.calendar).toEqual(state.calendar);
  });
});

describe('a whole walk through the yard keeps the numbers honest', () => {
  it('money, wood and energy never go negative across a chop, a buy and an upgrade', () => {
    let state = at(fresh({ gold: 400 }), 1, 2, 'up', 'axe');
    state = run(state, { type: 'interact' }).state; // 砍樹
    state = run(at(state, 2, 3, 'up', 'hoe'), { type: 'buy', shopId: 'general', itemId: 'seed.sweet-radish', count: 1 }).state;
    state = run(at(state, 4, 3, 'up', 'hoe'), { type: 'upgrade', shopId: 'smithy', toolId: 'hoe' }).state;
    expect(state.gold).toBeGreaterThanOrEqual(0);
    expect(state.energy.current).toBeGreaterThanOrEqual(0);
    expect(countOf(state.inventory, 'wood')).toBeGreaterThanOrEqual(0);
  });
});
