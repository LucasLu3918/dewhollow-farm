import { levelOf, SKILL_IDS, SKILL_NAMES, type SkillId } from '../../src/domain/skills';
import { isRipe, plotKey } from '../../src/domain/farm';
import { countOf } from '../../src/domain/inventory';
import { mineId, mineLayerOf, MINE_DEPTH } from '../../src/domain/mine';
import { createNewGame, type GameState } from '../../src/domain/game-state';
import { takeReady } from '../../src/domain/processing';
import { totalDay } from '../../src/domain/calendar';
import { changeAt } from '../../src/domain/world-changes';
import { waters } from '../../src/domain/weather';
import type { ContentIndex } from '../../src/application/content-index';
import { Bot, SECONDS_PER_ACTION, SECONDS_PER_STEP } from './bot';
import { isMineMap, kindAt, mapOrNull, passable, tilesWhere, type Pos } from './world';
import { tileAt } from '../../src/domain/world';
import type { MapDef } from '../../src/domain/content';
import { shippedIndex, shippedPack } from './shipped-content';

/**
 * 固定策略的無頭玩家（見 docs/TECH_PLAN.md「遊玩時數模擬」）：每天種收、買賣、養雞、加工、
 * 採集、挖礦、釣魚，然後睡覺。策略刻意簡單：目的是量出內容的節奏，不是找最佳解。
 */

/**
 * 各活動停手的體力下限（每天的體力分配）：農場最多用 40 點，其餘各自有配額，
 * 不然農場的收益會把其他活動整個擠掉（這正是要量的平衡問題）。
 */
const FLOOR = { farm: 60, pasture: 30, forest: 40, mine: 20, lake: 8 } as const;

export interface DayRecord {
  day: number;
  season: string;
  gold: number;
  actions: number;
  steps: number;
  spent: number;
  shipped: number;
  deepest: number;
  levels: Record<SkillId, number>;
  tiers: Record<string, number>;
  /** 雞舍的雞數。 */
  animals: number;
  /** 牛舍的牛數。 */
  cows: number;
  /** 當天結束時，估計累計的真實遊玩分鐘。 */
  minutes: number;
  refusals: Record<string, number>;
}

export interface Milestone {
  label: string;
  day: number;
  minutes: number;
}

export interface SimResult {
  days: DayRecord[];
  milestones: Milestone[];
  finalState: GameState;
  /** 連續卡住（走不到床）時停下的天數位置；正常跑完為 null。 */
  stuckAt: number | null;
}

