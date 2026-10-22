import { describe, expect, it } from 'vitest';
import type { ContentPack } from '../../domain/content';
import { sellPriceOf } from '../../domain/pricing';
import { shippedPack } from '../../../tests/sim/shipped-content';

/**
 * M6 的秋冬內容（docs/ROADMAP.md M6）：作物與季節、雜貨店的季節進貨、溫室、豐穗祭、暖燈節、主線第 4–5 章、
 * 圖鑑的作物同步。秋冬的時數另記（見最後一個測試），不併入春夏的 120 分鐘。
 */

const AUTUMN_CROPS = ['golden-rice', 'bell-pumpkin', 'maple-berry'];
const WINTER_CROPS = ['snow-radish', 'frost-mushroom', 'ember-onion'];

function crop(pack: ContentPack, id: string) {
  const found = pack.crops.find((c) => c.id === id);
  if (!found) throw new Error(`沒有作物 ${id}`);
  return found;
}

function general(pack: ContentPack) {
  const shop = pack.shops.find((s) => s.id === 'general');
  if (!shop) throw new Error('沒有雜貨店');
  return shop;
}

describe('秋冬作物', () => {
  it('秋季與冬季各有 3 種新作物，只在自己的季節種（溫室之外）', () => {
    for (const id of AUTUMN_CROPS) expect(crop(shippedPack, id).seasons, id).toEqual(['autumn']);
    for (const id of WINTER_CROPS) expect(crop(shippedPack, id).seasons, id).toEqual(['winter']);
  });

  it('每種秋冬作物都有種子價、成熟天數在 1 到 13 天之間，售價為正', () => {
    for (const id of [...AUTUMN_CROPS, ...WINTER_CROPS]) {
      const def = crop(shippedPack, id);
      expect(def.seedPrice, id).toBeGreaterThan(0);
      expect(def.growthDays, id).toBeGreaterThanOrEqual(1);
      expect(def.growthDays, id).toBeLessThanOrEqual(13);
      expect(sellPriceOf(def.seedPrice, def.growthDays), id).toBeGreaterThan(0);
    }
  });

  it('雜貨店在秋季賣秋季的種子、冬季賣冬季的種子，並標明季節', () => {
    const shop = general(shippedPack);
    for (const id of AUTUMN_CROPS) {
      const line = shop.stock.find((s) => s.itemId === `seed.${id}`);
      expect(line?.seasons, id).toEqual(['autumn']);
    }
    for (const id of WINTER_CROPS) {
      const line = shop.stock.find((s) => s.itemId === `seed.${id}`);
      expect(line?.seasons, id).toEqual(['winter']);
    }
  });

  it('圖鑑的作物類別與作物清單同步（每種作物都是一條條目，沒有多也沒有少）', () => {
    const category = (shippedPack.collection ?? []).find((c) => c.id === 'crops');
    expect(category).toBeDefined();
    const expected = shippedPack.crops.map((c) => `crop.${c.id}`).sort();
    expect([...(category?.entries ?? [])].sort()).toEqual(expected);
    expect(expected).toHaveLength(12);
  });
});

describe('溫室', () => {
  it('雜貨店賣溫室改建，價格 9000 金，物品定義為建築', () => {
    const line = general(shippedPack).stock.find((s) => s.itemId === 'building.greenhouse');
    expect(line?.price).toBe(9000);
    const item = shippedPack.items.find((i) => i.id === 'building.greenhouse');
    expect(item?.kind).toBe('building');
  });

  it('農場上有溫室：溫室的田有 greenhouse 標記，入口需要 greenhouse 旗標', () => {
    const farm = shippedPack.maps.find((m) => m.id === 'farm');
    if (!farm) throw new Error('沒有農場');
    const greenhouseTiles = farm.rows.join('').split('').filter((ch) => farm.legend[ch]?.greenhouse === true);
    expect(greenhouseTiles.length).toBeGreaterThanOrEqual(15);
    const entrance = Object.values(farm.legend).find((t) => t.requires?.type === 'flag' && t.requires.flag === 'greenhouse');
    expect(entrance?.kind).toBe('door');
  });
});

