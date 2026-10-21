import { advanceMinutes, formatClock, sleepUntilMorning } from '../domain/calendar';
import type { Direction, MapDef, MapNpcPlacement } from '../domain/content';
import { trySpend, restore } from '../domain/energy';
import { growCrops, harvestPlot, isRipe, plantCrop, plotKey, tillPlot, waterPlot, type PlotMap } from '../domain/farm';
import { TOOL_ORDER, type GameState } from '../domain/game-state';
import { addItem, removeItem, takeMatching } from '../domain/inventory';
import { cropItemId, seedItemId } from '../domain/items';
import { fail, ok, type Result } from '../domain/result';
import { settleShipBox, shipStack } from '../domain/shipping';
import { rollInt } from '../domain/random';
import { priceWithQuality } from '../domain/pricing';
import { isWalkable, neighbor, tileAt } from '../domain/world';
import type { ActionKind } from '../domain/tuning';
import type { ContentIndex } from './content-index';

export type Command =
  | { type: 'move'; direction: Direction }
  | { type: 'interact' }
  | { type: 'cycleTool' }
  | { type: 'cycleSeed' }
  | { type: 'manualSave' };

export type GameEvent =
  | { type: 'slept' }
  | { type: 'enteredMap'; mapId: string }
  | { type: 'saveRequested' }
  /** 玩家跟某位居民說話（不論是否領到禮物）；供畫面讓該居民與他的夥伴做出反應。 */
  | { type: 'talked'; npcId: string }
  /** 成功的農務或出貨動作，供畫面播放效果；失敗的動作不會發出。 */
  | { type: 'acted'; action: ActionFeedback; x: number; y: number };

export type ActionFeedback = 'till' | 'water' | 'plant' | 'harvest' | 'ship';

export interface CommandOutcome {
  state: GameState;
  /** 要顯示給玩家的文字，依序呈現。 */
  messages: string[];
  events: GameEvent[];
}

const FAILURE_MESSAGES: Record<string, string> = {
  NOT_ENOUGH_ENERGY: '體力不足，請回家睡覺',
  ALREADY_TILLED: '這塊田已經開墾過了',
  NO_SOIL: '這塊地還沒開墾',
  ALREADY_PLANTED: '這塊田已經種了作物',
  NO_CROP: '這裡沒有作物',
  NOT_RIPE: '作物還沒成熟',
  NO_SEED: '種子袋裡沒有這種種子',
  BAG_FULL: '背包已滿',
};

const NOTHING_HERE = '這裡沒有可以互動的東西';

function reply(state: GameState, messages: string[] = [], events: GameEvent[] = []): CommandOutcome {
  return { state, messages, events };
}

export function executeCommand(state: GameState, command: Command, index: ContentIndex): CommandOutcome {
  switch (command.type) {
    case 'move':
      return move(state, command.direction, index);
    case 'interact':
      return interact(state, index);
    case 'cycleTool': {
      const i = TOOL_ORDER.indexOf(state.tool);
      return reply({ ...state, tool: TOOL_ORDER[(i + 1) % TOOL_ORDER.length] ?? 'hoe' });
    }
    case 'cycleSeed': {
      const ids = index.cropIds();
      const i = ids.indexOf(state.selectedSeed);
      return reply({ ...state, selectedSeed: ids[(i + 1) % ids.length] ?? state.selectedSeed });
    }
    case 'manualSave':
      return reply(state, [], [{ type: 'saveRequested' }]);
  }
}

function move(state: GameState, direction: Direction, index: ContentIndex): CommandOutcome {
  const facing = { ...state.player, facing: direction };
  const map = index.map(state.mapId);
  const target = neighbor(state.player, direction);
  const tile = tileAt(map, target.x, target.y);

  if (!tile || npcAt(map, target.x, target.y) || !isWalkable(tile.kind)) {
    return reply({ ...state, player: facing });
  }

  if (tile.kind === 'door' && tile.to) {
    const destination = index.map(tile.to);
    const spawn = tile.spawn ?? destination.spawn;
    return reply(
      { ...state, mapId: destination.id, player: { ...spawn, facing: direction } },
      [],
      [{ type: 'enteredMap', mapId: destination.id }],
    );
  }

  return reply({ ...state, player: { x: target.x, y: target.y, facing: direction } });
}

