import { describe, expect, it } from 'vitest';
import type { ContentPack, MapDef } from '../../domain/content';
import { isWalkable, neighbor, tileAt } from '../../domain/world';
import { shippedPack } from '../../../tests/sim/shipped-content';
import { onSale } from '../../domain/shop-stock';

/**
 * 羊與布、小屋擴建、商店季節限定的內容檢查（真實內容）：價格的層次、座位、配方、圖鑑與動線。
 */

function shop(pack: ContentPack, id: string) {
  const found = pack.shops.find((s) => s.id === id);
  if (!found) throw new Error(`沒有商店 ${id}`);
  return found;
}

function mapOf(pack: ContentPack, id: string): MapDef {
  const found = pack.maps.find((m) => m.id === id);
  if (!found) throw new Error(`沒有地圖 ${id}`);
  return found;
}

/** 從出生點出發，能走到的格子（只在本地圖內；門與樓梯不算走得過去）。 */
function reachableFrom(map: MapDef): Set<string> {
  const start = map.spawn;
  const seen = new Set<string>([`${start.x},${start.y}`]);
  const queue = [start];
  while (queue.length > 0) {
    const here = queue.shift();
    if (!here) break;
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      const next = neighbor(here, dir);
      const key = `${next.x},${next.y}`;
      if (seen.has(key)) continue;
      const tile = tileAt(map, next.x, next.y);
      if (!tile || tile.to !== undefined || !isWalkable(tile.kind)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return seen;
}

/** 能站到某個格子旁邊（面向它）的玩家，也就是那個格子能互動。 */
function canUse(map: MapDef, reached: Set<string>, x: number, y: number): boolean {
  return (['up', 'down', 'left', 'right'] as const).some((dir) => {
    const side = neighbor({ x, y }, dir);
    return reached.has(`${side.x},${side.y}`);
  });
}

function tilesOf(map: MapDef, pred: (kind: string, notice?: string) => boolean): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = tileAt(map, x, y);
      if (tile && pred(tile.kind, tile.notice)) out.push({ x, y });
    }
  }
  return out;
}

describe('羊：價格與產物', () => {
  const sheep = shippedPack.animals.find((a) => a.id === 'sheep');

  it('the sheep gives wool every 3 days and is neither a layer nor a milker', () => {
    expect(sheep?.wool).toMatchObject({ item: 'wool', everyDays: 3 });
    expect(sheep?.milk).toBeUndefined();
    expect(sheep?.eggItem).toBeUndefined();
  });

  it('the sheep costs less than the cow (1200) and is on the general store shelf', () => {
    const price = shop(shippedPack, 'general').stock.find((l) => l.itemId === 'animal.sheep')?.price ?? 0;
    expect(price).toBe(600);
    expect(price).toBeLessThan(1200);
  });

  it('the wool is an animal product that sells, and the cloth made from it sells for more than its wool', () => {
    const wool = shippedPack.items.find((i) => i.id === 'wool');
    const cloth = shippedPack.items.find((i) => i.id === 'cloth');
    expect(wool?.kind).toBe('animal');
    expect(wool?.sellPrice).toBe(40);
    expect(cloth?.kind).toBe('processed');
    expect(cloth?.sellPrice).toBe(110);
    expect(cloth?.sellPrice ?? 0).toBeGreaterThan(2 * (wool?.sellPrice ?? 0));
  });

  it('the pasture houses the sheep: three seats on grass, and a trough to feed them', () => {
    const pasture = mapOf(shippedPack, 'pasture');
    expect(pasture.flock).toBe('sheep');
    const seats = tilesOf(pasture, (kind) => kind === 'grass').filter((p) => tileAt(pasture, p.x, p.y)?.slot);
    expect(seats).toHaveLength(3);
    expect(tilesOf(pasture, (kind) => kind === 'trough')).toHaveLength(1);
  });

  it('the sheep seats are reachable from the pasture gate', () => {
    const pasture = mapOf(shippedPack, 'pasture');
    const reached = reachableFrom(pasture);
    const seats = tilesOf(pasture, () => true).filter((p) => tileAt(pasture, p.x, p.y)?.slot);
    for (const seat of seats) expect(canUse(pasture, reached, seat.x, seat.y)).toBe(true);
  });

  it('the cow barn still has two seats and the cows still live there', () => {
    expect(mapOf(shippedPack, 'cowbarn').flock).toBe('cows');
  });
});

describe('布與衣服：加工與合成', () => {
  it('weaving turns two wool into one cloth at the loom (the workshop), and needs no cooking level', () => {
    const recipe = shippedPack.processing.find((r) => r.id === 'weave-cloth');
    expect(recipe).toMatchObject({ output: 'cloth', days: 2, level: 0, ingredients: { wool: 2 } });
  });

  it('two cloth make the clothes at the workbench, after farming level 3', () => {
    const recipe = shippedPack.crafting.find((r) => r.id === 'clothes');
    expect(recipe?.ingredients).toEqual({ cloth: 2 });
    expect(recipe?.output).toEqual({ item: 'clothes', count: 1 });
    expect(recipe?.unlock).toEqual({ skill: 'farming', level: 3 });
    expect(recipe?.playMinutes).toBeGreaterThan(0);
  });

  it('the clothes are decoration: no sell price, so they stay in the bag', () => {
    expect(shippedPack.items.find((i) => i.id === 'clothes')?.kind).toBe('decor');
    expect(shippedPack.items.find((i) => i.id === 'clothes')?.sellPrice).toBeUndefined();
  });
});

