import { describe, expect, it } from 'vitest';
import mineRulesJson from '../../content/mine.json';
import type { ContentPack, MapDef } from '../domain/content';
import { createNewGame, type GameState } from '../domain/game-state';
import { countOf } from '../domain/inventory';
import { clearDaily, changeAt, effectiveKind } from '../domain/world-changes';
import { isWalkable, tileAt } from '../domain/world';
import { executeCommand, type Command } from './game-commands';
import { createContentIndex, type ContentIndex } from './content-index';
import { loadContent } from '../infrastructure/content/load-content';
import crops from '../../content/crops.json';
import npcs from '../../content/npcs.json';
import start from '../../content/start.json';
import tuning from '../../content/tuning.json';
import assets from '../../content/assets.json';
import rigs from '../../content/rigs.json';
import companions from '../../content/companions.json';
import tools from '../../content/tools.json';
import sounds from '../../content/sounds.json';
import terrain from '../../content/terrain.json';
import weather from '../../content/weather.json';
import items from '../../content/items.json';
import shops from '../../content/shops.json';
import fish from '../../content/fish.json';
import animals from '../../content/animals.json';
import recipes from '../../content/recipes.json';
import processing from '../../content/processing.json';
import crafting from '../../content/crafting.json';
import talents from '../../content/talents.json';
import music from '../../content/music.json';
import forest from '../../content/maps/forest.json';
import lake from '../../content/maps/lake.json';
import house from '../../content/maps/house.json';
import mineEntrance from '../../content/maps/mine-entrance.json';
import coop from '../../content/maps/coop.json';
import pasture from '../../content/maps/pasture.json';
import cowbarn from '../../content/maps/cowbarn.json';
import farm from '../../content/maps/farm.json';
import greenhouse from '../../content/maps/greenhouse.json';
import village from '../../content/maps/village.json';
import plaza from '../../content/maps/plaza.json';
import schedules from '../../content/schedules.json';
import events from '../../content/events.json';
import friendship from '../../content/friendship.json';
import quests from '../../content/quests.json';
import letters from '../../content/letters.json';
import festivals from '../../content/festivals.json';
import mainQuest from '../../content/main-quest.json';
import repairs from '../../content/repairs.json';
import randomEvents from '../../content/events-random.json';

/**
 * 鐮刀（M4 P1）：割除草叢（tuft）得到乾草；體力沿用砍樹的消耗，由鐮刀階級打折；沒有鐮刀時說明原因。
 * 草叢割掉後是草地（永久，不像野薄荷隔日恢復）。
 */
const meadow: MapDef = {
  id: 'meadow',
  name: '草地',
  width: 5,
  height: 3,
  rows: ['#####', '#V..#', '#...#'],
  legend: {
    '#': { kind: 'wall' },
    '.': { kind: 'grass' },
    V: { kind: 'tuft' },
  },
  spawn: { x: 2, y: 1 },
};

const content: ContentPack = {
  crops: [{ id: 'dew-grass', name: '晨露草', seedPrice: 10, growthDays: 1, seasons: ['spring'] }],
  npcs: [],
  schedule: { periods: { noon: 720, evening: 1020 }, entries: [] },
  heartEvents: [],
  friendship: { pointsPerHeart: 100, maxHearts: 10, earlyCap: { hearts: 4, untilSeason: 'summer' }, talkPoints: 10, gift: { love: 80, neutral: 30, hate: -40 }, cropQuality: { minHearts: 2, perResident: 0.05, cap: 0.15 } },
  items: [{ id: 'hay', name: '乾草', kind: 'material', maxStack: 99 }],
  fish: [],
  animals: [],
  recipes: [],
  crafting: [],
  processing: [],
  shops: [],
  start: { mapId: 'meadow', gold: 0, seeds: {} },
  talents: { unlockLevel: 5, defs: [] },
  mine: mineRulesJson,
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
      xp: { till: 2, water: 1, plant: 2, harvest: 4, chop: 4, forage: 3, mine: 4, fish: 6, cook: 5, process: 4 },
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
  maps: [meadow],
};

const index: ContentIndex = createContentIndex(content);

/** 站在草叢的右邊，面向草叢。 */
function facingTuft(overrides: Partial<GameState> = {}): GameState {
  return { ...createNewGame(content, 5), mapId: 'meadow', player: { x: 2, y: 1, facing: 'left' }, tool: 'sickle', ...overrides };
}

