import type { GameState } from '../domain/game-state';
import type { DexCategory } from '../domain/collection';
import type { FriendshipRules } from '../domain/friendship';
import { collectionRatio, friendshipRatio, ratingOf, type RatingResult, type RatingRules } from '../domain/rating';

/**
 * 農場評級（M6）的用例：把遊戲狀態、圖鑑、居民與好感規則組起來算出評級。計分規則在 domain/rating.ts。
 */

/** 評級需要的內容（HUD 與面板共用，不需要整份內容包）。 */
export interface RatingSource {
  rating: RatingRules;
  dexCategories: readonly DexCategory[];
  npcIds: readonly string[];
  friendship: FriendshipRules;
}

export function farmRating(state: GameState, source: RatingSource): RatingResult {
  const maxPoints = source.friendship.maxHearts * source.friendship.pointsPerHeart;
  return ratingOf(
    {
      yearlyIncome: state.yearlyIncome,
      collectionRatio: collectionRatio(source.dexCategories, state.collection.found),
      friendshipRatio: friendshipRatio(source.npcIds, state.friendship, maxPoints),
    },
    source.rating,
  );
}
