import { describe, expect, it } from 'vitest';
import type { ContentPack, MapDef } from '../domain/content';
import { createNewGame, type GameState } from '../domain/game-state';
import { countOf } from '../domain/inventory';
import { executeCommand, type Command } from './game-commands';
import { createContentIndex, type ContentIndex } from './content-index';

/**
 * M4（P1）：釣魚。湖邊的小地圖 lake（5×3）：
 *   row0 ~~~~~   （水）
 *   row1 ~~~~~
 *   row2 .....   （岸）
 * 站在 (2,2) 面向上方的水 (2,1) 投竿。魚有季節：鯉魚四季都有，月光鱸只有夏天。
 */
const lake: MapDef = {
  id: 'lake',
  name: '月鏡湖畔',
  width: 5,
  height: 3,
  rows: ['~~~~~', '~~~~~', '.....'],
  legend: { '~': { kind: 'water' }, '.': { kind: 'grass' } },
  spawn: { x: 2, y: 2 },
  npcs: [],
};

const content: ContentPack = {
  crops: [{ id: 'sweet-radish', name: '甜蘿蔔', seedPrice: 20, growthDays: 2, seasons: ['spring'] }],
  npcs: [],
  items: [],
  crafting: [],
  processing: [],
  recipes: [],
  animals: [],
  fish: [
    { id: 'carp', name: '鯉魚', sellPrice: 30, seasons: ['spring', 'summer', 'autumn', 'winter'], weight: 3 },
    { id: 'bass', name: '月光鱸', sellPrice: 90, seasons: ['summer'], weight: 1 },
  ],
  shops: [],
  start: { mapId: 'lake', gold: 100, seeds: {} },
  tuning: {
    energy: { max: 40, costs: { till: 2, water: 1, plant: 1, harvest: 1, ship: 0, chop: 3, forage: 1, mine: 2, fish: 2, cook: 1, process: 1 } },
    inventory: { capacity: 8 },
    harvest: { min: 1, max: 5 },
    time: { wakeMinute: 360, minutesPerAction: 10, daysPerSeason: 20 },
    tools: { tiers: [{ energyDiscount: 0 }, { energyDiscount: 1 }, { energyDiscount: 1 }, { energyDiscount: 2 }] },
    gathering: { wood: { min: 1, max: 3 }, forage: { min: 1, max: 2 }, stone: { min: 1, max: 2 }, ore: { min: 1, max: 2 } },
    skills: {
      thresholds: [0, 20, 50, 90, 140, 200, 270, 350, 440, 540, 650],
      xp: { till: 2, water: 1, plant: 2, harvest: 4, chop: 4, forage: 3, mine: 4, fish: 6, cook: 5, process: 4 },
      bonusFrom: 5,
      goodFrom: 4,
      goodChance: 0.2,
      fineFrom: 8,
      fineChance: 0.08,
    },
    fishing: { biteChance: 60, bobberBonus: 10, baitBonus: 20 },
    fertilizer: { basic: { goodBonus: 20, fineBonus: 0 }, fine: { goodBonus: 30, fineBonus: 15 } },
    processing: { slots: 3 },
  },
  weather: {
    spring: [{ weather: 'sunny', weight: 1 }],
    summer: [{ weather: 'sunny', weight: 1 }],
    autumn: [{ weather: 'sunny', weight: 1 }],
    winter: [{ weather: 'snow', weight: 1 }],
  },
  maps: [lake],
};

const index: ContentIndex = createContentIndex(content);

function fresh(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createNewGame(content, 7),
    mapId: 'lake',
    tool: 'rod',
    toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0 },
    worldChanges: {},
    fishing: null,
    player: { x: 2, y: 2, facing: 'up' },
    ...overrides,
  };
}

function run(state: GameState, command: Command) {
  return executeCommand(state, command, index);
}

/** 線性同餘的小種子輸出幾乎一樣，所以測試用打散過的種子。 */
function spread(i: number): number {
  return Math.imul(i, 2654435761) >>> 0;
}

