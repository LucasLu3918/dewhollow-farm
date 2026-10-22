import { describe, expect, it } from 'vitest';
import crops from '../../../content/crops.json';
import mine from '../../../content/mine.json';
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
import pasture from '../../../content/maps/pasture.json';
import cowbarn from '../../../content/maps/cowbarn.json';
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
import talents from '../../../content/talents.json';
import sounds from '../../../content/sounds.json';
import music from '../../../content/music.json';
import terrain from '../../../content/terrain.json';
import { SaveFormatError } from './save-errors';
import { parseSaveRecord } from './save-schema';
import plaza from '../../../content/maps/plaza.json';
import schedules from '../../../content/schedules.json';
import events from '../../../content/events.json';
import friendship from '../../../content/friendship.json';
import quests from '../../../content/quests.json';
import letters from '../../../content/letters.json';
import festivals from '../../../content/festivals.json';
import mainQuest from '../../../content/main-quest.json';
import repairs from '../../../content/repairs.json';
import randomEvents from '../../../content/events-random.json';

const { pack } = loadContent({ crops, npcs, schedules, events, friendship, quests, letters, festivals, mainQuest, repairs, randomEvents, maps: [farm, village, plaza, forest, lake, house, mineEntrance, coop, pasture, cowbarn], start, tuning, assets, rigs, companions, tools, sounds, music, terrain, weather, items, shops, fish, animals, recipes, processing, crafting, talents, mine });
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

  it('keeps every kind of world change the game can make, including the cut grass', () => {
    const state = createNewGame(pack, 1);
    const changes = { 'mine,1,1': 'mined', 'mine,2,2': 'cleared', 'forest,3,3': 'cut', 'forest,4,4': 'chopped', 'forest,5,5': 'picked' };
    const parsed = parseSaveRecord(record({ ...state, worldChanges: changes }), context);
    expect(parsed.state.worldChanges).toEqual(changes);
  });

  it('keeps a checkpoint deeper than floor 40 (the mine has no bottom), and rejects a checkpoint below floor 1', () => {
    const state = createNewGame(pack, 1);
    expect(parseSaveRecord(record({ ...state, mineCheckpoint: 45 }), context).state.mineCheckpoint).toBe(45);
    expect(() => parseSaveRecord(record({ ...state, mineCheckpoint: 0 }), context)).toThrow(SaveFormatError);
  });

  it('keeps the talent chosen for each skill and the sickle tier', () => {
    const state = createNewGame(pack, 1);
    const parsed = parseSaveRecord(record({ ...state, talents: { farming: 'market-sense' }, toolTiers: { ...state.toolTiers, sickle: 2 } }), context);
    expect(parsed.state.talents).toEqual({ farming: 'market-sense' });
    expect(parsed.state.toolTiers.sickle).toBe(2);
  });

  it('rejects a sickle tier outside the four tiers', () => {
    const state = createNewGame(pack, 1);
    expect(() => parseSaveRecord(record({ ...state, toolTiers: { ...state.toolTiers, sickle: 4 } }), context)).toThrow(SaveFormatError);
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
    expect(state.schemaVersion).toBe(20);
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
