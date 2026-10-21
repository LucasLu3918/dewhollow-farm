import { describe, expect, it } from 'vitest';
import type { ContentPack, MapDef } from '../domain/content';
import { createNewGame, type GameState } from '../domain/game-state';
import { countOf, addItem, createInventory } from '../domain/inventory';
import { generateMineLayer, mineId, type MineRules } from '../domain/mine';
import { changeAt, withChange } from '../domain/world-changes';
import { executeCommand, type Command } from './game-commands';
import { createContentIndex, type ContentIndex } from './content-index';
import mineRulesJson from '../../content/mine.json';

const mineRules: MineRules = mineRulesJson;

/** 深層礦脈：一格銀礦石（s），站在左邊敲它。 */
const pit: MapDef = {
  id: 'pit',
  name: '深層礦脈',
  width: 4,
  height: 3,
  rows: ['####', '#.s#', '####'],
  legend: {
    '#': { kind: 'wall' },
    '.': { kind: 'path' },
    s: { kind: 'ore', item: 'silver-ore' },
  },
  spawn: { x: 1, y: 1 },
};

/**
 * M4（P1）：礦坑。小地圖 entrance（4×4）：
 *   row0 ####   row1 #C.#   （C 落石洞口，通往第 1 層）
 *   row2 r..o   （r 石頭、o 銅礦）
 *   row3 .B.B   （B 床，只為了讓測試能睡覺）
 */
const entrance: MapDef = {
  id: 'entrance',
  name: '礦坑入口',
  width: 4,
  height: 4,
  rows: ['####', '#C.#', 'r..o', '.BB.'],
  legend: {
    '#': { kind: 'wall' },
    C: { kind: 'cave', to: 'mine-1' },
    '.': { kind: 'path' },
    r: { kind: 'rock' },
    o: { kind: 'ore' },
    B: { kind: 'bed' },
  },
  spawn: { x: 2, y: 2 },
};

const content: ContentPack = {
  crops: [{ id: 'sweet-radish', name: '甜蘿蔔', seedPrice: 20, growthDays: 2, seasons: ['spring'] }],
  npcs: [],
  schedule: { periods: { noon: 720, evening: 1020 }, entries: [] },
  heartEvents: [],
  friendship: { pointsPerHeart: 100, maxHearts: 10, earlyCap: { hearts: 4, untilSeason: 'summer' }, talkPoints: 10, gift: { love: 80, neutral: 30, hate: -40 }, cropQuality: { minHearts: 2, perResident: 0.05, cap: 0.15 } },
  crafting: [],
  talents: { unlockLevel: 5, defs: [] },
  processing: [],
  recipes: [],
  animals: [],
  fish: [],
  items: [
    { id: 'wood', name: '木材', kind: 'material', maxStack: 99, sellPrice: 6 },
    { id: 'stone', name: '石頭', kind: 'material', maxStack: 99, sellPrice: 2 },
    { id: 'copper-ore', name: '銅礦石', kind: 'ore', maxStack: 99, sellPrice: 20 },
    { id: 'silver-ore', name: '銀礦石', kind: 'ore', maxStack: 99, sellPrice: 50 },
  ],
  shops: [],
  start: { mapId: 'entrance', gold: 100, seeds: {} },
  mine: mineRules,
  tuning: {
    energy: { max: 40, costs: { till: 2, water: 1, plant: 1, harvest: 1, ship: 0, chop: 3, forage: 1, mine: 2, fish: 2, cook: 1, process: 1 } },
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
  maps: [entrance, pit],
};

const index: ContentIndex = createContentIndex(content);

function fresh(overrides: Partial<GameState> = {}): GameState {
  return { ...createNewGame(content, 7), mapId: 'entrance', toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 }, worldChanges: {}, ...overrides };
}

function at(state: GameState, x: number, y: number, facing: GameState['player']['facing'], tool: GameState['tool'] = 'pick'): GameState {
  return { ...state, player: { x, y, facing }, tool };
}

function run(state: GameState, command: Command) {
  return executeCommand(state, command, index);
}

