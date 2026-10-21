import type { MapDef } from './content';
import { advanceRng } from './random';

/**
 * 礦坑：逐層以種子程序生成（同一層、同一個種子永遠長一樣）。
 * 每層是一張 24×16 的地圖：左邊有下樓的梯子 '>'，右邊有上樓的梯子 '<'，中間是隨機游走挖出來的路。
 * 路上有幾塊落石（r）擋著，要用鎬敲開才能往下（數量見 blocksOn）；其餘的石頭與礦石都可以敲掉。
 * 上下層的樓梯位置對齊（見 stairRow），敲得開的話每一層都走得到下一層，所以不會把玩家鎖在礦坑裡。
 */

export const MINE_DEPTH = 40;
export const MINE_WIDTH = 24;
export const MINE_HEIGHT = 16;
/** 每幾層有一個檢查點：從入口下來會直接到最深的檢查點。 */
export const CHECKPOINT_STEP = 5;

/** 入口（第 0 層）的樓梯列，也是第 1 層的 '<' 所在列。 */
const ENTRANCE_ROW = 8;

export function mineId(layer: number): string {
  return `mine-${layer}`;
}

/** 'mine-12' → 12；不是礦坑層的 id 回傳 null。 */
export function mineLayerOf(id: string): number | null {
  const match = /^mine-(\d+)$/.exec(id);
  return match ? Number(match[1]) : null;
}

export function isCheckpoint(layer: number): boolean {
  return layer % CHECKPOINT_STEP === 0;
}

/**
 * 第 layer 層的樓梯列。第 layer 層的 '>' 在左邊的這一列，第 layer+1 層的 '<' 在右邊的同一列。
 * 第 0 層（入口）固定在 ENTRANCE_ROW。
 */
export function stairRow(layer: number, seed: number): number {
  if (layer === 0) return ENTRANCE_ROW;
  const first = advanceRng((seed ^ Math.imul(layer, 0x27d4eb2d)) >>> 0);
  return 2 + Math.floor((first / 2 ** 32) * (MINE_HEIGHT - 4));
}

/** 路上的落石數：每 2 層多一塊，最多 MAX_BLOCKS 塊（這是深度的閘門，見 domain/mine.spec.ts）。 */
export const MAX_BLOCKS = 12;

export function blocksOn(layer: number): number {
  return Math.min(MAX_BLOCKS, 2 + Math.floor(layer / 2));
}

/** 每一層的礦石比例：越深越多，但有上限。 */
function oreChance(layer: number): number {
  return Math.min(0.3, 0.05 + 0.006 * layer);
}

function randomFor(seed: number, layer: number): () => number {
  let state = (seed ^ Math.imul(layer, 0x85ebca6b)) >>> 0;
  return () => {
    state = advanceRng(state);
    return state / 2 ** 32;
  };
}

export function generateMineLayer(layer: number, seed: number): MapDef {
  if (!Number.isInteger(layer) || layer < 1 || layer > MINE_DEPTH) {
    throw new RangeError(`礦坑只有第 1 到 ${MINE_DEPTH} 層：${layer}`);
  }
  const width = MINE_WIDTH;
  const height = MINE_HEIGHT;
  const rand = randomFor(seed, layer);
  const grid: string[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => (x === 0 || y === 0 || x === width - 1 || y === height - 1 ? '#' : 'r')),
  );

  const upRow = stairRow(layer - 1, seed);
  const downRow = stairRow(layer, seed);
  const lastFloor = layer === MINE_DEPTH;

  // 從 '<'（右邊）往 '>'（左邊）挖一條路：水平前進，途中隨機上下錯開。
  let x = width - 3;
  let y = upRow;
  const corridor: Array<[number, number]> = [[x, y]];
  grid[y]![x] = '.';
  while (!(x === 2 && y === downRow)) {
    if (x > 2 && (y === downRow || rand() < 0.6)) x -= 1;
    else if (y !== downRow) y += Math.sign(downRow - y);
    grid[y]![x] = '.';
    corridor.push([x, y]);
  }
  // 幾個小房間，讓每層看起來不像一條直線。
  for (let room = 0; room < 3; room += 1) {
    const cx = 3 + Math.floor(rand() * (width - 7));
    const cy = 2 + Math.floor(rand() * (height - 5));
    for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 3; dx += 1) grid[cy + dy]![cx + dx] = '.';
  }
  // 路上的落石：從路的中段挑幾格（不挑頭尾），要用鎬敲開；可以連成一段。
  for (let placed = 0, tries = 0; placed < blocksOn(layer) && tries < 1000; tries += 1) {
    const at = 3 + Math.floor(rand() * (corridor.length - 6));
    const [bx, by] = corridor[at]!;
    if (grid[by]![bx] === '.') {
      grid[by]![bx] = 'r';
      placed += 1;
    }
  }
  // 礦石：只會長在石頭上。
  const chance = oreChance(layer);
  for (let cy = 1; cy < height - 1; cy += 1) {
    for (let cx = 1; cx < width - 1; cx += 1) {
      if (grid[cy]![cx] === 'r' && rand() < chance) grid[cy]![cx] = 'o';
    }
  }

  grid[upRow]![width - 2] = '<';
  if (!lastFloor) grid[downRow]![1] = '>';
  const legend: MapDef['legend'] = {
    '#': { kind: 'wall' },
    r: { kind: 'rock' },
    o: { kind: 'ore' },
    '.': { kind: 'path' },
    '<': {
      kind: 'stairs',
      to: layer === 1 ? 'mine-entrance' : mineId(layer - 1),
      spawn: layer === 1 ? { x: 7, y: 2 } : { x: 2, y: stairRow(layer - 1, seed) },
    },
  };
  if (!lastFloor) legend['>'] = { kind: 'stairs', to: mineId(layer + 1), spawn: { x: width - 3, y: downRow } };
  return {
    id: mineId(layer),
    name: `礦坑第 ${layer} 層`,
    width,
    height,
    rows: grid.map((row) => row.join('')),
    legend,
    spawn: { x: width - 3, y: upRow },
    npcs: [],
  };
}