function interact(state: GameState, index: ContentIndex): CommandOutcome {
  const map = index.map(state.mapId);
  const target = neighbor(state.player, state.player.facing);
  const npc = npcAt(map, target.x, target.y);
  if (npc) return talk(state, npc, index);

  const tile = tileAt(map, target.x, target.y);
  if (!tile) return reply(state, [NOTHING_HERE]);

  if (tile.kind === 'bed') return sleep(state, index);
  if (tile.kind === 'shipbox') return shipAll(state, index);

  const key = plotKey(target.x, target.y);
  if (tile.kind === 'field' || state.plots[key]) return workPlot(state, key, index);
  return reply(state, [NOTHING_HERE]);
}

function npcAt(map: MapDef, x: number, y: number): MapNpcPlacement | undefined {
  return map.npcs.find((n) => n.x === x && n.y === y);
}

/**
 * 先執行純規則檢查，成功後才扣體力並前進時間。
 * 失敗時完全不改變狀態，也不耗時間。
 */
function spendThen(
  state: GameState,
  action: ActionKind,
  index: ContentIndex,
  apply: (s: GameState) => Result<GameState, string>,
): Result<GameState, string> {
  const applied = apply(state);
  if (!applied.ok) return applied;
  const energy = trySpend(state.energy, index.tuning.energy.costs[action]);
  if (!energy.ok) return fail('NOT_ENOUGH_ENERGY');
  return ok({
    ...applied.value,
    energy: energy.value,
    calendar: advanceMinutes(applied.value.calendar, index.tuning.time.minutesPerAction),
  });
}

function workPlot(state: GameState, key: string, index: ContentIndex): CommandOutcome {
  const plot = state.plots[key];
  const crop = plot?.crop;

  if (crop && isRipe(crop, index.crop(crop.cropId).growthDays)) {
    const cropDef = index.crop(crop.cropId);
    let yielded = 0;
    const result = spendThen(state, 'harvest', index, (s) => {
      const harvested = harvestPlot(s.plots, key, cropDef.growthDays);
      if (!harvested.ok) return fail(harvested.reason);
      const roll = rollInt(s.rng, index.tuning.harvest.min, index.tuning.harvest.max);
      const stored = addItem(s.inventory, index.item(cropItemId(harvested.value.cropId)), roll.value);
      if (!stored.ok) return fail(stored.reason);
      yielded = roll.value;
      return ok({ ...s, plots: harvested.value.plots, inventory: stored.value, rng: roll.rng });
    });
    return finish(state, result, `收成了 ${cropDef.name} × ${yielded}`, { action: 'harvest', key });
  }

  if (state.tool === 'hoe') {
    const result = spendThen(state, 'till', index, (s) => {
      const tilled = tillPlot(s.plots, key);
      return tilled.ok ? ok({ ...s, plots: tilled.value }) : fail(tilled.reason);
    });
    return finish(state, result, '開墾了一塊田', { action: 'till', key });
  }

  if (!plot) return reply(state, [messageFor('NO_SOIL')]);

  if (state.tool === 'can') {
    const result = spendThen(state, 'water', index, (s) => {
      const watered = waterPlot(s.plots, key);
      return watered.ok ? ok({ ...s, plots: watered.value }) : fail(watered.reason);
    });
    return finish(state, result, '澆了水', { action: 'water', key });
  }

  const seedName = index.crop(state.selectedSeed).name;
  const result = spendThen(state, 'plant', index, (s) => {
    const seeds = removeItem(s.inventory, seedItemId(s.selectedSeed), 1);
    if (!seeds.ok) return fail('NO_SEED');
    const planted = plantCrop(s.plots, key, s.selectedSeed);
    if (!planted.ok) return fail(planted.reason);
    return ok({ ...s, inventory: seeds.value, plots: planted.value });
  });
  return finish(state, result, `播下了 ${seedName} 種子`, { action: 'plant', key });
}

