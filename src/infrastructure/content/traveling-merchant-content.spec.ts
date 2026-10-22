import { describe, expect, it } from 'vitest';
import { shippedPack } from '../../../tests/sim/shipped-content';
import { keepsPathsOpen } from '../../domain/decor';
import { cropItems } from '../../domain/items';

/**
 * 旅行商人與裝飾／服飾的內容檢查：候選的物品要存在、價格要高於同一件在別處的售價、
 * 不能跟行商商隊（週五、六的隨機事件）送的東西重複；裝飾與衣服的分類要對；小屋的服務點要走得到。
 */
const pack = shippedPack;
const merchant = pack.merchant;
const itemIds = new Set([
  ...pack.items.map((i) => i.id),
  ...cropItems(pack.crops).map((i) => i.id),
  ...pack.fish.map((f) => `fish.${f.id}`),
]);
const itemOf = (id: string) => pack.items.find((i) => i.id === id) ?? cropItems(pack.crops).find((i) => i.id === id);

describe('旅行商人的內容', () => {
  it('有旅行商人的規則：週五、六來訪，名額 3 到 4 件，每週每件有上限', () => {
    expect(merchant).toBeDefined();
    if (!merchant) return;
    expect(merchant.weekdays).toEqual([4, 5]);
    expect(merchant.slots.min).toBeGreaterThanOrEqual(3);
    expect(merchant.slots.max).toBeLessThanOrEqual(4);
    expect(merchant.perItemWeekly).toBeGreaterThan(0);
    expect(merchant.playMinutes).toBeGreaterThan(0);
  });

  it('候選的物品都存在，而且只賣種子與裝飾（不賣建築、配方與動物）', () => {
    for (const candidate of merchant?.candidates ?? []) {
      expect(itemIds.has(candidate.itemId), candidate.itemId).toBe(true);
      const item = itemOf(candidate.itemId);
      expect(item?.kind === 'seed' || item?.kind === 'decor', candidate.itemId).toBe(true);
      expect(Number.isInteger(candidate.price) && candidate.price > 0, candidate.itemId).toBe(true);
    }
  });

  it('候選的價格高於雜貨店或夜市在別處的售價（稀有性）', () => {
    for (const candidate of merchant?.candidates ?? []) {
      const elsewhere = pack.shops
        .filter((shop) => !shop.rotating)
        .flatMap((shop) => shop.stock)
        .filter((line) => line.itemId === candidate.itemId)
        .map((line) => line.price);
      for (const price of elsewhere) expect(candidate.price, candidate.itemId).toBeGreaterThan(price);
    }
  });

  it('候選的季節限定只寫春夏秋冬，且至少在一個季節會出現（名額能滿）', () => {
    for (const candidate of merchant?.candidates ?? []) {
      if (candidate.seasons) expect(candidate.seasons.length).toBeGreaterThan(0);
    }
    const seasons = ['spring', 'summer', 'autumn', 'winter'] as const;
    for (const season of seasons) {
      const available = (merchant?.candidates ?? []).filter((c) => !c.seasons || c.seasons.includes(season));
      expect(available.length, season).toBeGreaterThanOrEqual(merchant?.slots.min ?? 3);
    }
  });

  it('不跟行商商隊重複：週五、六的隨機事件送的東西，不會出現在旅行商人的貨架上', () => {
    const caravanGifts = new Set(
      (pack.randomEvents?.events ?? [])
        .filter((e) => e.effect.type === 'grant' && e.weekdays.some((d) => merchant?.weekdays.includes(d)))
        .flatMap((e) => (e.effect.type === 'grant' ? Object.keys(e.effect.items) : [])),
    );
    expect(caravanGifts.has('bait')).toBe(true);
    for (const candidate of merchant?.candidates ?? []) expect(caravanGifts.has(candidate.itemId), candidate.itemId).toBe(false);
  });

  it('shops.json 有旅行商人的櫃檯（rotating，沒有固定貨架），鎮廣場有它的櫃檯', () => {
    const shop = pack.shops.find((s) => s.id === 'traveling-merchant');
    expect(shop?.rotating).toBe(true);
    expect(shop?.stock).toEqual([]);
    const plaza = pack.maps.find((m) => m.id === 'plaza');
    const counters = Object.values(plaza?.legend ?? {}).filter((t) => t.kind === 'shop' && t.shop === 'traveling-merchant');
    expect(counters.length).toBe(1);
  });
});

describe('裝飾與服飾的內容', () => {
  it('服飾（衣服、遮陽帽）是裝飾，而且穿得上；擺放用的裝飾是其餘的裝飾', () => {
    for (const id of ['clothes', 'sun-hat']) {
      const item = itemOf(id);
      expect(item?.kind).toBe('decor');
      expect(item?.wearable).toBe(true);
    }
    const placeable = pack.items.filter((i) => i.kind === 'decor' && !i.wearable).map((i) => i.id);
    expect(placeable).toEqual(expect.arrayContaining(['star-string', 'night-canvas', 'fountain']));
  });

  it('decor.json 的時數估計為正數', () => {
    expect(pack.decor?.placeMinutes).toBeGreaterThan(0);
    expect(pack.decor?.wearMinutes).toBeGreaterThan(0);
  });

  it('小屋的每一間（基本、東側一間、廚房與工作台）都有衣櫃，而且沒有擺東西時服務點都走得到', () => {
    for (const id of ['house', 'house-wing', 'house-full']) {
      const map = pack.maps.find((m) => m.id === id);
      expect(map, id).toBeDefined();
      if (!map) continue;
      expect(Object.values(map.legend).some((t) => t.wardrobe === true), id).toBe(true);
      expect(keepsPathsOpen(map, []), id).toBe(true);
    }
  });
});