function run(state: GameState, command: Command) {
  return executeCommand(state, command, index);
}

describe('cutting grass with the sickle', () => {
  it('cuts the tuft into hay and leaves grass behind', () => {
    const out = run(facingTuft(), { type: 'interact' });
    expect(countOf(out.state.inventory, 'hay')).toBe(1);
    expect(out.messages).toEqual(['割下了 1 把乾草']);
    expect(changeAt(out.state.worldChanges, 'meadow', 1, 1)).toBe('cut');
    expect(effectiveKind('tuft', changeAt(out.state.worldChanges, 'meadow', 1, 1))).toBe('grass');
  });

  it('lets the player walk onto the cut grass', () => {
    const cut = run(facingTuft(), { type: 'interact' }).state;
    const walked = run(cut, { type: 'move', direction: 'left' });
    expect(walked.state.player).toMatchObject({ x: 1, y: 1 });
  });

  it('gives foraging experience, the same as other foraging', () => {
    const out = run(facingTuft(), { type: 'interact' });
    expect(out.state.skills.foraging).toBe(3);
  });

  it('costs the chop amount of energy at the basic tier, and less with a higher sickle tier', () => {
    const basic = run(facingTuft({ toolTiers: { ...createNewGame(content, 5).toolTiers, sickle: 0 } }), { type: 'interact' });
    expect(basic.state.energy.current).toBe(40 - 3);

    const silver = run(facingTuft({ toolTiers: { ...createNewGame(content, 5).toolTiers, sickle: 2 } }), { type: 'interact' });
    expect(silver.state.energy.current).toBe(40 - 2);

    const gold = run(facingTuft({ toolTiers: { ...createNewGame(content, 5).toolTiers, sickle: 3 } }), { type: 'interact' });
    expect(gold.state.energy.current).toBe(40 - 1);
  });

  it('without the sickle in hand, says so and changes nothing', () => {
    const state = facingTuft({ tool: 'hoe' });
    const out = run(state, { type: 'interact' });
    expect(out.messages).toEqual(['要先切到鐮刀才能割草']);
    expect(out.state).toEqual(state);
  });

  it('with no energy left, refuses and keeps the tuft', () => {
    const state = facingTuft({ energy: { current: 0, max: 40 } });
    const out = run(state, { type: 'interact' });
    expect(out.messages).toEqual(['體力不足，請回家睡覺']);
    expect(tileAt(content.maps[0] as MapDef, 1, 1)?.kind).toBe('tuft');
    expect(changeAt(out.state.worldChanges, 'meadow', 1, 1)).toBeUndefined();
  });

  it('a tuft is not walkable until it is cut', () => {
    expect(isWalkable('tuft')).toBe(false);
  });

  it('cut grass stays cut the next day, unlike wild mint, which grows back', () => {
    const cut = run(facingTuft(), { type: 'interact' }).state;
    expect(clearDaily(cut.worldChanges)).toEqual(cut.worldChanges);
  });
});

describe('the shipped forest has tufts a player can reach', () => {
  const { pack } = loadContent({
    crops,
    npcs,
    schedules,
    events,
    friendship,
    quests,
    letters,
    festivals,
    mainQuest, repairs, randomEvents,
    maps: [farm, greenhouse, village, plaza, forest, lake, house, mineEntrance, coop, pasture, cowbarn],
    start,
    tuning,
    assets,
    rigs,
    companions,
    tools,
    sounds,
    music,
    terrain,
    weather,
    items,
    shops,
    fish,
    animals,
    recipes,
    processing,
    crafting,
    talents,
    mine: mineRulesJson,
  });
  const map = pack.maps.find((m) => m.id === 'forest');
  if (!map) throw new Error('缺少森林地圖');

  it('has at least one tuft, and every tuft touches a walkable tile', () => {
    const tufts: { x: number; y: number }[] = [];
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (tileAt(map, x, y)?.kind === 'tuft') tufts.push({ x, y });
      }
    }
    expect(tufts.length).toBeGreaterThan(0);
    for (const { x, y } of tufts) {
      const reachable = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ].some(([nx, ny]) => {
        const tile = tileAt(map, nx ?? -1, ny ?? -1);
        return tile !== null && isWalkable(tile.kind);
      });
      expect(reachable, `(${x},${y})`).toBe(true);
    }
  });
});