describe('豐穗祭（秋 12，鎮廣場）', () => {
  const festival = () => (shippedPack.festivals ?? []).find((f) => f.id === 'harvest-feast');

  it('秋 12、鎮廣場、整天開放，有作物交換與收成比賽兩項活動', () => {
    const def = festival();
    expect(def).toBeDefined();
    expect(def?.season).toBe('autumn');
    expect(def?.day).toBe(12);
    expect(def?.mapId).toBe('plaza');
    expect(def?.fromMinute).toBe(0);
    expect(def?.swaps?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(def?.harvestContest).toBeDefined();
  });

  it('作物交換換到的是秋季作物的種子，給出的物品都存在；居民都在廣場上', () => {
    const def = festival();
    const names = new Set(shippedPack.npcs.map((n) => n.id));
    for (const swap of def?.swaps ?? []) {
      expect(names.has(swap.npcId), swap.npcId).toBe(true);
      expect(AUTUMN_CROPS.map((id) => `seed.${id}`)).toContain(swap.receive.itemId);
      expect(shippedPack.crops.some((c) => `crop.${c.id}` === swap.give.itemId)).toBe(true);
    }
  });

  it('收成比賽指定的作物是秋季作物，數量與獎勵為正', () => {
    const contest = festival()?.harvestContest;
    expect(AUTUMN_CROPS).toContain(contest?.cropId);
    expect(contest?.count).toBeGreaterThan(0);
    expect(contest?.gold).toBeGreaterThan(0);
  });
});

describe('暖燈節（冬 20，鎮廣場，夜間）', () => {
  const festival = () => (shippedPack.festivals ?? []).find((f) => f.id === 'warm-lamp');

  it('冬 20、鎮廣場、18:00 起開放', () => {
    const def = festival();
    expect(def).toBeDefined();
    expect(def?.season).toBe('winter');
    expect(def?.day).toBe(20);
    expect(def?.mapId).toBe('plaza');
    expect(def?.fromMinute).toBe(1080);
  });

  it('點燈的數量與廣場上的燈一樣多，獎勵為正，全部點亮時設定 lantern:all 旗標', () => {
    const def = festival();
    const plaza = shippedPack.maps.find((m) => m.id === 'plaza');
    if (!plaza) throw new Error('沒有廣場');
    const lamps = plaza.rows.join('').split('').filter((ch) => plaza.legend[ch]?.festival === 'lantern');
    expect(def?.lanterns?.count).toBe(lamps.length);
    expect(def?.lanterns?.count).toBeGreaterThan(0);
    expect(def?.lanterns?.gold).toBeGreaterThan(0);
    expect(def?.lanterns?.flag).toBe('lantern:all');
  });

  it('交換禮物的居民在廣場上（傍晚）、每年次數有限、回禮的物品存在', () => {
    const gift = festival()?.giftExchange;
    const names = new Set(shippedPack.npcs.map((n) => n.id));
    expect(gift?.npcIds.length).toBeGreaterThan(0);
    for (const id of gift?.npcIds ?? []) expect(names.has(id), id).toBe(true);
    expect(gift?.perYear).toBeGreaterThan(0);
    expect(gift?.receive.itemId.startsWith('seed.')).toBe(true);
  });
});

describe('主線第 4、5 章', () => {
  const chapters = () => [...(shippedPack.chapters ?? [])].sort((a, b) => a.number - b.number);

  it('第 4 章是秋季、第 5 章是冬季，接在第 3 章後面', () => {
    const list = chapters();
    expect(list.map((c) => c.number)).toEqual([1, 2, 3, 4, 5]);
    expect(list[3]?.phase).toBe('autumn');
    expect(list[4]?.phase).toBe('winter');
  });

  it('第 4 章的步驟是豐穗祭的參加與溫室旗標；第 5 章是暖燈節的參加與全部點亮', () => {
    const [, , , ch4, ch5] = chapters();
    expect(ch4?.steps).toEqual([
      { hint: expect.any(String), flag: 'attended:harvest-feast' },
      { hint: expect.any(String), flag: 'greenhouse' },
    ]);
    expect(ch5?.steps).toEqual([
      { hint: expect.any(String), flag: 'attended:warm-lamp' },
      { hint: expect.any(String), flag: 'lantern:all' },
    ]);
  });

  it('章節獎勵是場景旗標（或金幣與種子），不是沒有來源的旗標', () => {
    const [, , , ch4, ch5] = chapters();
    expect(ch4?.reward.flag).toBe('scene:greenhouse-open');
    expect(ch5?.reward.flag).toBe('scene:lamplit-plaza');
    expect(ch4?.reward.gold).toBeGreaterThan(0);
  });
});

describe('秋冬的時數（另記，不併入春夏）', () => {
  it('秋冬的內容單位都有正的 playMinutes，合計可以記錄', () => {
    const units: { label: string; minutes: number; season: string }[] = [];
    for (const f of shippedPack.festivals ?? []) if (f.season === 'autumn' || f.season === 'winter') units.push({ label: f.id, minutes: f.playMinutes, season: f.season });
    for (const c of shippedPack.chapters ?? []) if (c.phase === 'autumn' || c.phase === 'winter') units.push({ label: c.id, minutes: c.playMinutes, season: c.phase });
    expect(units.map((u) => u.label).sort()).toEqual(['autumn-greenhouse', 'harvest-feast', 'warm-lamp', 'winter-lamps']);
    for (const unit of units) expect(unit.minutes, unit.label).toBeGreaterThan(0);
    const total = units.reduce((sum, unit) => sum + unit.minutes, 0);
    expect(total).toBeGreaterThan(0);
  });
});