describe('mining rocks and ore with the pick', () => {
  it('without the pick, a rock will not budge: refused, nothing spent', () => {
    const state = at(fresh(), 0, 3, 'up', 'hoe');
    const out = run(state, { type: 'interact' });
    expect(out.messages).toContain('要先切到鎬才能敲石頭');
    expect(out.state.energy).toEqual(state.energy);
  });

  it('a rock with the pick gives stone, costs 2 energy, and becomes open path', () => {
    const state = at(fresh(), 0, 3, 'up');
    const out = run(state, { type: 'interact' });
    expect(out.state.energy.current).toBe(state.energy.current - 2);
    // 面向 (0,2) 的石頭
    const stone = countOf(out.state.inventory, 'stone');
    expect(stone).toBeGreaterThanOrEqual(1);
    expect(stone).toBeLessThanOrEqual(2);
    expect(changeAt(out.state.worldChanges, 'entrance', 0, 2)).toBe('mined');
    expect(out.events).toContainEqual({ type: 'acted', action: 'mine', x: 0, y: 2 });
  });

  it('copper ore gives copper ore', () => {
    const state = at(fresh(), 3, 3, 'up');
    const out = run(state, { type: 'interact' });
    const ore = countOf(out.state.inventory, 'copper-ore');
    expect(ore).toBeGreaterThanOrEqual(1);
    expect(ore).toBeLessThanOrEqual(2);
  });

  it('a deep silver vein gives silver ore (its own item, not copper)', () => {
    const state = at({ ...fresh(), mapId: 'pit' }, 1, 1, 'right');
    const out = run(state, { type: 'interact' });
    const silver = countOf(out.state.inventory, 'silver-ore');
    expect(silver).toBeGreaterThanOrEqual(1);
    expect(silver).toBeLessThanOrEqual(2);
    expect(countOf(out.state.inventory, 'copper-ore')).toBe(0);
    expect(changeAt(out.state.worldChanges, 'pit', 2, 1)).toBe('mined');
  });

  it('a mined spot is empty: a second swing finds nothing there', () => {
    const once = run(at(fresh(), 0, 3, 'up'), { type: 'interact' }).state;
    const again = run(once, { type: 'interact' });
    expect(again.events).toContainEqual({ type: 'refused', reason: 'NOTHING_HERE' });
    expect(again.state.energy).toEqual(once.energy);
  });

  it('a pick better than the basic one costs less energy (tier discount)', () => {
    const state = at(fresh({ toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 1, rod: 0, sickle: 0 } }), 0, 3, 'up');
    const out = run(state, { type: 'interact' });
    expect(out.state.energy.current).toBe(state.energy.current - 1);
  });
});

describe('the cave mouth', () => {
  it('a fallen rock blocks the cave: without the pick it is refused and nothing moves', () => {
    const state = at(fresh(), 1, 2, 'up', 'hoe');
    const out = run(state, { type: 'move', direction: 'up' });
    expect(out.state.mapId).toBe('entrance');
    const cave = run(at(fresh(), 1, 2, 'up', 'hoe'), { type: 'interact' });
    expect(cave.messages).toContain('落石擋住了礦坑入口，要用鎬才清得開');
  });

  it('with the pick the rock is cleared, and walking in goes to the first floor', () => {
    const cleared = run(at(fresh(), 1, 2, 'up'), { type: 'interact' });
    expect(changeAt(cleared.state.worldChanges, 'entrance', 1, 1)).toBe('cleared');
    const entered = run(at(cleared.state, 1, 2, 'up'), { type: 'move', direction: 'up' });
    expect(entered.state.mapId).toBe(mineId(1));
    expect(entered.state.player).toMatchObject({ x: entered.state.player.x, y: entered.state.player.y });
    expect(entered.events).toContainEqual({ type: 'enteredMap', mapId: mineId(1) });
    expect(index.map(mineId(1)).id).toBe(mineId(1));
  });

  it('after a checkpoint is reached, the cave takes you to that checkpoint instead', () => {
    const cleared = fresh({ mineCheckpoint: 5, worldChanges: withChange({}, 'entrance', 1, 1, 'cleared') });
    const entered = run(at(cleared, 1, 2, 'up'), { type: 'move', direction: 'up' });
    expect(entered.state.mapId).toBe(mineId(5));
  });
});

