import { describe, expect, it } from 'vitest';
import { blocksOn, generateMineLayer, isCheckpoint, MAX_BLOCKS, mineId, mineLayerOf, mineWidthOf, MINE_DEPTH, MINE_HEIGHT, MINE_WIDTH, stairRow, type MineRules } from './mine';
import type { MapDef } from './content';
import mineRulesJson from '../../content/mine.json';

const rules: MineRules = mineRulesJson;

/** 一層的上下樓梯位置；找不到代表生成器有缺陷。 */
function stairsOf(map: MapDef): { up: { x: number; y: number }; down: { x: number; y: number } } {
  const up = find(map, '<');
  const down = find(map, '>');
  if (!up || !down) throw new Error(`第 ${map.id} 層缺少樓梯`);
  return { up, down };
}

/** 石頭與礦石（任何會擋路、要用鎬敲的格子）。 */
function isStone(symbol: string | undefined): boolean {
  return symbol !== undefined && symbol !== '.' && symbol !== '<' && symbol !== '>' && symbol !== '#';
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

/**
 * 從 from 到 to 最少要敲幾塊石頭：空地與樓梯免費，石頭與礦石各算 1，牆不能穿。
 * 這是礦坑閘門的實際代價；不能走的路回傳 Infinity。
 */
function fewestDigs(map: MapDef, from: { x: number; y: number }, to: { x: number; y: number }): number {
  const size = map.width * map.height;
  const index = (x: number, y: number): number => y * map.width + x;
  const dist = new Array<number>(size).fill(Number.POSITIVE_INFINITY);
  const done = new Array<boolean>(size).fill(false);
  dist[index(from.x, from.y)] = 0;
  const target = index(to.x, to.y);
  for (;;) {
    let best = -1;
    for (let i = 0; i < size; i += 1) {
      const d = dist[i] ?? Number.POSITIVE_INFINITY;
      if (!done[i] && Number.isFinite(d) && (best < 0 || d < (dist[best] ?? Number.POSITIVE_INFINITY))) best = i;
    }
    if (best < 0) return Number.POSITIVE_INFINITY;
    if (best === target) return dist[best] ?? Number.POSITIVE_INFINITY;
    done[best] = true;
    const bx = best % map.width;
    const by = Math.floor(best / map.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = bx + dx;
      const ny = by + dy;
      const symbol = map.rows[ny]?.[nx];
      if (symbol === undefined || symbol === '#') continue;
      const step = isStone(symbol) ? 1 : 0;
      const ni = index(nx, ny);
      const next = (dist[best] ?? 0) + step;
      if (next < (dist[ni] ?? Number.POSITIVE_INFINITY)) dist[ni] = next;
    }
  }
}

function countOf(map: MapDef, symbol: string): number {
  return map.rows.join('').split(symbol).length - 1;
}

/** 整欄都是石頭（上下牆之間）的欄數，只算走廊會經過的 2 到 width-3 欄。 */
function solidColumns(map: MapDef): number {
  let walls = 0;
  for (let x = 2; x <= map.width - 3; x += 1) {
    let solid = true;
    for (let y = 1; y < map.height - 1; y += 1) {
      if (!isStone(map.rows[y]?.[x])) solid = false;
    }
    if (solid) walls += 1;
  }
  return walls;
}

/** 同一組種子與層數的生成結果摘要（FNV-1a），用來確認第 1 到 39 層與改版前一模一樣。 */
function fingerprint(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

describe('mine layers', () => {
  it('the same layer and seed always give the same rows; another seed gives other rows', () => {
    expect(generateMineLayer(3, 11, rules).rows).toEqual(generateMineLayer(3, 11, rules).rows);
    expect(generateMineLayer(3, 11, rules).rows).not.toEqual(generateMineLayer(3, 12, rules).rows);
  });

  it('is the size of the mine, with solid walls around the edge', () => {
    const map = generateMineLayer(1, 5, rules);
    expect(map.width).toBe(MINE_WIDTH);
    expect(map.height).toBe(MINE_HEIGHT);
    expect(map.rows).toHaveLength(MINE_HEIGHT);
    for (const row of map.rows) expect(row).toHaveLength(MINE_WIDTH);
    expect(map.rows[0]).toBe('#'.repeat(MINE_WIDTH));
    expect(map.rows[MINE_HEIGHT - 1]).toBe('#'.repeat(MINE_WIDTH));
  });

  it('has one up staircase and one down staircase on every floor, the last first-band floor included', () => {
    for (const layer of [1, 2, 17, MINE_DEPTH - 1, MINE_DEPTH]) {
      const map = generateMineLayer(layer, 9, rules);
      expect(countOf(map, '<'), `layer ${layer} up`).toBe(1);
      expect(countOf(map, '>'), `layer ${layer} down`).toBe(1);
    }
  });

  it('the landing spot is walkable and next to the up staircase', () => {
    for (const layer of [1, 6, 25]) {
      const map = generateMineLayer(layer, 4, rules);
      const up = find(map, '<');
      if (!up) throw new Error('no up staircase');
      expect(Math.abs(map.spawn.x - up.x) + Math.abs(map.spawn.y - up.y), `layer ${layer}`).toBe(1);
      expect(map.rows[map.spawn.y]?.[map.spawn.x]).toBe('.');
    }
  });

  it('a walk over open ground never reaches the down staircase alone: the pick is needed to go deeper', () => {
    for (const layer of [1, 2, 10, 20, 33, MINE_DEPTH - 1]) {
      const map = generateMineLayer(layer, 2, rules);
      const { up, down } = stairsOf(map);
      expect(walkableReaches(map, up, down), `layer ${layer}`).toBe(false);
    }
  });

  it('digging through the rocks on the way always reaches the down staircase, so the mine cannot lock the player in', () => {
    for (const layer of [1, 2, 10, 20, 33, MINE_DEPTH - 1]) {
      for (const seed of [1, 2, 3]) {
        const map = generateMineLayer(layer, seed, rules);
        const { up, down } = stairsOf(map);
        expect(walkableReaches(map, up, down, ['r', 'o', 's', 'g']), `layer ${layer} seed ${seed}`).toBe(true);
      }
    }
  });

  it('落石擋住的路不能被繞過：從 < 到 > 至少要敲 blocksOn(層) 塊石頭', () => {
    for (const layer of [1, 2, 10, 20, 33, MINE_DEPTH - 1]) {
      for (const seed of [1, 2, 3]) {
        const map = generateMineLayer(layer, seed, rules);
        const { up, down } = stairsOf(map);
        expect(fewestDigs(map, up, down), `layer ${layer} seed ${seed}`).toBeGreaterThanOrEqual(blocksOn(layer, rules));
      }
    }
  });

  it('第 N 層的落石數量：整欄都是石頭的牆恰好有 blocksOn(N) 道', () => {
    for (const layer of [1, 2, 10, 20, MINE_DEPTH]) {
      for (const seed of [1, 2, 3]) {
        expect(solidColumns(generateMineLayer(layer, seed, rules)), `layer ${layer} seed ${seed}`).toBe(blocksOn(layer, rules));
      }
    }
  });

  it('the rock walls across the way grow with depth, up to the first-band cap', () => {
    expect(blocksOn(1, rules)).toBe(4);
    expect(blocksOn(10, rules)).toBe(22);
    expect(blocksOn(MINE_DEPTH, rules)).toBe(MAX_BLOCKS);
    // 牆只能排在第 3 到 MINE_WIDTH-4 欄，上限不能超過可用的欄數。
    expect(MAX_BLOCKS).toBe(MINE_WIDTH - 6);
  });

  it('the walls on floors 1 to 19 add up to the band that puts floor 20 near the end of summer', () => {
    // 模擬（npm run sim）的校準：第 20 層約在第 38 天（夏末）。總數落在這個區間內才算接近目標。
    let digs = 0;
    for (let layer = 1; layer < 20; layer += 1) digs += blocksOn(layer, rules);
    expect(digs).toBeGreaterThanOrEqual(380);
    expect(digs).toBeLessThanOrEqual(420);
  });

  it("neighbouring floors line up: a floor's down staircase is where the next floor's up staircase is", () => {
    const seed = 21;
    for (let layer = 1; layer < MINE_DEPTH; layer += 1) {
      const here = generateMineLayer(layer, seed, rules);
      const below = generateMineLayer(layer + 1, seed, rules);
      const down = find(here, '>');
      const up = find(below, '<');
      expect(down?.y, `layer ${layer}`).toBe(up?.y);
      expect(down?.x).toBe(1);
      expect(up?.x).toBe(below.width - 2);
      // 下一層的落點就是這層 '>' 的旁邊。
      expect(here.legend['>']?.spawn).toEqual({ x: below.width - 3, y: below.spawn.y });
    }
  });

  it('the first floor goes back up to the entrance cave', () => {
    const map = generateMineLayer(1, 7, rules);
    expect(map.legend['<']).toMatchObject({ kind: 'stairs', to: 'mine-entrance', spawn: { x: 7, y: 2 } });
  });

  it('there are more copper nodes deeper down than near the top', () => {
    const copper = (from: number, to: number): number => {
      let total = 0;
      for (let layer = from; layer <= to; layer += 1) {
        for (const seed of [1, 2, 3]) total += countOf(generateMineLayer(layer, seed, rules), 'o');
      }
      return total;
    };
    expect(copper(31, 40)).toBeGreaterThan(copper(1, 10));
  });

  it('the first 40 floors are the same as before the deep mine existed (same rows for the same seed)', () => {
    const parts: string[] = [];
    for (const seed of [1, 7, 99, 4294967295]) {
      for (let layer = 1; layer <= 39; layer += 1) parts.push(generateMineLayer(layer, seed, rules).rows.join('\n'));
    }
    expect(fingerprint(parts.join('\n===\n'))).toBe(1386285372);
  });

  it('rejects a layer that is not a floor of the mine', () => {
    expect(() => generateMineLayer(0, 1, rules)).toThrow(RangeError);
    expect(() => generateMineLayer(1.5, 1, rules)).toThrow(RangeError);
  });
});

describe('the deep mine (第 41 層起)', () => {
  it('gets wider by widthPerLayer each floor, up to maxWidth', () => {
    expect(mineWidthOf(MINE_DEPTH, rules)).toBe(MINE_WIDTH);
    expect(mineWidthOf(41, rules)).toBe(42);
    expect(mineWidthOf(42, rules)).toBe(44);
    expect(mineWidthOf(80, rules)).toBe(120);
    expect(mineWidthOf(500, rules)).toBe(rules.maxWidth);
  });

  it('gets one more wall per floor (two more columns), up to the width cap', () => {
    expect(blocksOn(41, rules)).toBe(36);
    expect(blocksOn(42, rules)).toBe(38);
    expect(blocksOn(80, rules)).toBe(114);
    expect(blocksOn(200, rules)).toBe(114);
  });

  it('the floors are the width they say, with solid edges, one up and one down staircase, and a walkable landing', () => {
    for (const layer of [41, 42, 55, 61, 80, 120]) {
      const map = generateMineLayer(layer, 3, rules);
      expect(map.width, `layer ${layer}`).toBe(mineWidthOf(layer, rules));
      expect(map.rows).toHaveLength(MINE_HEIGHT);
      for (const row of map.rows) expect(row, `layer ${layer}`).toHaveLength(map.width);
      expect(map.rows[0]).toBe('#'.repeat(map.width));
      expect(countOf(map, '<'), `layer ${layer} up`).toBe(1);
      expect(countOf(map, '>'), `layer ${layer} down`).toBe(1);
      const up = find(map, '<');
      if (!up) throw new Error('no up staircase');
      expect(Math.abs(map.spawn.x - up.x) + Math.abs(map.spawn.y - up.y), `layer ${layer}`).toBe(1);
      expect(map.rows[map.spawn.y]?.[map.spawn.x]).toBe('.');
    }
  });

  it('is deterministic: the same seed and floor always give the same rows, another seed gives other rows', () => {
    expect(generateMineLayer(55, 9, rules).rows).toEqual(generateMineLayer(55, 9, rules).rows);
    expect(generateMineLayer(55, 9, rules).rows).not.toEqual(generateMineLayer(55, 10, rules).rows);
  });

  it('the wall count matches blocksOn, and digging through the walls reaches the down staircase', () => {
    for (const layer of [41, 42, 60, 80, 150]) {
      for (const seed of [1, 2]) {
        const map = generateMineLayer(layer, seed, rules);
        expect(solidColumns(map), `layer ${layer} seed ${seed}`).toBe(blocksOn(layer, rules));
        const { up, down } = stairsOf(map);
        expect(walkableReaches(map, up, down), `layer ${layer} seed ${seed} walking`).toBe(false);
        expect(walkableReaches(map, up, down, ['r', 'o', 's', 'g']), `layer ${layer} seed ${seed} digging`).toBe(true);
      }
    }
    for (const layer of [41, 42, 60]) {
      const map = generateMineLayer(layer, 1, rules);
      const { up, down } = stairsOf(map);
      expect(fewestDigs(map, up, down), `layer ${layer}`).toBeGreaterThanOrEqual(blocksOn(layer, rules));
    }
  });

  it('ore changes with depth: silver from floor 41, copper until floor 60, gold from floor 61', () => {
    const at = (layer: number, symbol: string): number => [1, 2, 3].reduce((sum, seed) => sum + countOf(generateMineLayer(layer, seed, rules), symbol), 0);
    expect(at(45, 's')).toBeGreaterThan(0);
    expect(at(45, 'o')).toBeGreaterThan(0);
    expect(at(45, 'g')).toBe(0);
    expect(at(65, 'g')).toBeGreaterThan(0);
    expect(at(65, 's')).toBeGreaterThan(0);
    expect(at(65, 'o')).toBe(0);
    expect(at(20, 's')).toBe(0);
    expect(at(20, 'g')).toBe(0);
  });

  it('the ore symbols carry the item they yield', () => {
    const map = generateMineLayer(65, 4, rules);
    expect(map.legend['s']).toEqual({ kind: 'ore', item: 'silver-ore' });
    expect(map.legend['g']).toEqual({ kind: 'ore', item: 'gold-ore' });
    expect(map.legend['o']).toBeUndefined();
  });

  it('deeper floors have more ore among the rock than shallow ones', () => {
    const ore = (layer: number): number => [1, 2, 3].reduce((sum, seed) => {
      const map = generateMineLayer(layer, seed, rules);
      return sum + ['o', 's', 'g'].reduce((n, symbol) => n + countOf(map, symbol), 0);
    }, 0);
    expect(ore(60)).toBeGreaterThan(ore(10));
  });

  it('a floor at 100 or deeper is still made quickly (the whole layer in well under 100 ms)', () => {
    for (const layer of [100, 150, 200, 1000]) {
      const started = performance.now();
      const map = generateMineLayer(layer, 12345, rules);
      const elapsed = performance.now() - started;
      expect(elapsed, `layer ${layer}`).toBeLessThan(100);
      expect(countOf(map, '>'), `layer ${layer}`).toBe(1);
    }
  });
});

describe('mine helpers', () => {
  it('names and parses floors, and marks every fifth floor as a checkpoint, deep ones too', () => {
    expect(mineId(12)).toBe('mine-12');
    expect(mineLayerOf('mine-12')).toBe(12);
    expect(mineLayerOf('mine-45')).toBe(45);
    expect(mineLayerOf('farm')).toBeNull();
    expect(isCheckpoint(5)).toBe(true);
    expect(isCheckpoint(7)).toBe(false);
    expect(isCheckpoint(45)).toBe(true);
    expect(isCheckpoint(203)).toBe(false);
  });

  it('the entrance row is fixed, and other floors get a row inside the walls', () => {
    expect(stairRow(0, 99)).toBe(8);
    for (let layer = 1; layer <= 200; layer += 1) {
      const row = stairRow(layer, 99);
      expect(row).toBeGreaterThanOrEqual(2);
      expect(row).toBeLessThanOrEqual(MINE_HEIGHT - 3);
    }
  });
});