export function simulate(totalDays: number, seed = 7, index: ContentIndex = shippedIndex): SimResult {
  const state = createNewGame(shippedPack, seed);
  for (let layer = 1; layer <= MINE_DEPTH; layer += 1) index.ensureMine(layer, state.mineSeed);
  const bot = new Bot(index, state);
  const days: DayRecord[] = [];
  const milestones: Milestone[] = [];
  const seen = new Set<string>();
  let minutes = 0;
  let actionsTotal = 0;
  let stepsTotal = 0;

  let stuck = 0;
  for (let round = 0; round < totalDays; round += 1) {
    const dayBefore = totalDay(bot.state.calendar, index.tuning.time.daysPerSeason);
    playDay(bot, index);
    // 沒能睡覺（走不到床）就不算一天；連續卡住就停下，報告會標出來。
    stuck = totalDay(bot.state.calendar, index.tuning.time.daysPerSeason) === dayBefore ? stuck + 1 : 0;
    if (stuck >= 3) break;
    const stats = bot.stats;
    actionsTotal += stats.actions;
    stepsTotal += stats.steps;
    minutes = (actionsTotal * SECONDS_PER_ACTION + stepsTotal * SECONDS_PER_STEP) / 60;
    const s = bot.state;
    const record: DayRecord = {
      day: totalDay(s.calendar, index.tuning.time.daysPerSeason),
      season: s.calendar.season,
      gold: s.gold,
      actions: stats.actions,
      steps: stats.steps,
      spent: stats.spent,
      shipped: stats.shipped,
      deepest: stats.deepest,
      levels: Object.fromEntries(SKILL_IDS.map((id) => [id, levelOf(s.skills[id], index.tuning.skills.thresholds)])) as Record<SkillId, number>,
      tiers: { ...s.toolTiers },
      animals: s.animals.length,
      cows: s.cows.length,
      minutes,
      refusals: { ...stats.refusals },
    };
    days.push(record);
    for (const milestone of milestonesOf(s, record, index)) {
      if (seen.has(milestone)) continue;
      seen.add(milestone);
      milestones.push({ label: milestone, day: record.day, minutes: round2(minutes) });
    }
    stats.actions = 0;
    stats.steps = 0;
    stats.shipped = 0;
    stats.spent = 0;
    stats.refusals = {};
  }
  return { days, milestones, finalState: bot.state, stuckAt: stuck >= 3 ? days.length : null };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 這一天結束時達成的里程碑（只看狀態，不看過程）。 */
function milestonesOf(s: GameState, record: DayRecord, index: ContentIndex): string[] {
  const out: string[] = [];
  if (record.gold >= 300 || s.animals.length > 0) out.push('金幣 300 或買到雞');
  if (s.animals.length > 0) out.push('第一隻雞');
  if (s.flags.cowbarn) out.push('牛舍改建');
  if (s.cows.length > 0) out.push('第一頭牛');
  if (record.day >= 15) out.push('牧草地開放（春 15）');
  // 牛奶擠出來當天就會放進加工機（或出貨），所以用加工機的紀錄判斷乳製品的第一批。
  if (s.processing.some((job) => job.recipeId === 'cheese' || job.recipeId === 'butter')) out.push('第一批乳製品加工');
  for (const tool of ['hoe', 'can', 'axe', 'pick'] as const) {
    if (s.toolTiers[tool] >= 1) out.push(`${tool} 銅級`);
    if (s.toolTiers[tool] >= 2) out.push(`${tool} 銀級`);
  }
  if (record.deepest >= 5) out.push('礦坑第 5 層');
  if (record.deepest >= 10) out.push('礦坑第 10 層');
  if (record.deepest >= 20) out.push('礦坑第 20 層');
  for (const id of SKILL_IDS) {
    const level = levelOf(s.skills[id], index.tuning.skills.thresholds);
    if (level >= 5) out.push(`${SKILL_NAMES[id]} 5 級`);
  }
  if (s.inventory.stacks.some((st) => index.item(st.itemId).kind === 'processed')) out.push('第一份加工品');
  if (s.gold >= 1000) out.push('金幣 1000');
  if (s.flags.sprinkler) out.push('灑水器（合成）');
  if (s.inventory.capacity > index.tuning.inventory.capacity) out.push('木箱（合成）');
  if (s.inventory.stacks.some((st) => st.itemId.startsWith('fertilizer-'))) out.push('肥料（合成）');
  if (s.flags.bobber) out.push('浮標（合成）');
  return out;
}

// ---- 一天的行程 ----

function playDay(bot: Bot, index: ContentIndex): void {
  farmWork(bot, index);
  villageTrip(bot, index);
  coopCare(bot, index);
  cowCare(bot, index);
  pastureWork(bot, index);
  forestWork(bot, index);
  mineWork(bot, index);
  lakeWork(bot, index);
  houseWork(bot, index);
  shipping(bot, index);
  sleep(bot, index);
}

function plotTargets(s: GameState, mapId: string, pred: (key: string) => boolean): Pos[] {
  const out: Pos[] = [];
  for (const key of Object.keys(s.plots)) {
    const [x, y] = key.split(',').map(Number);
    if (x === undefined || y === undefined || !pred(key)) continue;
    out.push({ mapId, x, y });
  }
  return out;
}

function inSeason(index: ContentIndex, cropId: string, season: string): boolean {
  return index.crop(cropId).seasons.includes(season as never);
}

/** 本季能種、又買得到種子的作物中，每天每格利潤最高的那一種。 */
function bestCrop(index: ContentIndex, s: GameState): string | null {
  let best: { id: string; value: number } | null = null;
  for (const crop of index.cropIds()) {
    if (!inSeason(index, crop, s.calendar.season)) continue;
    const def = index.crop(crop);
    const sell = index.item(`crop.${crop}`).sellPrice ?? 0;
    const value = (sell - def.seedPrice) / def.growthDays;
    if (!best || value > best.value) best = { id: crop, value };
  }
  return best?.id ?? null;
}

function farmWork(bot: Bot, index: ContentIndex): void {
  const farm = 'farm';
  const map = index.map(farm);
  const growth = (cropId: string) => index.crop(cropId).growthDays;

  // 收成：成熟的作物（任何工具都能收）。
  for (let guard = 0; guard < 200 && bot.state.energy.current > FLOOR.farm; guard += 1) {
    const ripe = plotTargets(bot.state, farm, (key) => {
      const crop = bot.state.plots[key]?.crop;
      return !!crop && isRipe(crop, growth(crop.cropId));
    });
    if (ripe.length === 0 || !bot.actOn(ripe, { type: 'interact' })) break;
  }

  // 播種：先開墾（只開需要的數量），再種本季最划算的作物。
  const crop = bestCrop(index, bot.state);
  if (crop) {
    const seedItem = `seed.${crop}`;
    const empty = tilesWhere(bot.state, map, (kind, _t, x, y) => kind === 'field' && !bot.state.plots[plotKey(x, y)]).length;
    const seeds = countOf(bot.state.inventory, seedItem);
    const tilledEmpty = Object.values(bot.state.plots).filter((p) => !p.crop).length;
    const need = Math.min(seeds - tilledEmpty, empty);
    if (need > 0 && seeds > 0) {
      bot.useTool('hoe');
      for (let i = 0; i < need && bot.state.energy.current > FLOOR.farm; i += 1) {
        const field = tilesWhere(bot.state, map, (kind, _t, x, y) => kind === 'field' && !bot.state.plots[plotKey(x, y)]);
        if (!bot.actOn(field, { type: 'interact' })) break;
      }
    }
    if (countOf(bot.state.inventory, seedItem) > 0) {
      for (let i = 0; i < 12 && bot.state.selectedSeed !== crop; i += 1) bot.apply({ type: 'cycleSeed' });
      bot.useTool('seedbag');
      for (let guard = 0; guard < 200 && bot.state.energy.current > FLOOR.farm && countOf(bot.state.inventory, seedItem) > 0; guard += 1) {
        const bare = plotTargets(bot.state, farm, (key) => !bot.state.plots[key]?.crop);
        if (bare.length === 0 || !bot.actOn(bare, { type: 'interact' })) break;
      }
    }
  }

  // 澆水：沒下雨時，有作物的田才需要澆。
  if (!waters(bot.state.weather)) {
    const dry = plotTargets(bot.state, farm, (key) => {
      const plot = bot.state.plots[key];
      return !!plot?.crop && !plot.watered;
    });
    if (dry.length > 0) bot.useTool('can');
    for (let guard = 0; guard < 200 && bot.state.energy.current > FLOOR.farm; guard += 1) {
      const todo = plotTargets(bot.state, farm, (key) => {
        const plot = bot.state.plots[key];
        return !!plot?.crop && !plot.watered;
      });
      if (todo.length === 0 || !bot.actOn(todo, { type: 'interact' })) break;
    }
  }
}

/** 村莊：雜貨店買種子與乾草、買雞；鐵匠依序升級。 */
function villageTrip(bot: Bot, index: ContentIndex): void {
  const village = mapOrNull(index, 'village');
  if (!village) return;
  const counters = (shopId: string) => tilesWhere(bot.state, village, (_k, t) => t.kind === 'shop' && t.shop === shopId);
  const general = index.shop('general');
  const crop = bestCrop(index, bot.state);
  const emptyPlots = tilesWhere(bot.state, index.map('farm'), (kind, _t, x, y) => kind === 'field' && !bot.state.plots[plotKey(x, y)]).length;
  const wantSeeds = crop && emptyPlots > 0 ? Math.min(emptyPlots, 54) - countOf(bot.state.inventory, `seed.${crop}`) : 0;

  const toBuy = { seed: 0, hay: 0, chicken: 0 };
  if (crop && wantSeeds > 0) {
    const line = general.stock.find((l) => l.itemId === `seed.${crop}`);
    if (line) toBuy.seed = Math.min(wantSeeds, Math.floor(bot.state.gold / line.price));
  }
  const hayPrice = general.stock.find((l) => l.itemId === 'hay')?.price ?? 0;
  // 每座有動物的建築（雞舍、牛舍）每天要一包乾草。
  const barns = (bot.state.animals.length > 0 ? 1 : 0) + (bot.state.cows.length > 0 ? 1 : 0);
  if (barns > 0 && countOf(bot.state.inventory, 'hay') < 2 && hayPrice > 0) toBuy.hay = 2;
  const chickenLine = general.stock.find((l) => l.itemId === 'animal.chicken');
  const seats = bot.state.animals.length < 3 && chickenLine && bot.state.gold >= chickenLine.price + 20;
  if (seats) toBuy.chicken = 1;

  if (toBuy.seed > 0 && crop) bot.actOn(counters('general'), { type: 'buy', shopId: 'general', itemId: `seed.${crop}`, count: toBuy.seed });
  if (toBuy.hay > 0) bot.actOn(counters('general'), { type: 'buy', shopId: 'general', itemId: 'hay', count: toBuy.hay });
  if (toBuy.chicken > 0) bot.actOn(counters('general'), { type: 'buy', shopId: 'general', itemId: 'animal.chicken', count: 1 });

  // 牛舍：金幣夠了就改建（只做一次），改建後再買牛，直到座位滿（座位數由牛舍地圖決定）。
  const remodel = general.stock.find((l) => l.itemId === 'building.cowbarn');
  if (remodel && !bot.state.flags.cowbarn && bot.state.gold >= remodel.price + COW_RESERVE) {
    bot.actOn(counters('general'), { type: 'buy', shopId: 'general', itemId: 'building.cowbarn', count: 1 });
  }
  const cowLine = general.stock.find((l) => l.itemId === 'animal.cow');
  const barnSeats = tilesWhere(bot.state, index.map('cowbarn'), (_k, t) => !!t.slot).length;
  if (cowLine && bot.state.flags.cowbarn && bot.state.cows.length < barnSeats && bot.state.gold >= cowLine.price + COW_RESERVE) {
    bot.actOn(counters('general'), { type: 'buy', shopId: 'general', itemId: 'animal.cow', count: 1 });
  }

  // 鐵匠：依序升級（只在材料與金幣都夠時才去櫃檯前，免得白走）。
  const smithy = index.shop('smithy');
  for (let guard = 0; guard < 12; guard += 1) {
    const next = smithy.upgrades.find((u) => bot.state.toolTiers[u.toolId] === u.tier - 1);
    if (!next) break;
    const affordable = bot.state.gold >= next.gold && Object.entries(next.items).every(([id, n]) => countOf(bot.state.inventory, id) >= n);
    if (!affordable) break;
    if (!bot.actOn(counters('smithy'), { type: 'upgrade', shopId: 'smithy', toolId: next.toolId })) break;
  }
}

function coopCare(bot: Bot, index: ContentIndex): void {
  if (bot.state.animals.length === 0) return;
  const coop = mapOrNull(index, 'coop');
  if (!coop) return;
  if (countOf(bot.state.inventory, 'hay') > 0) {
    const trough = tilesWhere(bot.state, coop, (kind) => kind === 'trough');
    bot.actOn(trough, { type: 'interact' });
  }
  const seats = tilesWhere(bot.state, coop, (_k, t) => !!t.slot);
  seats.slice(0, bot.state.animals.length).forEach((seat) => bot.actOn([seat], { type: 'interact' }));
}

/** 牛舍：先餵乾草（乾草槽），再逐頭牛先摸一下、再擠奶（每天一次）。牛沒吃飽時擠不出奶，所以順序不能反。 */
function cowCare(bot: Bot, index: ContentIndex): void {
  if (bot.state.cows.length === 0) return;
  const barn = mapOrNull(index, 'cowbarn');
  if (!barn) return;
  if (countOf(bot.state.inventory, 'hay') > 0) {
    bot.actOn(tilesWhere(bot.state, barn, (kind) => kind === 'trough'), { type: 'interact' });
  }
  const seats = tilesWhere(bot.state, barn, (_k, t) => !!t.slot);
  seats.slice(0, bot.state.cows.length).forEach((seat) => {
    bot.actOn([seat], { type: 'interact' }); // 摸
    bot.actOn([seat], { type: 'interact' }); // 擠（已餵飽才會成功）
  });
}

/** 牧草地：有牛時割牧草得乾草（用鐮刀，體力沿用砍樹的基礎值）；乾草夠了就不去割。 */
function pastureWork(bot: Bot, index: ContentIndex): void {
  if (bot.state.cows.length === 0) return;
  const pasture = mapOrNull(index, 'pasture');
  if (!pasture) return;
  const enough = 4;
  if (countOf(bot.state.inventory, 'hay') >= enough) return;
  bot.useTool('sickle');
  for (let guard = 0; guard < 60 && bot.state.energy.current > FLOOR.pasture && countOf(bot.state.inventory, 'hay') < enough; guard += 1) {
    const tufts = tilesWhere(bot.state, pasture, (kind) => kind === 'tuft');
    if (tufts.length === 0 || !bot.actOn(tufts, { type: 'interact' })) break;
  }
}

function forestWork(bot: Bot, index: ContentIndex): void {
  const forest = index.map('forest');
  const forage = tilesWhere(bot.state, forest, (kind) => kind === 'forage');
  for (const spot of forage) {
    if (bot.state.energy.current <= FLOOR.forest) break;
    bot.actOn([spot], { type: 'interact' });
  }
  bot.useTool('axe');
  for (let guard = 0; guard < 300 && bot.state.energy.current > FLOOR.forest; guard += 1) {
    const trees = tilesWhere(bot.state, forest, (kind) => kind === 'tree');
    if (trees.length === 0 || !bot.actOn(trees, { type: 'interact' })) break;
  }
}

/** 礦坑：從入口（或已經在礦坑）開始，挖到可達的石頭與礦石都清完就往下一層。 */
function mineWork(bot: Bot, index: ContentIndex): void {
  const entranceMap = index.map('mine-entrance');
  for (let guard = 0; guard < 400 && bot.state.energy.current > FLOOR.mine; guard += 1) {
    if (!isMineMap(bot.state.mapId)) {
      const caves = tilesWhere(bot.state, entranceMap, (_k, t) => t.kind === 'cave');
      if (caves.length === 0) return;
      const cleared = caves.some((c) => changeAt(bot.state.worldChanges, c.mapId, c.x, c.y) === 'cleared');
      if (!cleared) {
        bot.useTool('pick');
        if (!bot.actOn(caves, { type: 'interact' })) return;
      }
      if (!bot.goTo((mapId) => isMineMap(mapId))) return;
      continue;
    }
    // 往下的樓梯走得到就直接下去（以深度為目標）；走不到就挖最近的石頭或礦石，把路挖通。
    const layer = mineLayerOf(bot.state.mapId) ?? 1;
    const below = mineId(layer + 1);
    if (layer < MINE_DEPTH && bot.goTo((mapId) => mapId === below)) continue;
    // 挖向下樓梯：沿著「敲最少石頭」的路線，先敲路上第一塊石頭。
    const map = index.map(bot.state.mapId);
    const down = tilesWhere(bot.state, map, (_k, t) => t.kind === 'stairs' && t.to === below)[0];
    if (!down) return;
    const next = nextDig(bot.state, map, down);
    if (!next) return;
    bot.useTool('pick');
    if (!bot.actOn([next], { type: 'interact' })) return;
  }
}

/**
 * 從玩家到 goal 敲最少石頭的路（Dijkstra，走路 0、石頭與礦石 1）：回傳路上最先遇到的那一塊石頭。
 * 沒有石頭擋路、或走得到，回傳 null。
 */
function nextDig(state: GameState, map: MapDef, goal: Pos): Pos | null {
  const size = map.width * map.height;
  const cost = new Array<number>(size).fill(Number.POSITIVE_INFINITY);
  const prev = new Array<number>(size).fill(-1);
  const isRock = new Array<boolean>(size).fill(false);
  const open = new Array<boolean>(size).fill(false);
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = tileAt(map, x, y);
      if (!tile) continue;
      const kind = kindAt(state, map.id, x, y, tile);
      const i = y * map.width + x;
      if (kind === 'rock' || kind === 'ore') {
        isRock[i] = true;
        open[i] = true;
      } else {
        open[i] = passable(state, map, x, y) || (kind === 'stairs');
      }
    }
  }
  const start = state.player.y * map.width + state.player.x;
  const target = goal.y * map.width + goal.x;
  cost[start] = 0;
  const done = new Array<boolean>(size).fill(false);
  for (;;) {
    let best = -1;
    for (let i = 0; i < size; i += 1) {
      if (!done[i] && Number.isFinite(cost[i] ?? Number.POSITIVE_INFINITY) && (best < 0 || (cost[i] ?? 0) < (cost[best] ?? 0))) best = i;
    }
    if (best < 0 || best === target) break;
    done[best] = true;
    const bx = best % map.width;
    const by = Math.floor(best / map.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = bx + dx;
      const ny = by + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const ni = ny * map.width + nx;
      if (!open[ni] && ni !== target) continue;
      const step = isRock[ni] ? 1 : 0;
      const next = (cost[best] ?? 0) + step;
      if (next < (cost[ni] ?? Number.POSITIVE_INFINITY)) {
        cost[ni] = next;
        prev[ni] = best;
      }
    }
  }
  if (!Number.isFinite(cost[target] ?? Number.POSITIVE_INFINITY)) return null;
  // 從終點往回走，找離玩家最近（路上最先遇到）的那一塊石頭。
  let firstRock: number | null = null;
  for (let i = target; i >= 0 && i !== start; i = prev[i] ?? -1) {
    if (isRock[i]) firstRock = i;
  }
  if (firstRock === null) return null;
  return { mapId: map.id, x: firstRock % map.width, y: Math.floor(firstRock / map.width) };
}