describe('going down and up in the mine', () => {
  it('walking onto the down staircase goes one floor deeper, and a checkpoint floor is remembered', () => {
    // 第 4 層：站在 '>' 旁邊，往 '>' 走。
    const layer = generateMineLayer(4, 7, mineRules);
    const down = layer.rows.map((row, y) => [row.indexOf('>'), y]).find(([x]) => (x ?? -1) >= 0);
    if (!down) throw new Error('no down staircase');
    const [dx, dy] = down as [number, number];
    index.ensureMine(4, 7);
    const state = fresh({ mapId: mineId(4), mineSeed: 7, player: { x: dx + 1, y: dy, facing: 'left' } });
    const out = run(state, { type: 'move', direction: 'left' });
    expect(out.state.mapId).toBe(mineId(5));
    expect(out.state.mineCheckpoint).toBe(5);
  });

  it('walking onto the up staircase goes back up', () => {
    index.ensureMine(2, 7);
    const layer = generateMineLayer(2, 7, mineRules);
    const up = layer.rows.map((row, y) => [row.indexOf('<'), y]).find(([x]) => (x ?? -1) >= 0);
    if (!up) throw new Error('no up staircase');
    const [ux, uy] = up as [number, number];
    const state = fresh({ mapId: mineId(2), mineSeed: 7, player: { x: ux - 1, y: uy, facing: 'right' } });
    const out = run(state, { type: 'move', direction: 'right' });
    expect(out.state.mapId).toBe(mineId(1));
  });
});

describe('the deep mine: elevator and checkpoints past floor 40', () => {
  function downStairOf(layer: number, seed: number): { x: number; y: number } {
    const map = generateMineLayer(layer, seed, mineRules);
    for (let y = 0; y < map.height; y += 1) {
      const x = map.rows[y]?.indexOf('>') ?? -1;
      if (x >= 0) return { x, y };
    }
    throw new Error(`layer ${layer} has no down staircase`);
  }

  it('after checkpoint 45 is reached, the cave takes you straight to floor 45', () => {
    const cleared = fresh({ mineCheckpoint: 45, worldChanges: withChange({}, 'entrance', 1, 1, 'cleared') });
    const entered = run(at(cleared, 1, 2, 'up'), { type: 'move', direction: 'up' });
    expect(entered.state.mapId).toBe(mineId(45));
    expect(entered.state.mineCheckpoint).toBe(45);
  });

  it('walking down onto floor 44 stairs reaches floor 45 and remembers that checkpoint; floor 46 is not a checkpoint', () => {
    const down44 = downStairOf(44, 7);
    index.ensureMine(44, 7);
    const onto44 = fresh({ mapId: mineId(44), mineSeed: 7, player: { x: down44.x + 1, y: down44.y, facing: 'left' } });
    const to45 = run(onto44, { type: 'move', direction: 'left' });
    expect(to45.state.mapId).toBe(mineId(45));
    expect(to45.state.mineCheckpoint).toBe(45);

    const down45 = downStairOf(45, 7);
    const to46 = run({ ...to45.state, player: { x: down45.x + 1, y: down45.y, facing: 'left' } }, { type: 'move', direction: 'left' });
    expect(to46.state.mapId).toBe(mineId(46));
    expect(to46.state.mineCheckpoint).toBe(45);
  });
});

describe('mining trains the mining skill', () => {
  it('each swing gives mining experience, and level 5 gives one more ore', () => {
    const state = at(fresh({ skills: { farming: 0, foraging: 0, fishing: 0, mining: 140, cooking: 0 } }), 3, 3, 'up');
    const out = run(state, { type: 'interact' });
    expect(out.state.skills.mining).toBe(144);
    expect(countOf(out.state.inventory, 'copper-ore')).toBeGreaterThanOrEqual(2);
  });
});