describe('商店季節限定（shops.json 的 seasons）', () => {
  const general = shop(shippedPack, 'general');

  it('the sun-hat recipe is sold only in summer, and its crafting recipe is unlocked by buying it', () => {
    const line = general.stock.find((l) => l.itemId === 'recipe.sun-hat');
    expect(line?.seasons).toEqual(['summer']);
    expect(line?.price).toBe(180);
    const recipe = shippedPack.crafting.find((r) => r.id === 'sun-hat');
    expect(recipe?.unlock).toEqual({ flag: 'recipe:sun-hat' });
    expect(shippedPack.items.find((i) => i.id === 'recipe.sun-hat')?.kind).toBe('recipe');
  });

  it('the autumn wood restock is sold only in autumn', () => {
    const line = general.stock.find((l) => l.itemId === 'wood');
    expect(line?.seasons).toEqual(['autumn']);
    expect(line?.price).toBe(12);
  });

  it('the seasonal lines come on and off the shelf with the season, and the seed prices are unchanged', () => {
    const summer = general.stock.filter((l) => onSale(l, 'summer')).map((l) => l.itemId);
    expect(summer).toContain('recipe.sun-hat');
    expect(summer).not.toContain('wood');
    const autumn = general.stock.filter((l) => onSale(l, 'autumn')).map((l) => l.itemId);
    expect(autumn).toContain('wood');
    expect(autumn).not.toContain('recipe.sun-hat');
    const price = (id: string) => general.stock.find((l) => l.itemId === id)?.price;
    expect([price('seed.dew-grass'), price('seed.moon-bean'), price('seed.sweet-radish'), price('hay')]).toEqual([10, 15, 25, 5]);
  });
});

describe('小屋擴建（金幣出口）', () => {
  const general = shop(shippedPack, 'general');

  it('the east room costs 3000 and the kitchen and workbench room costs 8000, both sold once at the general store', () => {
    expect(general.stock.find((l) => l.itemId === 'building.house-wing')?.price).toBe(3000);
    expect(general.stock.find((l) => l.itemId === 'building.house-full')?.price).toBe(8000);
  });

  it('both expansions are buildings (they never go into the bag)', () => {
    expect(shippedPack.items.find((i) => i.id === 'building.house-wing')?.kind).toBe('building');
    expect(shippedPack.items.find((i) => i.id === 'building.house-full')?.kind).toBe('building');
  });

  it('the farm door leads to the base house; the expanded layouts are their own maps', () => {
    const farm = mapOf(shippedPack, 'farm');
    const toHouse = tilesOf(farm, () => true).map((p) => tileAt(farm, p.x, p.y)).filter((t) => t?.to === 'house');
    expect(toHouse.length).toBeGreaterThan(0);
    expect(shippedPack.maps.map((m) => m.id)).toEqual(expect.arrayContaining(['house', 'house-wing', 'house-full']));
  });

  it('in every layout, the bed, the workbench, the mailbox, the loom and the kitchen can be reached', () => {
    for (const id of ['house', 'house-wing', 'house-full']) {
      const map = mapOf(shippedPack, id);
      const reached = reachableFrom(map);
      const targets = tilesOf(map, (kind, notice) => ['bed', 'workbench', 'workshop', 'kitchen'].includes(kind) || notice === 'mailbox');
      expect(targets.length, `${id} 的設施數`).toBeGreaterThanOrEqual(4);
      for (const t of targets) expect(canUse(map, reached, t.x, t.y), `${id} (${t.x},${t.y})`).toBe(true);
    }
  });

  it('the full layout has a second workbench and a second kitchen, and both can be used', () => {
    const map = mapOf(shippedPack, 'house-full');
    const reached = reachableFrom(map);
    const benches = tilesOf(map, (kind) => kind === 'workbench');
    const kitchens = tilesOf(map, (kind) => kind === 'kitchen');
    expect(benches.length).toBeGreaterThanOrEqual(2);
    expect(kitchens.length).toBeGreaterThanOrEqual(2);
    for (const t of [...benches, ...kitchens]) expect(canUse(map, reached, t.x, t.y)).toBe(true);
  });
});

describe('圖鑑：布、羊、衣服與服飾類別', () => {
  const categories = shippedPack.collection ?? [];

  it('the cloth is a processed-goods entry, and the sheep is an animal entry', () => {
    expect(categories.find((c) => c.id === 'processed')?.entries).toContain('cloth');
    expect(categories.find((c) => c.id === 'animals')?.entries).toContain('animal.sheep');
  });

  it('the clothes and the sun hat share a clothing category (summer, so it counts toward the spring-summer total)', () => {
    const clothing = categories.find((c) => c.id === 'clothing');
    expect(clothing?.entries).toEqual(['clothes', 'sun-hat']);
    expect(clothing?.phase).toBe('summer');
    expect(clothing?.playMinutes).toBeGreaterThan(0);
  });
});
