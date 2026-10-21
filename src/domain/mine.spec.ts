import { describe, expect, it } from 'vitest';
import { blocksOn, generateMineLayer, isCheckpoint, MAX_BLOCKS, mineId, mineLayerOf, MINE_DEPTH, MINE_HEIGHT, MINE_WIDTH, stairRow } from './mine';
import type { MapDef } from './content';

/** 一層的上下樓梯位置；找不到代表生成器有缺陷。 */
function stairsOf(map: MapDef): { up: { x: number; y: number }; down: { x: number; y: number } } {
  const up = find(map, '<');
  const down = find(map, '>');
  if (!up || !down) throw new Error(`第 ${map.id} 層缺少樓梯`);
  return { up, down };
}

/** 從 '<' 出發，只走可以直接走的格子（路與樓梯，加上 extra 指定的符號）能不能到 '>'。 */
function walkableReaches(map: MapDef, from: { x: number; y: number }, to: { x: number; y: number }, extra: string[] = []): boolean {
  const open = new Set(['.', '<', '>', ...extra]);
  const seen = new Set<string>([`${from.x},${from.y}`]);
  const queue = [from];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur) break;
    if (cur.x === to.x && cur.y === to.y) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const key = `${nx},${ny}`;
      const symbol = map.rows[ny]?.[nx];
      if (symbol === undefined || !open.has(symbol) || seen.has(key)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return false;
}

function find(map: MapDef, symbol: string): { x: number; y: number } | null {
  for (let y = 0; y < map.height; y += 1) {
    const x = map.rows[y]?.indexOf(symbol) ?? -1;
    if (x >= 0) return { x, y };
  }
  return null;
}

function countOf(map: MapDef, symbol: string): number {
  return map.rows.join('').split(symbol).length - 1;
}

describe('mine layers', () => {
  it('the same layer and seed always give the same rows; another seed gives other rows', () => {
    expect(generateMineLayer(3, 11).rows).toEqual(generateMineLayer(3, 11).rows);
    expect(generateMineLayer(3, 11).rows).not.toEqual(generateMineLayer(3, 12).rows);
  });

  it('is the size of the mine, with solid walls around the edge', () => {
    const map = generateMineLayer(1, 5);
    expect(map.width).toBe(MINE_WIDTH);
    expect(map.height).toBe(MINE_HEIGHT);
    expect(map.rows).toHaveLength(MINE_HEIGHT);
    for (const row of map.rows) expect(row).toHaveLength(MINE_WIDTH);
    expect(map.rows[0]).toBe('#'.repeat(MINE_WIDTH));
    expect(map.rows[MINE_HEIGHT - 1]).toBe('#'.repeat(MINE_WIDTH));
  });

  it('has one up staircase and, except on the last floor, one down staircase', () => {
    for (const layer of [1, 2, 17, MINE_DEPTH - 1]) {
      const map = generateMineLayer(layer, 9);
      expect(countOf(map, '<'), `layer ${layer} up`).toBe(1);
      expect(countOf(map, '>'), `layer ${layer} down`).toBe(1);
    }
    expect(countOf(generateMineLayer(MINE_DEPTH, 9), '>')).toBe(0);
  });

  it('the landing spot is walkable and next to the up staircase', () => {
    for (const layer of [1, 6, 25]) {
      const map = generateMineLayer(layer, 4);
      const up = find(map, '<');
      if (!up) throw new Error('no up staircase');
      expect(Math.abs(map.spawn.x - up.x) + Math.abs(map.spawn.y - up.y), `layer ${layer}`).toBe(1);
      expect(map.rows[map.spawn.y]?.[map.spawn.x]).toBe('.');
    }
  });

  it('a walk over open ground never reaches the down staircase alone: the pick is needed to go deeper', () => {
    for (const layer of [1, 2, 10, 20, 33, MINE_DEPTH - 1]) {
      const map = generateMineLayer(layer, 2);
      const { up, down } = stairsOf(map);
      expect(walkableReaches(map, up, down), `layer ${layer}`).toBe(false);
    }
  });

  it('digging through the rocks on the way always reaches the down staircase, so the mine cannot lock the player in', () => {
    for (const layer of [1, 2, 10, 20, 33, MINE_DEPTH - 1]) {
      for (const seed of [1, 2, 3]) {
        const map = generateMineLayer(layer, seed);
        const { up, down } = stairsOf(map);
        expect(walkableReaches(map, up, down, ['r', 'o']), `layer ${layer} seed ${seed}`).toBe(true);
      }
    }
  });

  it('the rocks across the way grow with depth, up to the cap', () => {
    expect(blocksOn(1)).toBe(2);
    expect(blocksOn(10)).toBe(7);
    expect(blocksOn(MINE_DEPTH)).toBe(MAX_BLOCKS);
  });

  it("neighbouring floors line up: a floor's down staircase is where the next floor's up staircase is", () => {
    const seed = 21;
    for (let layer = 1; layer < MINE_DEPTH; layer += 1) {
      const here = generateMineLayer(layer, seed);
      const below = generateMineLayer(layer + 1, seed);
      const down = find(here, '>');
      const up = find(below, '<');
      expect(down?.y, `layer ${layer}`).toBe(up?.y);
      expect(down?.x).toBe(1);
      expect(up?.x).toBe(MINE_WIDTH - 2);
      // 下一層的落點就是這層 '>' 的旁邊。
      expect(here.legend['>']?.spawn).toEqual({ x: MINE_WIDTH - 3, y: below.spawn.y });
    }
  });

  it('the first floor goes back up to the entrance cave', () => {
    const map = generateMineLayer(1, 7);
    expect(map.legend['<']).toMatchObject({ kind: 'stairs', to: 'mine-entrance', spawn: { x: 7, y: 2 } });
  });

  it('there are more copper nodes deeper down than near the top', () => {
    const copper = (from: number, to: number): number => {
      let total = 0;
      for (let layer = from; layer <= to; layer += 1) {
        for (const seed of [1, 2, 3]) total += countOf(generateMineLayer(layer, seed), 'o');
      }
      return total;
    };
    expect(copper(31, 40)).toBeGreaterThan(copper(1, 10));
  });

  it('rejects a layer outside the mine', () => {
    expect(() => generateMineLayer(0, 1)).toThrow(RangeError);
    expect(() => generateMineLayer(MINE_DEPTH + 1, 1)).toThrow(RangeError);
  });
});

describe('mine helpers', () => {
  it('names and parses floors, and marks every fifth floor as a checkpoint', () => {
    expect(mineId(12)).toBe('mine-12');
    expect(mineLayerOf('mine-12')).toBe(12);
    expect(mineLayerOf('farm')).toBeNull();
    expect(isCheckpoint(5)).toBe(true);
    expect(isCheckpoint(7)).toBe(false);
  });

  it('the entrance row is fixed, and other floors get a row inside the walls', () => {
    expect(stairRow(0, 99)).toBe(8);
    for (let layer = 1; layer <= MINE_DEPTH; layer += 1) {
      const row = stairRow(layer, 99);
      expect(row).toBeGreaterThanOrEqual(2);
      expect(row).toBeLessThanOrEqual(MINE_HEIGHT - 3);
    }
  });
});
