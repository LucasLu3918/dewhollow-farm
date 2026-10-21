import { describe, expect, it } from 'vitest';
import { advanceQuest, goalMet, goalProgress, unlockMet, type GoalContext, type QuestRecord, type UnlockContext } from './quests';

const fresh: QuestRecord = { status: 'active', progress: 0, seen: [] };

const ctx: GoalContext = {
  hearts: (npcId) => (npcId === 'maomao' ? 3 : 0),
  itemCount: (itemId) => (itemId === 'egg' ? 4 : 0),
};

describe('任務目標的進度（goalProgress / goalMet）', () => {
  it('交付物品：背包裡的數量達到才算完成', () => {
    expect(goalMet({ type: 'deliver', itemId: 'egg', count: 4 }, fresh, ctx)).toBe(true);
    expect(goalMet({ type: 'deliver', itemId: 'egg', count: 5 }, fresh, ctx)).toBe(false);
    expect(goalProgress({ type: 'deliver', itemId: 'egg', count: 5 }, fresh, ctx)).toEqual({ value: 4, target: 5 });
  });

  it('收成 N 種作物：看不同作物的種類數，同一種重複收成不加', () => {
    const goal = { type: 'harvestKinds', count: 2 } as const;
    const once = { ...fresh, seen: ['crop.sweet-radish'], progress: 1 };
    expect(goalMet(goal, once, ctx)).toBe(false);
    expect(goalMet(goal, { ...once, seen: ['crop.sweet-radish', 'crop.moon-bean'], progress: 2 }, ctx)).toBe(true);
  });

  it('出貨 N 件：依累計的件數', () => {
    expect(goalMet({ type: 'ship', count: 10 }, { ...fresh, progress: 9 }, ctx)).toBe(false);
    expect(goalMet({ type: 'ship', count: 10 }, { ...fresh, progress: 10 }, ctx)).toBe(true);
  });

  it('好感 N 顆心：依居民目前的顆心數（不看任務紀錄）', () => {
    expect(goalMet({ type: 'hearts', npcId: 'maomao', hearts: 3 }, fresh, ctx)).toBe(true);
    expect(goalMet({ type: 'hearts', npcId: 'maomao', hearts: 4 }, fresh, ctx)).toBe(false);
    expect(goalProgress({ type: 'hearts', npcId: 'maomao', hearts: 4 }, fresh, ctx)).toEqual({ value: 3, target: 4 });
  });

  it('拜訪地點：進過一次就算', () => {
    expect(goalMet({ type: 'visit', mapId: 'lake' }, fresh, ctx)).toBe(false);
    expect(goalMet({ type: 'visit', mapId: 'lake' }, { ...fresh, progress: 1 }, ctx)).toBe(true);
  });

  it('釣到某種魚 N 條；挖到某層（進到該層或更深）', () => {
    expect(goalMet({ type: 'fish', fishId: 'carp', count: 2 }, { ...fresh, progress: 1 }, ctx)).toBe(false);
    expect(goalMet({ type: 'mineLayer', layer: 5 }, { ...fresh, progress: 4 }, ctx)).toBe(false);
    expect(goalMet({ type: 'mineLayer', layer: 5 }, { ...fresh, progress: 5 }, ctx)).toBe(true);
  });

  it('烹飪某道料理 N 份', () => {
    expect(goalMet({ type: 'cook', recipeId: 'mint-tea', count: 1 }, fresh, ctx)).toBe(false);
    expect(goalMet({ type: 'cook', recipeId: 'mint-tea', count: 1 }, { ...fresh, progress: 1 }, ctx)).toBe(true);
  });
});

