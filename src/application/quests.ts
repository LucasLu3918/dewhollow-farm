import type { GameState } from '../domain/game-state';
import { totalDay } from '../domain/calendar';
import { boardFor, type BoardState } from '../domain/bulletin';
import { addPoints, heartCapPoints, heartsOf, NO_FRIENDSHIP } from '../domain/friendship';
import { addItem, countOf, removeItem } from '../domain/inventory';
import { deliverableLetters, type LetterDef } from '../domain/mail';
import { advanceQuest, goalMet, goalProgress, NOT_STARTED, unlockMet, type GoalContext, type Progress, type QuestDef, type QuestEvent, type QuestRecord, type UnlockContext } from '../domain/quests';
import { fail, ok, type Result } from '../domain/result';
import type { ContentIndex } from './content-index';

/**
 * 委託與佈告欄、信箱的用例（M5b）。規則在 domain（quests.ts、bulletin.ts、mail.ts），
 * 這裡把規則套到遊戲狀態上：接取、推進、完成與獎勵、今日佈告欄、早上送信、取信。
 */

export interface QuestEntry {
  def: QuestDef;
  /** 委託面板的分區：進行中、今日佈告欄、居民委託。 */
  section: 'active' | 'board' | 'resident';
  /** open 可接取；active 進行中；done 已完成（居民委託只能做一次，佈告欄的可以再接）。 */
  state: 'open' | 'active' | 'done';
  progress: Progress;
  /** 交付型目標：背包裡的東西已經夠，可以交付。 */
  canSubmit: boolean;
}

export function findQuest(index: ContentIndex, questId: string): QuestDef | undefined {
  return index.quests.find((q) => q.id === questId);
}

/** 今天的佈告欄（狀態裡的抽取不是今天的，就現場抽一份；抽法見 bulletin.ts）。 */
export function currentBoard(state: GameState, index: ContentIndex): BoardState {
  return boardFor(index.bulletin, state.board, state.calendar, index.tuning.time.daysPerSeason);
}

function boardIds(board: BoardState): string[] {
  return [...board.daily, ...(board.weekly ? [board.weekly] : [])];
}

function heartsOfNpc(state: GameState, index: ContentIndex, npcId: string): number {
  return heartsOf(state.friendship[npcId]?.points ?? 0, index.friendship);
}

function goalContext(state: GameState, index: ContentIndex): GoalContext {
  return {
    hearts: (npcId) => heartsOfNpc(state, index, npcId),
    itemCount: (itemId) => countOf(state.inventory, itemId),
  };
}

function unlockContext(state: GameState, index: ContentIndex): UnlockContext {
  return {
    hearts: (npcId) => heartsOfNpc(state, index, npcId),
    flags: state.flags,
    heartEvents: state.heartEvents,
    mail: state.mail,
  };
}

/** 委託面板要列的委託：進行中的、今天佈告欄上的、已開放的居民委託（做完的居民委託也列出，標示已完成）。 */
export function questBoardView(state: GameState, index: ContentIndex): QuestEntry[] {
  const onBoard = new Set(boardIds(currentBoard(state, index)));
  const unlocks = unlockContext(state, index);
  const goals = goalContext(state, index);
  const entries: QuestEntry[] = [];
  for (const def of index.quests) {
    const record = state.quests[def.id];
    if (record?.status === 'active') {
      entries.push(entryOf(def, record, 'active', 'active', goals));
    } else if (def.kind === 'resident') {
      const done = record?.status === 'done';
      if (!done && !unlockMet(def.unlock, unlocks)) continue;
      entries.push(entryOf(def, record, 'resident', done ? 'done' : 'open', goals));
    } else if (onBoard.has(def.id)) {
      entries.push(entryOf(def, record, 'board', 'open', goals));
    }
  }
  return entries;
}

function entryOf(def: QuestDef, record: QuestRecord | undefined, section: QuestEntry['section'], state: QuestEntry['state'], goals: GoalContext): QuestEntry {
  const current = record ?? NOT_STARTED;
  return {
    def,
    section,
    state,
    progress: goalProgress(def.goal, current, goals),
    canSubmit: section === 'active' && def.goal.type === 'deliver' && goalMet(def.goal, current, goals),
  };
}

/** 接取委託：居民委託要開放、佈告欄委託要在今天的佈告欄上；做過的居民委託不能再接。不花體力與時間。 */
export function acceptQuest(state: GameState, questId: string, index: ContentIndex): Result<GameState, string> {
  const def = findQuest(index, questId);
  if (!def) return fail('NO_QUEST');
  const record = state.quests[def.id];
  if (record?.status === 'active') return fail('ALREADY_ACCEPTED');
  if (def.kind === 'resident') {
    if (record?.status === 'done') return fail('ALREADY_DONE');
    if (!unlockMet(def.unlock, unlockContext(state, index))) return fail('NOT_OFFERED');
  } else if (!boardIds(currentBoard(state, index)).includes(def.id)) {
    return fail('NOT_ON_BOARD');
  }
  return ok({ ...state, quests: { ...state.quests, [def.id]: { status: 'active' as const, progress: 0, seen: [] } } });
}

/**
 * 把遊戲事件推進所有進行中的委託（收成、出貨、釣魚、烹飪、拜訪、挖礦）。沒有任何委託受影響時回傳同一個狀態。
 */
export function recordQuestEvent(state: GameState, event: QuestEvent, index: ContentIndex): GameState {
  let quests = state.quests;
  for (const [id, record] of Object.entries(state.quests)) {
    if (record.status !== 'active') continue;
    const def = findQuest(index, id);
    if (!def) continue;
    const next = advanceQuest(def.goal, record, event);
    if (next !== record) quests = { ...quests, [id]: next };
  }
  return quests === state.quests ? state : { ...state, quests };
}

