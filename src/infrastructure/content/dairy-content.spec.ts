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
import pasture from '../../../content/maps/pasture.json';
import cowbarn from '../../../content/maps/cowbarn.json';
import assets from '../../../content/assets.json';
import rigs from '../../../content/rigs.json';
import companions from '../../../content/companions.json';
import tools from '../../../content/tools.json';
import sounds from '../../../content/sounds.json';
import music from '../../../content/music.json';
import terrain from '../../../content/terrain.json';
import weather from '../../../content/weather.json';
import items from '../../../content/items.json';
import shops from '../../../content/shops.json';
import fish from '../../../content/fish.json';
import animals from '../../../content/animals.json';
import recipes from '../../../content/recipes.json';
import processing from '../../../content/processing.json';
import crafting from '../../../content/crafting.json';
import talents from '../../../content/talents.json';
import mine from '../../../content/mine.json';
import { loadContent } from './load-content';
import type { ContentPack, MapDef } from '../../domain/content';
import { slotsOf } from '../../domain/animals';
import plaza from '../../../content/maps/plaza.json';
import schedules from '../../../content/schedules.json';
import events from '../../../content/events.json';
import friendship from '../../../content/friendship.json';
import quests from '../../../content/quests.json';
import letters from '../../../content/letters.json';

/** M4c 的內容：牛、牛舍、牧草地、乳製品。內容錯誤由 loadContent 一次列出。 */
const { pack } = loadContent({
  crops,
  npcs,
  schedules,
  events,
  friendship,
    quests,
    letters,
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

const mapOf = (pk: ContentPack, id: string): MapDef => {
  const found = pk.maps.find((m) => m.id === id);
  if (!found) throw new Error(`找不到地圖 ${id}`);
  return found;
};

describe('cows and the cow barn (content)', () => {
  it('a cow gives milk and lays no eggs; a chicken still lays eggs', () => {
    const cow = pack.animals.find((a) => a.id === 'cow');
    const chicken = pack.animals.find((a) => a.id === 'chicken');
    expect(cow?.milk).toEqual({ item: 'milk', goodChance: 0.3, fineChance: 0.1 });
    expect(cow?.eggItem).toBeUndefined();
    expect(chicken?.eggItem).toBe('egg');
  });

  it('the cow barn is for cows, with two seats; the coop is for chickens, with three', () => {
    expect(cowbarn.flock).toBe('cows');
    expect(coop.flock).toBe('animals');
    expect(slotsOf(mapOf(pack, 'cowbarn'))).toHaveLength(2);
    expect(slotsOf(mapOf(pack, 'coop'))).toHaveLength(3);
  });

  it('the general store sells a chicken for 300, a cow for 1200 and the barn remodel for 5000', () => {
    const general = pack.shops.find((s) => s.id === 'general');
    const price = (itemId: string) => general?.stock.find((l) => l.itemId === itemId)?.price;
    expect(price('animal.chicken')).toBe(300);
    expect(price('animal.cow')).toBe(1200);
    expect(price('building.cowbarn')).toBe(5000);
  });

  it('the pasture gate opens on spring day 15 (to be swapped for a story flag later), the barn door needs the remodel', () => {
    const gate = mapOf(pack, 'farm').legend['G'];
    expect(gate?.requires).toMatchObject({ type: 'date', season: 'spring', day: 15 });
    expect(gate?.requires?.hint).toBeTruthy();
    const barnDoor = mapOf(pack, 'pasture').legend['B'];
    expect(barnDoor?.requires).toMatchObject({ type: 'flag', flag: 'cowbarn' });
    expect(barnDoor?.to).toBe('cowbarn');
  });

  it('the pasture has grass tufts to cut for hay, and a fence around it', () => {
    const tuftCount = mapOf(pack, 'pasture').rows.join('').split('').filter((ch) => mapOf(pack, 'pasture').legend[ch]?.kind === 'tuft').length;
    expect(tuftCount).toBeGreaterThanOrEqual(10);
    expect(Object.values(mapOf(pack, 'pasture').legend).some((t) => t.kind === 'fence')).toBe(true);
  });
});

describe('dairy products (content)', () => {
  it('milk is an animal product that sells', () => {
    const milk = pack.items.find((i) => i.id === 'milk');
    expect(milk?.kind).toBe('animal');
    expect(milk?.sellPrice).toBe(60);
  });

  it('cheese and butter are processed from milk, and each sells for more than the milk it uses', () => {
    const cheese = pack.processing.find((r) => r.output === 'cheese');
    const butter = pack.processing.find((r) => r.output === 'butter');
    expect(cheese?.ingredients).toEqual({ milk: 2 });
    expect(butter?.ingredients).toEqual({ milk: 1 });
    const sell = (id: string) => pack.items.find((i) => i.id === id)?.sellPrice ?? 0;
    expect(sell('cheese')).toBeGreaterThan(2 * sell('milk'));
    expect(sell('butter')).toBeGreaterThan(sell('milk'));
    expect(cheese?.level).toBeGreaterThan(0);
  });
});
