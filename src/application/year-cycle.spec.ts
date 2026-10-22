import { loadContent, type RawContentFiles } from '../infrastructure/content/load-content';
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
import village from '../../content/maps/village.json';
import forest from '../../content/maps/forest.json';
import lake from '../../content/maps/lake.json';
import house from '../../content/maps/house.json';
import mineEntrance from '../../content/maps/mine-entrance.json';
import coop from '../../content/maps/coop.json';
import pasture from '../../content/maps/pasture.json';
import cowbarn from '../../content/maps/cowbarn.json';
import { describe, expect, it } from 'vitest';
import { createNewGame, type GameState } from '../domain/game-state';
import { WEATHERS } from '../domain/weather';
import { SEASONS } from '../domain/calendar';
import { plotKey } from '../domain/farm';
import { executeCommand } from './game-commands';
import { createContentIndex } from './content-index';
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

/** 一整年（80 天）連續遊玩：每天種植當季作物、睡醒，不應出現任何錯誤或不合規則的狀態。 */
const raw: RawContentFiles = {
  crops,
  npcs,
  schedules,
  events,
  friendship,
    quests,
    letters,
    festivals,
    mainQuest, repairs, randomEvents,
  maps: [farm, village, plaza, forest, lake, house, mineEntrance, coop, pasture, cowbarn],
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
};

const FIELD = plotKey(4, 4);
const BED_SIDE = { x: 2, y: 1, facing: 'left' as const };

describe('a full year of play', () => {
  it('runs 80 days through every season without errors or impossible states', () => {
    const { pack } = loadContent(raw);
    const index = createContentIndex(pack);
    let state: GameState = { ...createNewGame(pack, 20260101), player: BED_SIDE, mapId: 'house' };
    const seen = new Set<string>();

    for (let day = 1; day <= 80; day += 1) {
      seen.add(`${state.calendar.season}`);
      // 每天：如果田是空的，就種下當季能種的第一種作物（種子用完時直接放進去，只測規則不測背包）。
      const season = state.calendar.season;
      const plantable = pack.crops.find((c) => c.seasons.includes(season));
      if (plantable && !state.plots[FIELD]?.crop) {
        state = { ...state, plots: { ...state.plots, [FIELD]: { watered: false, crop: { cropId: plantable.id, growthDays: 0 }, dryDays: 0 } } };
      }
      const out = executeCommand(state, { type: 'interact' }, index);
      state = out.state;
      expect(state.calendar.minuteOfDay).toBe(pack.tuning.time.wakeMinute);
      expect(state.energy.current).toBe(state.energy.max);
      expect(WEATHERS).toContain(state.weather);
      expect(WEATHERS).toContain(state.forecast);
      if (state.plots[FIELD]?.crop) {
        expect(index.crop(state.plots[FIELD].crop?.cropId ?? '').seasons).toContain(state.calendar.season);
      }
      expect(state.calendar.day).toBeGreaterThanOrEqual(1);
      expect(state.calendar.day).toBeLessThanOrEqual(pack.tuning.time.daysPerSeason);
      expect(out.events.map((e) => e.type)).toContain('slept');
    }

    expect(state.calendar).toMatchObject({ year: 2, season: 'spring', day: 1 });
    expect([...seen].sort()).toEqual([...SEASONS].sort());
  });
});