/**
 * 自動完成：進行中、目標已達到、而且獎勵放得下的委託（交付型除外，要玩家自己交付）。
 * 背包放不下獎勵時委託保持進行中，騰出空間後的下一個指令會再試一次。
 */
export function settleQuests(state: GameState, index: ContentIndex): { state: GameState; messages: string[] } {
  let current = state;
  const messages: string[] = [];
  for (const def of index.quests) {
    const record = current.quests[def.id];
    if (record?.status !== 'active' || def.goal.type === 'deliver') continue;
    if (!goalMet(def.goal, record, goalContext(current, index))) continue;
    const done = completeQuest(current, def, index);
    if (!done.ok) continue;
    current = done.value.state;
    messages.push(...done.value.messages);
  }
  return { state: current, messages };
}

/** 交付：背包裡要有足夠的東西；物品從背包拿走，然後完成委託。獎勵放不下時什麼都不改。 */
export function submitQuest(state: GameState, questId: string, index: ContentIndex): Result<{ state: GameState; messages: string[] }, string> {
  const def = findQuest(index, questId);
  if (!def) return fail('NO_QUEST');
  if (state.quests[def.id]?.status !== 'active') return fail('NOT_ACTIVE');
  if (def.goal.type !== 'deliver') return fail('NOT_DELIVERY');
  const taken = removeItem(state.inventory, def.goal.itemId, def.goal.count);
  if (!taken.ok) return fail('NO_MATERIAL');
  return completeQuest({ ...state, inventory: taken.value }, def, index);
}

/** 交付還差的東西（給訊息用），例如「石頭 × 1」；夠了或不是交付型就回傳 null。 */
export function shortfallOf(state: GameState, questId: string, index: ContentIndex): string | null {
  const def = findQuest(index, questId);
  if (!def || def.goal.type !== 'deliver') return null;
  const missing = def.goal.count - countOf(state.inventory, def.goal.itemId);
  return missing > 0 ? `${index.item(def.goal.itemId).name} × ${missing}` : null;
}

/** 完成委託：發獎勵、記錄旗標與圖鑑碎片、把委託標為完成。獎勵放不下時回傳失敗，狀態不變。 */
function completeQuest(state: GameState, def: QuestDef, index: ContentIndex): Result<{ state: GameState; messages: string[] }, string> {
  const granted = grantReward(state, def, index);
  if (!granted.ok) return granted;
  const quests = { ...granted.value.state.quests, [def.id]: { status: 'done' as const, progress: 0, seen: [] } };
  const messages = [`委託完成：${def.title}`, def.thanks];
  if (granted.value.lines.length > 0) messages.push(`獲得 ${granted.value.lines.join('、')}`);
  return ok({ state: { ...granted.value.state, quests }, messages });
}

function grantReward(state: GameState, def: QuestDef, index: ContentIndex): Result<{ state: GameState; lines: string[] }, string> {
  const reward = def.reward;
  let next = state;
  const lines: string[] = [];
  if (reward.gold) {
    next = { ...next, gold: next.gold + reward.gold };
    lines.push(`${reward.gold} 金`);
  }
  for (const [itemId, count] of Object.entries(reward.items ?? {})) {
    const stored = addItem(next.inventory, index.item(itemId), count);
    if (!stored.ok) return fail(stored.reason);
    next = { ...next, inventory: stored.value };
    lines.push(`${index.item(itemId).name} × ${count}`);
  }
  if (reward.friendship && def.giver) {
    const current = next.friendship[def.giver] ?? NO_FRIENDSHIP;
    const cap = heartCapPoints(index.friendship, index.tuning.time.daysPerSeason, totalDay(next.calendar, index.tuning.time.daysPerSeason));
    const points = addPoints(current.points, reward.friendship, cap);
    next = { ...next, friendship: { ...next.friendship, [def.giver]: { ...current, points } } };
    lines.push(`${index.npc(def.giver).name}的好感 +${reward.friendship}`);
  }
  if (reward.flag) next = { ...next, flags: { ...next.flags, [reward.flag]: true } };
  if (reward.fragments) {
    next = { ...next, dexFragments: next.dexFragments + reward.fragments };
    lines.push(`圖鑑碎片 +${reward.fragments}`);
  }
  return ok({ state: next, lines });
}

/** 早上睡醒：今天到期且條件符合的信送進信箱（未讀）。回傳送到的信，給訊息用。 */
export function deliverLetters(state: GameState, index: ContentIndex): { state: GameState; arrived: LetterDef[] } {
  const arrived = deliverableLetters(index.letters, state.mail, unlockContext(state, index), state.calendar, index.tuning.time.daysPerSeason);
  if (arrived.length === 0) return { state, arrived };
  const mail = { ...state.mail };
  for (const letter of arrived) mail[letter.id] = 'unread';
  return { state: { ...state, mail }, arrived };
}

/** 取信：把所有未讀的信標為已讀，並回傳信的內容（標題與正文，每行一句）。 */
export function collectMail(state: GameState, index: ContentIndex): { state: GameState; messages: string[] } {
  const unread = index.letters.filter((letter) => state.mail[letter.id] === 'unread');
  if (unread.length === 0) return { state, messages: ['信箱是空的'] };
  const mail = { ...state.mail };
  const messages: string[] = [];
  for (const letter of unread) {
    mail[letter.id] = 'read';
    messages.push(`【${letter.title}】`, ...letter.body);
  }
  return { state: { ...state, mail }, messages };
}

/** 把今天的佈告欄抽取寫進狀態（睡醒時與打開佈告欄時呼叫）。 */
export function refreshBoard(state: GameState, index: ContentIndex): GameState {
  return { ...state, board: currentBoard(state, index) };
}
