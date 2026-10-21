import { describe, expect, it } from 'vitest';
import crops from '../../../content/crops.json';
import npcs from '../../../content/npcs.json';
import start from '../../../content/start.json';
import tuning from '../../../content/tuning.json';
import farm from '../../../content/maps/farm.json';
import village from '../../../content/maps/village.json';
import forest from '../../../content/maps/forest.json';
import lake from '../../../content/maps/lake.json';
import house from '../../../content/maps/house.json';
import mineEntrance from '../../../content/maps/mine-entrance.json';
import coop from '../../../content/maps/coop.json';
import { createNewGame } from '../../domain/game-state';
import { loadContent } from '../content/load-content';
import assets from '../../../content/assets.json';
import rigs from '../../../content/rigs.json';
import companions from '../../../content/companions.json';
import tools from '../../../content/tools.json';
import weather from '../../../content/weather.json';
import items from '../../../content/items.json';
import shops from '../../../content/shops.json';
import fish from '../../../content/fish.json';
import animals from '../../../content/animals.json';
import recipes from '../../../content/recipes.json';
import processing from '../../../content/processing.json';
import crafting from '../../../content/crafting.json';
import sounds from '../../../content/sounds.json';
import terrain from '../../../content/terrain.json';
import { SaveFormatError } from './save-errors';
import { parseSaveRecord } from './save-schema';

const { pack } = loadContent({ crops, npcs, maps: [farm, village, forest, lake, house, mineEntrance, coop], start, tuning, assets, rigs, companions, tools, sounds, terrain, weather, items, shops, fish, animals, recipes, processing, crafting });
const context = { inventoryCapacity: pack.tuning.inventory.capacity, daysPerSeason: pack.tuning.time.daysPerSeason, wakeMinute: pack.tuning.time.wakeMinute };

function record(state: unknown) {
  return { slot: 'slot-1', savedAt: '2026-10-21T00:00:00.000Z', state };
}

describe('save schema', () => {
  it('accepts a new game state and returns it unchanged', () => {
    const state = createNewGame(pack, 1);
    expect(parseSaveRecord(record(state), context).state).toEqual(state);
  });

  it('rejects an unknown tool with the field path', () => {
    const state = { ...createNewGame(pack, 1), tool: 'bow' };
    try {
      parseSaveRecord(record(state), context);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(SaveFormatError);
      expect((error as Error).message).toContain('存檔內容格式錯誤於 tool');
    }
  });

  it('rejects a negative gold amount', () => {
    expect(() => parseSaveRecord(record({ ...createNewGame(pack, 1), gold: -1 }), context)).toThrow(SaveFormatError);
  });

  it('rejects a record without a slot', () => {
    expect(() => parseSaveRecord({ savedAt: 'x', state: createNewGame(pack, 1) }, context)).toThrow(SaveFormatError);
  });

  it('rejects an inventory stack with an unknown quality', () => {
    const state = createNewGame(pack, 1);
    const broken = {
      ...state,
      inventory: { ...state.inventory, stacks: [{ itemId: 'seed.moon-bean', quality: 'shiny', count: 1 }] },
    };
    expect(() => parseSaveRecord(record(broken), context)).toThrow('inventory.stacks.0.quality');
  });

  it('rejects an inventory with more stacks than it has slots', () => {
    const state = createNewGame(pack, 1);
    const stack = { itemId: 'seed.moon-bean', quality: 'normal', count: 1 };
    const broken = { ...state, inventory: { capacity: 1, stacks: [stack, stack] } };
    expect(() => parseSaveRecord(record(broken), context)).toThrow(SaveFormatError);
  });
});

describe('save schema with an old save', () => {
  const v1 = {
    schemaVersion: 1,
    calendar: { year: 1, season: 'spring', day: 2, minuteOfDay: 360 },
    energy: { current: 100, max: 100 },
    gold: 100,
    mapId: 'farm',
    player: { x: 7, y: 9, facing: 'down' },
    plots: {},
    bag: { seeds: { 'moon-bean': 2 }, crops: {} },
    shipBox: { items: {} },
    flags: {},
    tool: 'hoe',
    selectedSeed: 'moon-bean',
    rng: 7,
  };

  it('loads a v1 save as a current-version state', () => {
    const { state } = parseSaveRecord(record(v1), context);
    expect(state.schemaVersion).toBe(11);
    expect(state.inventory.stacks).toEqual([{ itemId: 'seed.moon-bean', quality: 'normal', count: 2 }]);
    expect(state.playtimeSeconds).toBe(0);
    expect(state.calendar.day).toBe(2);
  });

  it('keeps the slot and save time of the record', () => {
    const parsed = parseSaveRecord(record(v1), context);
    expect(parsed.slot).toBe('slot-1');
    expect(parsed.savedAt).toBe('2026-10-21T00:00:00.000Z');
  });
});
