import { describe, expect, it } from 'vitest';
import type { ContentPack } from '../../domain/content';
import { shippedPack } from '../../../tests/sim/shipped-content';
import { randomEventProblems, repairProblems } from './repairs-content';

/**
 * M5d 的內容檢查：修復與隨機事件的參照與數值。真實內容必須沒有問題；故意弄壞一處，檢查就要指出來。
 */

describe('修復與隨機事件的真實內容', () => {
  it('shipped repairs and random events have no problems', () => {
    expect(repairProblems(shippedPack)).toEqual([]);
    expect(randomEventProblems(shippedPack)).toEqual([]);
  });

  it('spring garden: ten wild vegetables and flowers, each one donation; summer lake: eight different fish, one each', () => {
    const garden = shippedPack.repairs?.find((r) => r.id === 'garden');
    const lake = shippedPack.repairs?.find((r) => r.id === 'lake');
    expect(garden).toMatchObject({ season: 'spring', goal: { type: 'kinds', count: 10, each: 1 } });
    expect(garden?.goal.pool).toHaveLength(10);
    expect(lake).toMatchObject({ season: 'summer', goal: { type: 'kinds', count: 8, each: 1 } });
    expect(new Set(lake?.goal.pool).size).toBe(8);
  });

  it('the garden unlocks the fountain blueprint flag; the lake sets the bridge and the lake house', () => {
    const repairs = shippedPack.repairs ?? [];
    expect(repairs.find((r) => r.id === 'garden')?.reward.flags).toEqual(expect.arrayContaining(['repair:garden', 'blueprint:fountain']));
    expect(repairs.find((r) => r.id === 'lake')?.reward.flags).toEqual(expect.arrayContaining(['repair:lake-bridge', 'repair:lake-house']));
  });

  it('has eight random events for spring and summer, each with a playtime and a valid effect', () => {
    const events = shippedPack.randomEvents?.events ?? [];
    expect(events.map((e) => e.id).sort()).toEqual(
      ['caravan', 'lake-fog', 'lost-kitten', 'meteor', 'neighbor-gift', 'plaza-concert', 'storm-debris', 'wildflowers'].sort(),
    );
    for (const event of events) {
      expect(event.seasons.every((s) => s === 'spring' || s === 'summer')).toBe(true);
      expect(event.playMinutes).toBeGreaterThan(0);
    }
    expect(events.find((e) => e.id === 'caravan')?.weekdays).toEqual([4, 5]);
    expect(events.find((e) => e.id === 'meteor')?.period).toBe('night');
  });

  it('the main quest chapter 3 waits on the repair flag, not the old placeholder', () => {
    const third = shippedPack.chapters?.find((c) => c.number === 3);
    expect(third?.steps.some((s) => 'flag' in s && s.flag === 'repair:lake-bridge')).toBe(true);
    expect(third?.steps.some((s) => 'flag' in s && s.flag === 'lakeBridge')).toBe(false);
  });
});

function withRepairs(pack: ContentPack, repairs: NonNullable<ContentPack['repairs']>): ContentPack {
  return { ...pack, repairs };
}

function withEvents(pack: ContentPack, events: NonNullable<ContentPack['randomEvents']>['events']): ContentPack {
  return { ...pack, randomEvents: { ...(pack.randomEvents ?? { chance: 0, events: [] }), events } };
}

describe('修復與隨機事件的檢查會抓到錯誤', () => {
  const garden = () => shippedPack.repairs!.find((r) => r.id === 'garden')!;
  const concert = () => shippedPack.randomEvents!.events.find((e) => e.id === 'plaza-concert')!;

  it('a repair pool item that does not exist is reported', () => {
    const broken = { ...garden(), goal: { ...garden().goal, pool: ['nothing-here'] } } as NonNullable<ContentPack['repairs']>[number];
    expect(repairProblems(withRepairs(shippedPack, [broken])).join('\n')).toContain('修復 garden 的候選物品 nothing-here 不存在');
  });

  it('a repair that asks for more kinds than the pool has is reported', () => {
    const broken = { ...garden(), goal: { type: 'kinds' as const, pool: ['mushroom'], count: 3, each: 1 } };
    expect(repairProblems(withRepairs(shippedPack, [broken])).join('\n')).toContain('修復 garden 要的種類 3 比候選 1 種還多');
  });

  it('a repair that is in a season the donation cannot reach is reported (season must be spring or summer)', () => {
    const broken = { ...garden(), season: 'winter' as const };
    expect(repairProblems(withRepairs(shippedPack, [broken])).join('\n')).toContain('修復 garden 不在春夏');
  });

  it('a random event that grants an unknown item is reported', () => {
    const events = shippedPack.randomEvents!.events.map((e) => (e.id === 'caravan' ? { ...e, effect: { type: 'grant' as const, items: { 'bogus-item': 1 } } } : e));
    expect(randomEventProblems(withEvents(shippedPack, events)).join('\n')).toContain('隨機事件 caravan 的獎勵物品 bogus-item 不存在');
  });

  it('a concert spot on an unwalkable tile is reported', () => {
    const spots = [{ npcId: 'maomao', x: 0, y: 0 }];
    const events = shippedPack.randomEvents!.events.map((e) => (e.id === 'plaza-concert' ? { ...concert(), effect: { ...concert().effect, spots } } : e));
    expect(randomEventProblems(withEvents(shippedPack, events)).join('\n')).toContain('音樂會 (0,0) 不可行走');
  });

  it('a concert with a resident who does not exist is reported', () => {
    const effect = concert().effect;
    if (effect.type !== 'concert') throw new Error('setup');
    const spots = [{ npcId: 'nobody', x: 10, y: 8 }];
    const events = shippedPack.randomEvents!.events.map((e) => (e.id === 'plaza-concert' ? { ...concert(), effect: { ...effect, spots } } : e));
    expect(randomEventProblems(withEvents(shippedPack, events)).join('\n')).toContain('音樂會的居民 nobody 不存在');
  });
});
