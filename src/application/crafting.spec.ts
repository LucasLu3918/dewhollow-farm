import { describe, expect, it } from 'vitest';
import crops from '../../content/crops.json';
import mine from '../../content/mine.json';
import npcs from '../../content/npcs.json';
import start from '../../content/start.json';
import tuning from '../../content/tuning.json';
import assets from '../../content/assets.json';
import rigs from '../../content/rigs.json';
import companions from '../../content/companions.json';
import tools from '../../content/tools.json';
import sounds from '../../content/sounds.json';
import music from '../../content/music.json';
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
import farm from '../../content/maps/farm.json';
import greenhouse from '../../content/maps/greenhouse.json';
import village from '../../content/maps/village.json';
import forest from '../../content/maps/forest.json';
import lake from '../../content/maps/lake.json';
import house from '../../content/maps/house.json';
import mineEntrance from '../../content/maps/mine-entrance.json';
import coop from '../../content/maps/coop.json';
import pasture from '../../content/maps/pasture.json';
import cowbarn from '../../content/maps/cowbarn.json';
import { loadContent } from '../infrastructure/content/load-content';
import { createNewGame, type GameState } from '../domain/game-state';
import { addItem, countOf, createInventory } from '../domain/inventory';
import { emptySkills } from '../domain/skills';
import { executeCommand, type Command } from './game-commands';
import { createContentIndex, type ContentIndex } from './content-index';
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
 * M4b：合成（工作台）。站在小屋的工作台 (4,15) 前面，也就是 (4,16) 面向上方。
 */
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
  mine,
});
const index: ContentIndex = createContentIndex(pack);

function at(overrides: Partial<GameState> = {}, facing: 'up' | 'left' = 'up'): GameState {
  return {
    ...createNewGame(pack, 7),
    mapId: 'house',
    player: { x: 4, y: 16, facing },
    tool: 'hoe',
    fishing: null,
    animals: [],
    energy: { current: 40, max: 100 },
    skills: { ...emptySkills(), farming: 140, foraging: 50, fishing: 20, mining: 20 },
    ...overrides,
  };
}

function withItems(state: GameState, items: Record<string, number>): GameState {
  let inventory = createInventory(state.inventory.capacity);
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

describe('crafting at the workbench', () => {
  it('a recipe uses its ingredients and makes its product', () => {
    const state = withItems(at(), { wood: 2, stone: 2, hay: 2 });
    const out = run(state, { type: 'craft', recipeId: 'fertilizer-basic' });
    expect(out.messages.join('\n')).toContain('普通肥料');
    expect(countOf(out.state.inventory, 'hay')).toBe(0);
    expect(countOf(out.state.inventory, 'stone')).toBe(1);
    expect(countOf(out.state.inventory, 'fertilizer-basic')).toBe(2);
  });

  it('crafting costs no energy', () => {
    const state = withItems(at(), { wood: 2 });
    const out = run(state, { type: 'craft', recipeId: 'fence' });
    expect(out.state.energy).toEqual(state.energy);
    expect(countOf(out.state.inventory, 'fence')).toBe(2);
  });

  it('a flag recipe changes the state and produces nothing', () => {
    const state = withItems(at(), { wood: 20, stone: 10, 'copper-ore': 5 });
    const out = run(state, { type: 'craft', recipeId: 'sprinkler' });
    expect(out.state.flags.sprinkler).toBe(true);
    expect(out.state.inventory.stacks).toEqual([]);
  });

  it('a recipe above your skill level is refused and nothing is used up', () => {
    const state = withItems(at({ skills: { ...emptySkills(), farming: 0 } }), { wood: 10, stone: 5 });
    const out = run(state, { type: 'craft', recipeId: 'sprinkler' });
    expect(out.messages.join('\n')).toContain('還不會做');
    expect(out.state.flags.sprinkler).toBeUndefined();
    expect(countOf(out.state.inventory, 'wood')).toBe(10);
  });

  it('is refused unless the player stands in front of the workbench', () => {
    const state = withItems(at({ player: { x: 4, y: 16, facing: 'left' } }), { wood: 2 });
    const out = run(state, { type: 'craft', recipeId: 'fence' });
    expect(out.messages).toContain('要站在工作台前面才能合成');
    expect(countOf(out.state.inventory, 'wood')).toBe(2);
  });

  it('names the missing material and uses nothing', () => {
    const state = withItems(at(), { wood: 1 });
    const out = run(state, { type: 'craft', recipeId: 'fence' });
    expect(out.messages.join('\n')).toContain('材料不夠');
    expect(out.messages.join('\n')).toContain('木材 × 1');
    expect(countOf(out.state.inventory, 'wood')).toBe(1);
  });

  it('a flag recipe can be made only once', () => {
    const state = withItems(at({ flags: { sprinkler: true } }), { wood: 10, stone: 5 });
    const out = run(state, { type: 'craft', recipeId: 'sprinkler' });
    expect(out.messages.join('\n')).toContain('已經有了');
    expect(countOf(out.state.inventory, 'wood')).toBe(10);
  });

  it('a chest adds six bag slots, and three chests is the most', () => {
    const base = at().inventory.capacity;
    let state = withItems(at(), { wood: 60 });
    for (let i = 0; i < 3; i += 1) state = run(state, { type: 'craft', recipeId: 'chest' }).state;
    expect(state.inventory.capacity).toBe(base + 18);
    const fourth = run(state, { type: 'craft', recipeId: 'chest' });
    expect(fourth.messages.join('\n')).toContain('木箱已經放滿');
    expect(fourth.state.inventory.capacity).toBe(base + 18);
  });

  it('stone, hay and wood are materials, so none of them can be shipped', () => {
    for (const id of ['stone', 'hay', 'wood']) {
      expect(index.item(id).sellPrice, id).toBeUndefined();
    }
  });
});

describe('a sprinkler (灑水器)', () => {
  it('waters every planted field overnight, even on a sunny day', () => {
    const bed = { x: 4, y: 8, facing: 'up' as const };
    const planted = { watered: false, crop: { cropId: 'moon-bean', growthDays: 0 }, dryDays: 0 };
    const withSprinkler = run(at({ flags: { sprinkler: true }, weather: 'sunny', plots: { 'farm|5,3': planted }, player: bed }), { type: 'interact' });
    expect(withSprinkler.events).toContainEqual({ type: 'slept' });
    expect(withSprinkler.state.plots['farm|5,3']?.dryDays).toBe(0);
    expect(withSprinkler.state.plots['farm|5,3']?.crop?.growthDays).toBe(1);

    const without = run(at({ weather: 'sunny', plots: { 'farm|5,3': planted }, player: bed }), { type: 'interact' });
    expect(without.state.plots['farm|5,3']?.dryDays).toBe(1);
    expect(without.state.plots['farm|5,3']?.crop?.growthDays).toBe(0);
  });
});
