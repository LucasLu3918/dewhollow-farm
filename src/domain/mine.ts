import type { MapDef } from './content';
import { advanceRng } from './random';

/**
 * 礦坑：逐層以種子程序生成（同一層、同一個種子永遠長一樣）。
 * 每層是一張 40×16 的地圖：左邊有下樓的梯子 '>'，右邊有上樓的梯子 '<'，中間是隨機游走挖出來的路。
 * 路上有幾道落石牆（整欄的石頭，數量見 blocksOn），每一道都要用鎬敲開一塊才能往下；其餘的石頭與礦石都可以敲掉。
 * 上下層的樓梯位置對齊（見 stairRow），敲得開的話每一層都走得到下一層，所以不會把玩家鎖在礦坑裡。
 */

export const MINE_DEPTH = 40;
export const MINE_WIDTH = 40;
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

/**
 * 路上的落石牆數：每層多 2 道，最多 MAX_BLOCKS 道（這是深度的閘門，見 domain/mine.spec.ts）。
 * 牆只排在第 3 到 MINE_WIDTH-4 欄，兩端的欄留給樓梯與走廊頭尾，所以上限是 MINE_WIDTH-6。
 * 模擬（npm run sim）的校準：第 20 層約在第 38 天（夏末）。
 */
export const MAX_BLOCKS = MINE_WIDTH - 6;

export function blocksOn(layer: number): number {
  return Math.min(MAX_BLOCKS, 2 + 2 * layer);
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
  // 落石牆：在 3 到 width-4 的欄裡挑 blocksOn(layer) 欄，整欄（上下牆之間）都變成石頭。
  // 整欄都是石頭，走廊與房間都無法從旁邊跨過，所以旁路繞不過去；從右邊走到左邊，每一道牆至少要敲開一塊。
  const wallColumns: number[] = [];
  for (let x = 3; x <= width - 4; x += 1) wallColumns.push(x);
  for (let i = wallColumns.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [wallColumns[i], wallColumns[j]] = [wallColumns[j]!, wallColumns[i]!];
  }
  for (const wx of wallColumns.slice(0, blocksOn(layer))) {
    for (let y = 1; y < height - 1; y += 1) grid[y]![wx] = 'r';
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