function lakeWork(bot: Bot, index: ContentIndex): void {
  const lake = index.map('lake');
  const water = tilesWhere(bot.state, lake, (kind) => kind === 'water');
  if (water.length === 0) return;
  bot.useTool('rod');
  for (let guard = 0; guard < 200 && bot.state.energy.current > FLOOR.lake; guard += 1) {
    if (!bot.actOn(water, { type: 'interact' })) break;
    if (bot.state.fishing) bot.apply({ type: 'reel', hit: true });
  }
}

/** 小屋：加工機（先收成品再放入）、廚房（做菜、低體力時吃）。 */
function houseWork(bot: Bot, index: ContentIndex): void {
  const house = index.map('house');
  const workshop = tilesWhere(bot.state, house, (kind) => kind === 'workshop');
  if (takeReady(bot.state.processing).ready.length > 0) bot.actOn(workshop, { type: 'collectProcessing' });

  const gain = (id: string) => {
    const recipe = index.processingRecipe(id);
    const sell = index.item(recipe.output).sellPrice ?? 0;
    const input = Object.entries(recipe.ingredients).reduce((sum, [item, n]) => sum + (index.item(item).sellPrice ?? 0) * n, 0);
    return sell - input;
  };
  const cooking = levelOf(bot.state.skills.cooking, index.tuning.skills.thresholds);
  const recipes = [...index.processingRecipes].sort((a, b) => gain(b.id) - gain(a.id));
  for (const recipe of recipes) {
    if (gain(recipe.id) <= 0 || recipe.level > cooking) continue;
    for (let guard = 0; guard < 6; guard += 1) {
      const held = Object.entries(recipe.ingredients).every(([item, n]) => countOf(bot.state.inventory, item) >= n);
      if (!held) break;
      if (!bot.actOn(workshop, { type: 'startProcessing', recipeId: recipe.id })) break;
    }
  }

  // 工作台：能做的合成配方都做（效果型的只做一次；木箱做到上限為止）。
  const bench = tilesWhere(bot.state, house, (kind) => kind === 'workbench');
  for (const recipe of index.craftingRecipes) {
    const unlocked = !recipe.unlock || levelOf(bot.state.skills[recipe.unlock.skill as SkillId], index.tuning.skills.thresholds) >= recipe.unlock.level;
    const held = Object.entries(recipe.ingredients).every(([item, n]) => countOf(bot.state.inventory, item) >= n);
    if (!unlocked || !held) continue;
    if (recipe.effect?.type === 'flag' && bot.state.flags[recipe.effect.flag]) continue;
    bot.actOn(bench, { type: 'craft', recipeId: recipe.id });
  }

  const kitchen = tilesWhere(bot.state, house, (kind) => kind === 'kitchen');
  if (bot.state.energy.current < 40) {
    const dish = index.recipes.find((r) => countOf(bot.state.inventory, `dish.${r.id}`) > 0);
    if (dish) bot.apply({ type: 'eat', itemId: `dish.${dish.id}` });
  }
  for (const recipe of [...index.recipes].sort((a, b) => b.sellPrice - a.sellPrice)) {
    const held = Object.entries(recipe.ingredients).every(([item, n]) => countOf(bot.state.inventory, item) >= n);
    if (!held || recipe.level > cooking || bot.state.energy.current < 50) continue;
    bot.actOn(kitchen, { type: 'cook', recipeId: recipe.id });
  }
}

/** 買牛舍與牛時，金幣要留多少給下一步（種子與乾草）；避免把錢花光。 */
const COW_RESERVE = 200;

/** 留給工具升級的材料不賣（木材、銅礦石）；其餘能賣的全部放進出貨箱（睡覺時結算）。 */
const KEPT_FOR_UPGRADES = new Set(['wood', 'copper-ore']);

function shipping(bot: Bot, index: ContentIndex): void {
  const farm = index.map('farm');
  const box = tilesWhere(bot.state, farm, (kind) => kind === 'shipbox');
  const sellable = bot.state.inventory.stacks.some((st) => index.item(st.itemId).sellPrice !== undefined && !KEPT_FOR_UPGRADES.has(st.itemId));
  if (sellable) bot.actOn(box, { type: 'interact' });
}

function sleep(bot: Bot, index: ContentIndex): void {
  const house = index.map('house');
  const bed = tilesWhere(bot.state, house, (kind) => kind === 'bed');
  bot.actOn(bed, { type: 'interact' });
}