/** 找一個會上鉤的隨機數狀態（測試要確定的結果，不靠運氣）。 */
function biting(): GameState {
  for (let i = 1; i < 500; i += 1) {
    const state = fresh({ rng: spread(i) });
    if (run(state, { type: 'interact' }).events.some((e) => e.type === 'bite')) return state;
  }
  throw new Error('找不到會上鉤的種子');
}

/** 找一個不會上鉤的隨機數狀態。 */
function missing(): GameState {
  for (let i = 1; i < 500; i += 1) {
    const state = fresh({ rng: spread(i) });
    if (!run(state, { type: 'interact' }).events.some((e) => e.type === 'bite')) return state;
  }
  throw new Error('找不到不上鉤的種子');
}

describe('casting the line', () => {
  it('without the rod in hand, the water cannot be fished: refused, nothing spent', () => {
    const state = fresh({ tool: 'hoe' });
    const out = run(state, { type: 'interact' });
    expect(out.messages).toContain('要先切到釣竿才能釣魚');
    expect(out.state.energy).toEqual(state.energy);
  });

  it('casting spends energy and gives fishing experience, whether or not a fish bites', () => {
    const state = missing();
    const out = run(state, { type: 'interact' });
    expect(out.state.energy.current).toBe(state.energy.current - 2);
    expect(out.state.skills.fishing).toBe(6);
    expect(out.messages).toContain('魚沒有上鉤');
    expect(out.state.fishing).toBeNull();
  });

  it('when a fish bites, the lake says so and remembers it until the line is reeled in', () => {
    const out = run(biting(), { type: 'interact' });
    expect(out.events).toContainEqual({ type: 'bite' });
    expect(out.state.fishing).not.toBeNull();
    expect(out.messages).toContain('魚上鉤了！');
  });
});

describe('reeling in', () => {
  it('a good hit catches the fish, which goes into the bag', () => {
    const cast = run(biting(), { type: 'interact' });
    const out = run(cast.state, { type: 'reel', hit: true });
    expect(out.state.fishing).toBeNull();
    expect(countOf(out.state.inventory, 'fish.carp')).toBe(1); // 春天只有鯉魚
    expect(out.messages.join('\n')).toContain('釣到了鯉魚');
  });

  it('a late hit lets the fish get away', () => {
    const cast = run(biting(), { type: 'interact' });
    const out = run(cast.state, { type: 'reel', hit: false });
    expect(out.state.fishing).toBeNull();
    expect(countOf(out.state.inventory, 'fish.carp')).toBe(0);
    expect(out.messages).toContain('魚跑掉了');
  });

  it('reeling with no fish on the line is refused', () => {
    const out = run(fresh(), { type: 'reel', hit: true });
    expect(out.events).toContainEqual({ type: 'refused', reason: 'NO_BITE' });
  });

  it('walking away lets the fish go: the bite is gone', () => {
    const cast = run(biting(), { type: 'interact' });
    const moved = run(cast.state, { type: 'move', direction: 'left' });
    expect(moved.state.fishing).toBeNull();
    expect(run(moved.state, { type: 'reel', hit: true }).events).toContainEqual({ type: 'refused', reason: 'NO_BITE' });
  });

  it('in summer the rarer bass can be caught too', () => {
    const summer = fresh({ calendar: { year: 1, season: 'summer', day: 3, minuteOfDay: 600 } });
    const bites = [] as string[];
    for (let i = 1; i < 400 && bites.length < 1; i += 1) {
      const cast = run({ ...summer, rng: spread(i) }, { type: 'interact' });
      if (!cast.events.some((e) => e.type === 'bite')) continue;
      const out = run(cast.state, { type: 'reel', hit: true });
      for (const id of ['fish.carp', 'fish.bass']) if (countOf(out.state.inventory, id) > 0) bites.push(id);
    }
    expect(bites.length).toBeGreaterThan(0);
  });
});
