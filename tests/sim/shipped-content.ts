import crops from '../../content/crops.json';
import mine from '../../content/mine.json';
import npcs from '../../content/npcs.json';
import schedules from '../../content/schedules.json';
import events from '../../content/events.json';
import friendship from '../../content/friendship.json';
import quests from '../../content/quests.json';
import letters from '../../content/letters.json';
import festivals from '../../content/festivals.json';
import mainQuest from '../../content/main-quest.json';
import repairs from '../../content/repairs.json';
import randomEvents from '../../content/events-random.json';
import collection from '../../content/collection.json';
import achievements from '../../content/achievements.json';
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
import plaza from '../../content/maps/plaza.json';
import forest from '../../content/maps/forest.json';
import lake from '../../content/maps/lake.json';
import house from '../../content/maps/house.json';
import mineEntrance from '../../content/maps/mine-entrance.json';
import coop from '../../content/maps/coop.json';
import pasture from '../../content/maps/pasture.json';
import cowbarn from '../../content/maps/cowbarn.json';
import { loadContent } from '../../src/infrastructure/content/load-content';
import { createContentIndex } from '../../src/application/content-index';

/** 模擬與試玩用：與遊戲實際載入的內容完全相同（不含開發用的覆寫）。 */
const { pack } = loadContent({
  crops,
  npcs,
  schedules,
  events,
  friendship,
    quests,
    letters,
  festivals,
  mainQuest,
  repairs,
  randomEvents,
  collection,
  achievements,
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
});

export const shippedPack = pack;
export const shippedIndex = createContentIndex(pack);
