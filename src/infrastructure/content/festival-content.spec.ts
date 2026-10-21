import { describe, expect, it } from 'vitest';
import type { ContentPack } from '../../domain/content';
import { shippedPack } from '../../../tests/sim/shipped-content';
import { festivalProblems, storyProblems } from './festival-content';

/**
 * M5c 的內容檢查：節慶與主線的參照與數值。真實內容必須沒有問題；
 * 故意弄壞一處，檢查就要指出來（確認檢查真的在看）。
 */

describe('節慶與主線的真實內容', () => {
  it('shipped festivals and story have no problems', () => {
    expect(festivalProblems(shippedPack)).toEqual([]);
    expect(storyProblems(shippedPack)).toEqual([]);
  });

  it('has the two festivals on their dates, the night market opening at night', () => {
    const sprout = shippedPack.festivals?.find((f) => f.id === 'sprout');
    const market = shippedPack.festivals?.find((f) => f.id === 'starmarket');
    expect(sprout).toMatchObject({ season: 'spring', day: 12, mapId: 'plaza', fromMinute: 0 });
    expect(market).toMatchObject({ season: 'summer', day: 14, mapId: 'plaza', fromMinute: 1080, shop: 'night-market' });
  });

  it('has three story chapters in order, each with a reward and at least one step', () => {
    const chapters = shippedPack.chapters ?? [];
    expect(chapters.map((c) => c.number)).toEqual([1, 2, 3]);
    for (const chapter of chapters) {
      expect(chapter.steps.length).toBeGreaterThan(0);
      expect(chapter.reward.flag).toBe(`main:${chapter.number}`);
    }
  });

  it('chapter 3 waits on the lake bridge flag that M5d sets', () => {
    const third = shippedPack.chapters?.find((c) => c.number === 3);
    expect(third?.steps.some((s) => 'flag' in s && s.flag === 'lakeBridge')).toBe(true);
  });
});

function withFestivals(pack: ContentPack, festivals: NonNullable<ContentPack['festivals']>): ContentPack {
  return { ...pack, festivals };
}

describe('節慶內容的檢查會抓到錯誤', () => {
  const sprout = () => shippedPack.festivals!.find((f) => f.id === 'sprout')!;

  it('a swap with a resident who does not exist is reported', () => {
    const broken = { ...sprout(), swaps: [{ npcId: 'nobody', give: { itemId: 'crop.moon-bean', count: 1 }, receive: { itemId: 'seed.star-pepper', count: 1 } }] };
    expect(festivalProblems(withFestivals(shippedPack, [broken])).join('\n')).toContain('交換居民 nobody 不存在');
  });

  it('a festival whose map has no festival board is reported', () => {
    const broken = { ...sprout(), mapId: 'forest' };
    expect(festivalProblems(withFestivals(shippedPack, [broken])).join('\n')).toContain('沒有節慶告示');
  });

  it('a limited stall line without a limit is reported', () => {
    const shops = shippedPack.shops.map((s) => (s.id === 'night-market' ? { ...s, stock: s.stock.map((line) => ({ itemId: line.itemId, price: line.price })) } : s));
    expect(festivalProblems({ ...shippedPack, shops }).join('\n')).toContain('沒有數量限制');
  });

  it('a story step that names an unknown flag or quest is reported', () => {
    const chapters = (shippedPack.chapters ?? []).map((c) =>
      c.number === 1 ? { ...c, steps: [{ hint: '奇怪的步驟', flag: 'nowhere' }] } : c,
    );
    expect(storyProblems({ ...shippedPack, chapters }).join('\n')).toContain('沒有任何來源');
    const quests = (chapters.map((c) => c)).map((c) => (c.number === 2 ? { ...c, steps: [{ hint: 'x', quest: 'no-such-quest' }] } : c));
    expect(storyProblems({ ...shippedPack, chapters: quests }).join('\n')).toContain('委託 no-such-quest 不存在');
  });

  it('chapters out of order are reported', () => {
    const chapters = (shippedPack.chapters ?? []).map((c) => ({ ...c, number: c.number + 1 }));
    expect(storyProblems({ ...shippedPack, chapters }).join('\n')).toContain('章節號不連續');
  });
});