/** 成功才發出 acted 事件，失敗只回傳原因，狀態與時間都不變。 */
function finish(
  state: GameState,
  result: Result<GameState, string>,
  successMessage: string,
  feedback?: { action: ActionFeedback; key: string },
): CommandOutcome {
  if (!result.ok) return reply(state, [messageFor(result.reason)]);
  const events: GameEvent[] = [];
  if (feedback) {
    const [x, y] = feedback.key.split(',').map(Number);
    events.push({ type: 'acted', action: feedback.action, x: x ?? 0, y: y ?? 0 });
  }
  return reply(result.value, [successMessage], events);
}

function messageFor(reason: string): string {
  return FAILURE_MESSAGES[reason] ?? reason;
}

function shipAll(state: GameState, index: ContentIndex): CommandOutcome {
  const { inventory, taken } = takeMatching(state.inventory, (stack) => index.item(stack.itemId).sellPrice !== undefined);
  if (taken.length === 0) return reply(state, ['背包裡沒有可出貨的作物']);

  const result = spendThen(state, 'ship', index, (s) => {
    let box = s.shipBox;
    for (const stack of taken) box = shipStack(box, stack);
    return ok({ ...s, inventory, shipBox: box });
  });
  const box = neighbor(state.player, state.player.facing);
  return finish(state, result, '把作物放進了出貨箱', { action: 'ship', key: `${box.x},${box.y}` });
}

function talk(state: GameState, placement: MapNpcPlacement, index: ContentIndex): CommandOutcome {
  const npc = index.npc(placement.npcId);
  const firstTime = !state.flags[`talked:${npc.id}`];
  const talked: GameEvent[] = [{ type: 'talked', npcId: npc.id }];
  if (!firstTime) return reply(state, [npc.lines.at(-1) ?? ''], talked);

  const messages = [...npc.lines];
  let next: GameState = { ...state, flags: { ...state.flags, [`talked:${npc.id}`]: true } };
  if (npc.gift) {
    const seed = index.item(seedItemId(npc.gift.cropId));
    const stored = addItem(next.inventory, seed, npc.gift.count);
    // 背包放不下時不標記「已對話」，讓玩家整理後還能領到禮物。
    if (!stored.ok) return reply(state, [...messages, '背包已滿，先整理一下再來領禮物'], talked);
    next = { ...next, inventory: stored.value };
    messages.push(`獲得 ${seed.name} × ${npc.gift.count}`);
  }
  return reply(next, messages, talked);
}

function sleep(state: GameState, index: ContentIndex): CommandOutcome {
  const growth = growCrops(state.plots, (id) => index.crop(id).growthDays);
  const plots: PlotMap = growth.plots;
  const settled = settleShipBox(state.shipBox, (itemId, quality) =>
    priceWithQuality(index.item(itemId).sellPrice ?? 0, quality),
  );
  const calendar = sleepUntilMorning(state.calendar, index.tuning.time.wakeMinute);
  const next: GameState = {
    ...state,
    calendar,
    plots,
    gold: state.gold + settled.gold,
    shipBox: settled.box,
    energy: restore(state.energy),
  };
  const messages = [`你睡了一覺。第 ${calendar.day} 天 ${formatClock(calendar)}`];
  if (settled.gold > 0) messages.push(`出貨箱結算 +${settled.gold} 金`);
  if (growth.withered.length > 0) {
    const names = growth.withered.map((id) => index.crop(id).name).join('、');
    messages.push(`缺水，${names} 枯死了`);
  }
  return reply(next, messages, [{ type: 'slept' }]);
}