describe('事件推進任務進度（advanceQuest）', () => {
  it('收成只在符合的作物種類上加一種', () => {
    const goal = { type: 'harvestKinds', count: 2 } as const;
    const first = advanceQuest(goal, fresh, { type: 'harvest', cropId: 'sweet-radish' });
    expect(first.seen).toEqual(['sweet-radish']);
    expect(first.progress).toBe(1);
    const repeat = advanceQuest(goal, first, { type: 'harvest', cropId: 'sweet-radish' });
    expect(repeat).toBe(first);
  });

  it('出貨依件數累加；其他事件不影響', () => {
    const goal = { type: 'ship', count: 10 } as const;
    const shipped = advanceQuest(goal, fresh, { type: 'ship', itemId: 'crop.sweet-radish', count: 4 });
    expect(shipped.progress).toBe(4);
    expect(advanceQuest(goal, shipped, { type: 'fish', fishId: 'carp' })).toBe(shipped);
  });

  it('釣魚、烹飪只計符合的魚與料理', () => {
    const fish = { type: 'fish', fishId: 'carp', count: 2 } as const;
    expect(advanceQuest(fish, fresh, { type: 'fish', fishId: 'crucian' })).toBe(fresh);
    expect(advanceQuest(fish, fresh, { type: 'fish', fishId: 'carp' }).progress).toBe(1);
    const cook = { type: 'cook', recipeId: 'mint-tea', count: 1 } as const;
    expect(advanceQuest(cook, fresh, { type: 'cook', recipeId: 'fried-egg' })).toBe(fresh);
    expect(advanceQuest(cook, fresh, { type: 'cook', recipeId: 'mint-tea' }).progress).toBe(1);
  });

  it('拜訪只看地圖 id；挖礦記下最深的層', () => {
    const visit = { type: 'visit', mapId: 'lake' } as const;
    expect(advanceQuest(visit, fresh, { type: 'visit', mapId: 'forest' })).toBe(fresh);
    expect(advanceQuest(visit, fresh, { type: 'visit', mapId: 'lake' }).progress).toBe(1);
    const mine = { type: 'mineLayer', layer: 5 } as const;
    expect(advanceQuest(mine, { ...fresh, progress: 7 }, { type: 'mineLayer', layer: 3 }).progress).toBe(7);
    expect(advanceQuest(mine, fresh, { type: 'mineLayer', layer: 6 }).progress).toBe(6);
  });

  it('交付與好感目標不靠事件推進', () => {
    expect(advanceQuest({ type: 'deliver', itemId: 'egg', count: 1 }, fresh, { type: 'ship', itemId: 'egg', count: 1 })).toBe(fresh);
    expect(advanceQuest({ type: 'hearts', npcId: 'maomao', hearts: 1 }, fresh, { type: 'ship', itemId: 'egg', count: 1 })).toBe(fresh);
  });
});

describe('解鎖條件（unlockMet）', () => {
  const open: UnlockContext = { hearts: () => 2, flags: { 'sign-up': true }, heartEvents: ['maomao-heart-1'], mail: { 'maomao-letter-1': 'read' } };

  it('沒有條件就一直開放', () => {
    expect(unlockMet(undefined, open)).toBe(true);
    expect(unlockMet({}, open)).toBe(true);
  });

  it('好感、旗標、已完成的心形事件、已讀的信要全部符合', () => {
    expect(unlockMet({ hearts: { npcId: 'maomao', hearts: 2 } }, open)).toBe(true);
    expect(unlockMet({ hearts: { npcId: 'maomao', hearts: 3 } }, open)).toBe(false);
    expect(unlockMet({ flag: 'sign-up' }, open)).toBe(true);
    expect(unlockMet({ flag: 'other' }, open)).toBe(false);
    expect(unlockMet({ heartEvent: 'maomao-heart-1' }, open)).toBe(true);
    expect(unlockMet({ heartEvent: 'maomao-heart-2' }, open)).toBe(false);
    expect(unlockMet({ letter: 'maomao-letter-1' }, open)).toBe(true);
    expect(unlockMet({ letter: 'maomao-letter-2' }, open)).toBe(false);
    expect(unlockMet({ flag: 'sign-up', letter: 'maomao-letter-2' }, open)).toBe(false);
  });
});
