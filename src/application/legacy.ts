import type { GameState } from '../domain/game-state';
import { cropPriceBonusPercent, harvestResetState, legacyRefusal, legacyState, normalizePlayerName, resetRefusal } from '../domain/legacy';
import { neighbor, tileAt } from '../domain/world';
import type { ContentIndex } from './content-index';

/**
 * 豐收重置與傳承的用例（M6）。規則在 domain/legacy.ts，文字與數值在 content/legacy.json。
 * 兩者都要站在小屋床邊的公告前面（notice: legacy），並且要先按一次看說明、再按一次確認（confirmed）。
 * 沒有確認、時機不對、條件不符時，什麼都不改變。
 */

export interface LegacyOutcome {
  state: GameState;
  messages: string[];
  /** 失敗的代碼（成功時沒有）；畫面用它顯示原因。 */
  refusal?: string;
}

/** 面對床邊的公告（小屋的 notice: legacy）。 */
export function facingLegacyNotice(state: GameState, index: ContentIndex): boolean {
  const target = neighbor(state.player, state.player.facing);
  return tileAt(index.map(state.mapId), target.x, target.y)?.notice === 'legacy';
}

/** 把模板裡的 {key} 換成值（找不到的保留原樣）。 */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

function refused(state: GameState, refusal: string, message: string): LegacyOutcome {
  return { state, messages: [message], refusal };
}

/** 豐收重置：確認後清空農場、保留圖鑑等進度，次數加一。 */
export function runHarvestReset(state: GameState, confirmed: boolean, index: ContentIndex): LegacyOutcome {
  const text = index.legacy.reset;
  if (!facingLegacyNotice(state, index)) return refused(state, 'NOT_AT_NOTICE', index.legacy.notAtNotice);
  const refusal = resetRefusal(state, index.legacy.reset);
  if (refusal === 'RESET_CLOSED') return refused(state, refusal, text.closed);
  if (refusal === 'RESET_LIMIT') return refused(state, refusal, text.limit);
  if (!confirmed) return refused(state, 'NOT_CONFIRMED', text.needConfirm);

  const next = harvestResetState(state, index.newGame(state.rng), index.legacy.reset);
  const percent = cropPriceBonusPercent(next.resetBonus, index.legacy.reset);
  return {
    state: next,
    messages: [fill(text.done, { percent: String(percent), count: String(next.resetBonus), max: String(index.legacy.reset.maxResets) })],
  };
}

/** 傳承：確認後由新角色接手，從第 1 年開始；只保留圖鑑與成就。 */
export function runLegacy(state: GameState, name: string, confirmed: boolean, index: ContentIndex): LegacyOutcome {
  const text = index.legacy.legacy;
  if (!facingLegacyNotice(state, index)) return refused(state, 'NOT_AT_NOTICE', index.legacy.notAtNotice);
  if (legacyRefusal(state, index.legacy)) {
    return refused(state, 'LEGACY_LOCKED', fill(text.locked, { chapter: String(text.requiresChapter) }));
  }
  const playerName = normalizePlayerName(name);
  if (playerName === null) return refused(state, 'BAD_NAME', text.badName);
  if (!confirmed) return refused(state, 'NOT_CONFIRMED', text.needConfirm);

  const next = legacyState(state, index.newGame(state.rng), playerName);
  return { state: next, messages: [fill(text.done, { name: playerName })] };
}
