import type { GameState } from '../domain/game-state';
import { removeItem } from '../domain/inventory';
import { fail, ok, type Result } from '../domain/result';
import { donationRefusal, goalMet, recordDonation, recordOf, seasonOpen } from '../domain/repairs';
import type { ContentIndex } from './content-index';

/**
 * 社區修復的用例（M5d）：捐獻與完成。規則在 domain/repairs.ts，內容在 content/repairs.json。
 * 捐獻不花體力與時間；物品不夠或規則不允許時什麼都不改。
 */

export interface RepairOutcome {
  state: GameState;
  messages: string[];
}

/**
 * 捐一批物品給目前季節的修復。物品從背包拿走、進度記在今年的紀錄裡；
 * 目標達到時發獎勵（金幣與旗標），之後同一年不再收。
 */
export function donateToRepair(state: GameState, repairId: string, itemId: string, count: number, index: ContentIndex): Result<RepairOutcome, string> {
  const def = index.repairs.find((r) => r.id === repairId);
  if (!def) return fail('NO_REPAIR');
  if (!seasonOpen(def, state.calendar)) return fail('REPAIR_CLOSED');

  const record = recordOf(state.repairs, def.id, state.calendar.year);
  const refused = donationRefusal(def, record, itemId, count);
  if (refused) return fail(refused);
  const taken = removeItem(state.inventory, itemId, count);
  if (!taken.ok) return fail('NO_MATERIAL');

  let next = recordDonation(record, itemId, count);
  let current: GameState = { ...state, inventory: taken.value };
  const messages = [`捐出了 ${index.item(itemId).name} × ${count}`];
  if (goalMet(def.goal, next.donated)) {
    next = { ...next, done: true };
    current = grantRepairReward(current, def.reward);
    messages.push(`修復完成：${def.name}`, def.done);
    if (def.reward.gold) messages.push(`委員會給了 ${def.reward.gold} 金`);
  }
  current = { ...current, repairs: { ...current.repairs, [def.id]: next } };
  return ok({ state: current, messages });
}

function grantRepairReward(state: GameState, reward: { gold?: number; flags?: string[] }): GameState {
  let next: GameState = { ...state, gold: state.gold + (reward.gold ?? 0) };
  for (const flag of reward.flags ?? []) next = { ...next, flags: { ...next.flags, [flag]: true } };
  return next;
}
