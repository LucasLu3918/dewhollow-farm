import { describe, expect, it } from 'vitest';
import type { ContentPack } from '../../domain/content';
import { shippedPack } from '../../../tests/sim/shipped-content';
import { achievementProblems, collectionProblems } from './collection-content';

/**
 * M5d 的圖鑑與成就內容檢查：真實內容沒有問題；故意弄壞一處，檢查要指出來。
 */

describe('圖鑑與成就的真實內容', () => {
  it('shipped collection and achievements have no problems', () => {
    expect(collectionProblems(shippedPack)).toEqual([]);
    expect(achievementProblems(shippedPack)).toEqual([]);
  });

  it('seven dex categories: fish, crops, minerals, wild vegetables and flowers, dishes, processed goods, animals', () => {
    expect((shippedPack.collection ?? []).map((c) => c.id)).toEqual(['fish', 'crops', 'minerals', 'forage', 'dishes', 'processed', 'animals']);
  });

  it('has exactly twenty spring and summer achievements, each given once', () => {
    const list = shippedPack.achievements ?? [];
    expect(list).toHaveLength(20);
    expect(new Set(list.map((a) => a.id)).size).toBe(20);
    for (const a of list) {
      expect(a.phase === 'spring' || a.phase === 'summer', a.id).toBe(true);
      expect(a.playMinutes, a.id).toBeGreaterThan(0);
      expect(a.description.length, a.id).toBeGreaterThan(0);
    }
  });

  it('every achievement reward is gold or a title, and a title is never empty', () => {
    for (const a of shippedPack.achievements ?? []) {
      expect(a.reward.gold ?? 0, a.id).toBeGreaterThanOrEqual(0);
      if (a.reward.title !== undefined) expect(a.reward.title.length, a.id).toBeGreaterThan(0);
    }
  });
});

function withCollection(pack: ContentPack, collection: NonNullable<ContentPack['collection']>): ContentPack {
  return { ...pack, collection };
}

function withAchievements(pack: ContentPack, achievements: NonNullable<ContentPack['achievements']>): ContentPack {
  return { ...pack, achievements };
}

describe('圖鑑與成就的檢查會抓到錯誤', () => {
  const fish = () => shippedPack.collection!.find((c) => c.id === 'fish')!;
  const first = () => shippedPack.achievements![0]!;

  it('a dex entry that is not a real item is reported', () => {
    const broken = { ...fish(), entries: [...fish().entries, 'fish.nothing'] };
    const list = (shippedPack.collection ?? []).map((c) => (c.id === 'fish' ? broken : c));
    expect(collectionProblems(withCollection(shippedPack, list)).join('\n')).toContain('圖鑑 fish 的條目 fish.nothing 不存在');
  });

  it('a dex reward with an unknown decor item is reported', () => {
    const broken = { ...fish(), rewards: [{ percent: 25 as const, items: { 'no-such-item': 1 } }] };
    const list = (shippedPack.collection ?? []).map((c) => (c.id === 'fish' ? broken : c));
    expect(collectionProblems(withCollection(shippedPack, list)).join('\n')).toContain('圖鑑 fish 的獎勵物品 no-such-item 不存在');
  });

  it('a dex reward at a percent that is not 25/50/75/100 is reported', () => {
    const broken = { ...fish(), rewards: [{ percent: 30 as never, gold: 10 }] };
    const list = (shippedPack.collection ?? []).map((c) => (c.id === 'fish' ? broken : c));
    expect(collectionProblems(withCollection(shippedPack, list)).join('\n')).toContain('圖鑑 fish 的獎勵門檻 30 不是 25／50／75／100');
  });

  it('an achievement that waits on a flag nothing sets is reported', () => {
    const broken = { ...first(), condition: { type: 'flag' as const, flag: 'never:set' } };
    const list = (shippedPack.achievements ?? []).map((a) => (a.id === first().id ? broken : a));
    expect(achievementProblems(withAchievements(shippedPack, list)).join('\n')).toContain('成就 first-harvest 的旗標 never:set 沒有任何來源');
  });

  it('an achievement that counts an unknown event is reported', () => {
    const broken = { ...first(), condition: { type: 'counter' as const, key: 'teleports', min: 1 } };
    const list = (shippedPack.achievements ?? []).map((a) => (a.id === first().id ? broken : a));
    expect(achievementProblems(withAchievements(shippedPack, list)).join('\n')).toContain('成就 first-harvest 的計數 teleports 不是已知的事件');
  });

  it('an achievement that asks for more than the category holds is reported', () => {
    const broken = { ...first(), condition: { type: 'dex' as const, category: 'fish', count: 99 } };
    const list = (shippedPack.achievements ?? []).map((a) => (a.id === first().id ? broken : a));
    expect(achievementProblems(withAchievements(shippedPack, list)).join('\n')).toContain('成就 first-harvest 要的圖鑑條目 99 超過 fish 的 8 種');
  });
});
