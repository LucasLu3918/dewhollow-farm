import { describe, expect, it } from 'vitest';
import { shippedPack } from '../../../tests/sim/shipped-content';

/**
 * M5d 的魚種內容：湖畔修復要八種不同的魚，所以八種都要在夏天的湖裡釣得到，
 * 新魚的季節只能是春或夏，權重與售價為正。
 */

const LAKE_FISH_IDS = ['carp', 'crucian', 'bass', 'reed-catfish', 'silver-minnow', 'mossy-perch', 'veil-bream', 'pebble-loach'];
const NEW_FISH_IDS = ['reed-catfish', 'silver-minnow', 'mossy-perch', 'veil-bream', 'pebble-loach'];

describe('魚種的真實內容', () => {
  it('有八種魚，id 與名稱都不重複', () => {
    expect(shippedPack.fish.map((f) => f.id).sort()).toEqual([...LAKE_FISH_IDS].sort());
    const names = shippedPack.fish.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('八種魚在夏天的湖裡都釣得到（湖畔修復是夏天的目標）', () => {
    for (const fish of shippedPack.fish) {
      expect(fish.seasons, fish.id).toContain('summer');
    }
  });

  it('新增的五種魚季節只有春或夏，權重與售價為正', () => {
    for (const id of NEW_FISH_IDS) {
      const fish = shippedPack.fish.find((f) => f.id === id);
      expect(fish, id).toBeDefined();
      expect(fish!.seasons.every((s) => s === 'spring' || s === 'summer'), id).toBe(true);
      expect(fish!.weight, id).toBeGreaterThan(0);
      expect(fish!.sellPrice, id).toBeGreaterThan(0);
    }
  });

  it('湖畔修復要的八種魚，就是湖裡的八種魚（交叉參照）', () => {
    const lake = shippedPack.repairs?.find((r) => r.id === 'lake');
    expect(lake?.goal.pool.slice().sort()).toEqual(LAKE_FISH_IDS.map((id) => `fish.${id}`).sort());
  });

  it('夏天湖裡的魚各自都有機會上鉤：權重總和為正，且稀有的魚權重最小', () => {
    const summer = shippedPack.fish.filter((f) => f.seasons.includes('summer'));
    expect(summer.reduce((sum, f) => sum + f.weight, 0)).toBeGreaterThan(0);
    const rarest = Math.min(...summer.map((f) => f.weight));
    expect(shippedPack.fish.find((f) => f.id === 'mossy-perch')?.weight).toBe(rarest);
  });
});
