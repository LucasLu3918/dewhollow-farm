import { describe, expect, it } from 'vitest';
import type { MapDef } from './content';
import { carryDecor, decorAt, keepsPathsOpen, placementRefusal, type DecorPlacement } from './decor';

/**
 * 測試用的小屋（9 x 7）：床在 (1,1)，工作台 (3,1)，廚房 (7,1)，衣櫃 (2,4)，信箱 (4,4)，門 (4,6)，出生點 (4,5)。
 */
const house: MapDef = {
  id: 'house',
  name: '小屋',
  width: 9,
  height: 7,
  rows: ['#########', '#B.T...K#', '#.......#', '#.......#', '#.P.L...#', '#.......#', '####D####'],
  legend: {
    '#': { kind: 'wall' },
    '.': { kind: 'floor' },
    B: { kind: 'bed' },
    T: { kind: 'workbench' },
    K: { kind: 'kitchen' },
    P: { kind: 'furniture', wardrobe: true },
    L: { kind: 'furniture', notice: 'mailbox' },
    D: { kind: 'door', to: 'farm', spawn: { x: 2, y: 5 } },
  },
  spawn: { x: 4, y: 5 },
};

const farm: MapDef = { ...house, id: 'farm', name: '農場' };

describe('裝飾的擺放位置', () => {
  it('可以擺在空的地板上', () => {
    expect(placementRefusal(house, [], { x: 3, y: 3 })).toBeNull();
  });

  it('牆、床、櫃檯等不是地板，不能擺', () => {
    expect(placementRefusal(house, [], { x: 0, y: 0 })).toBe('NOT_FLOOR');
    expect(placementRefusal(house, [], { x: 1, y: 1 })).toBe('NOT_FLOOR');
    expect(placementRefusal(house, [], { x: 7, y: 1 })).toBe('NOT_FLOOR');
  });

  it('出生點（進門的落點）不能擺，否則出不了門', () => {
    expect(placementRefusal(house, [], { x: 4, y: 5 })).toBe('SPAWN');
  });

  it('同一格不能擺兩件', () => {
    const placed: DecorPlacement[] = [{ itemId: 'star-string', x: 3, y: 3 }];
    expect(placementRefusal(house, placed, { x: 3, y: 3 })).toBe('OCCUPIED');
  });

  it('不在小屋裡（例如農場）不能擺', () => {
    expect(placementRefusal(farm, [], { x: 3, y: 3 })).toBe('NOT_IN_HOUSE');
  });

  it('不能擋住床的動線：床的兩邊都被擺住就拒絕第二件', () => {
    const first: DecorPlacement[] = [{ itemId: 'star-string', x: 2, y: 1 }];
    expect(placementRefusal(house, first, { x: 1, y: 2 })).toBe('BLOCKS_PATH');
  });

  it('不能擋住一整排：中間一排擺滿、只剩一格就不能再堵住它', () => {
    let placed: DecorPlacement[] = [];
    for (let x = 1; x <= 6; x += 1) {
      expect(placementRefusal(house, placed, { x, y: 3 })).toBeNull();
      placed = [...placed, { itemId: 'star-string', x, y: 3 }];
    }
    // 第 7 格是最後的通路，堵上去後北側的床、工作台、廚房都到不了。
    expect(placementRefusal(house, placed, { x: 7, y: 3 })).toBe('BLOCKS_PATH');
  });

  it('keepsPathsOpen：所有服務點（床、工作台、廚房、信箱、衣櫃、門）都要還能走到', () => {
    expect(keepsPathsOpen(house, [])).toBe(true);
    const sealed: DecorPlacement[] = [
      { itemId: 'a', x: 1, y: 3 },
      { itemId: 'a', x: 2, y: 3 },
      { itemId: 'a', x: 3, y: 3 },
      { itemId: 'a', x: 4, y: 3 },
      { itemId: 'a', x: 5, y: 3 },
      { itemId: 'a', x: 6, y: 3 },
      { itemId: 'a', x: 7, y: 3 },
    ];
    expect(keepsPathsOpen(house, sealed)).toBe(false);
  });
});

describe('擺好的裝飾', () => {
  const placed: DecorPlacement[] = [{ itemId: 'night-canvas', x: 3, y: 3 }];

  it('decorAt 找得到擺在那一格的裝飾', () => {
    expect(decorAt(placed, 3, 3)?.itemId).toBe('night-canvas');
    expect(decorAt(placed, 3, 2)).toBeUndefined();
    expect(decorAt(undefined, 3, 3)).toBeUndefined();
  });

  it('搬進另一個房間時，放得下的留下，放不下的回傳給背包', () => {
    const wider: MapDef = {
      ...house,
      id: 'house-wing',
      width: 9,
      height: 7,
      rows: ['#########', '#B.T...K#', '#.......#', '#.......#', '#.P.L...#', '#.......#', '####D####'],
    };
    const blockedRoom: MapDef = {
      ...wider,
      id: 'house-full',
      rows: ['#########', '#B.T...K#', '#.......#', '#..#....#', '#.P.L...#', '#.......#', '####D####'],
    };
    const carried = carryDecor(wider, placed);
    expect(carried.kept).toEqual(placed);
    expect(carried.displaced).toEqual([]);

    const moved = carryDecor(blockedRoom, placed);
    expect(moved.kept).toEqual([]);
    expect(moved.displaced).toEqual(placed);
  });
});
