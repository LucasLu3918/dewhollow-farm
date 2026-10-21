import { SEASONS, type Season } from './calendar';

/**
 * 居民好感：點數記在每位居民身上，每 pointsPerHeart 點是一顆心（最多 maxHearts 顆）。
 * 規則數值在 content/friendship.json；這裡只做計算，不寫死任何數字。
 */

/** 一位居民與玩家的關係紀錄。talkedDay 與 giftedDay 是「總天數」（見 calendar.totalDay），沒有紀錄是 null。 */
export interface Friendship {
  points: number;
  talkedDay: number | null;
  giftedDay: number | null;
}

export const NO_FRIENDSHIP: Friendship = { points: 0, talkedDay: null, giftedDay: null };

export interface FriendshipRules {
  pointsPerHeart: number;
  maxHearts: number;
  /** 到這一季結束為止（含）的好感上限；之後的季節開放到 maxHearts。 */
  earlyCap: { hearts: number; untilSeason: Season };
  /** 每天第一次對話的好感。 */
  talkPoints: number;
  /** 送禮的好感：依物品對居民的偏好（喜歡、中立、討厭）。 */
  gift: { love: number; neutral: number; hate: number };
  /** 居民喜歡的作物提高收成品質：好感達到 minHearts 的喜歡者，每人加 perResident，總和不超過 cap。 */
  cropQuality: { minHearts: number; perResident: number; cap: number };
}

export type GiftReaction = 'love' | 'neutral' | 'hate';

export function heartsOf(points: number, rules: Pick<FriendshipRules, 'pointsPerHeart' | 'maxHearts'>): number {
  return Math.min(rules.maxHearts, Math.floor(points / rules.pointsPerHeart));
}

/** 目前總天數下，好感點數的上限。第一季到 untilSeason 結束為止用 earlyCap，之後是 maxHearts。 */
export function heartCapPoints(rules: FriendshipRules, daysPerSeason: number, totalDay: number): number {
  const untilIndex = SEASONS.indexOf(rules.earlyCap.untilSeason);
  const earlyLastDay = (untilIndex + 1) * daysPerSeason;
  const hearts = totalDay <= earlyLastDay ? rules.earlyCap.hearts : rules.maxHearts;
  return hearts * rules.pointsPerHeart;
}

/**
 * 加減好感點數：正數不超過上限（但不會把已經超過上限的點數扣回來）；負數不會低於 0。
 */
export function addPoints(current: number, delta: number, capPoints: number): number {
  if (delta >= 0) return Math.max(current, Math.min(current + delta, capPoints));
  return Math.max(0, current + delta);
}

/** 送禮的反應：物品在居民的喜歡清單裡是喜歡，在討厭清單裡是討厭，其餘是中立。 */
export function giftReaction(itemId: string, loves: readonly string[], hates: readonly string[]): GiftReaction {
  if (loves.includes(itemId)) return 'love';
  if (hates.includes(itemId)) return 'hate';
  return 'neutral';
}

export function giftPoints(reaction: GiftReaction, rules: Pick<FriendshipRules, 'gift'>): number {
  return rules.gift[reaction];
}

export interface FavorResident {
  id: string;
  loves: readonly string[];
}

/**
 * 收成某種作物時的品質加成（以機率的增量表示，加在品質的隨機數上）。
 * 每位「喜歡這種作物、好感達到 minHearts」的居民加一份，總和不超過 cap。
 */
export function favorQualityBonus(
  cropItemId: string,
  residents: readonly FavorResident[],
  friendship: Readonly<Record<string, Friendship | undefined>>,
  rules: Pick<FriendshipRules, 'pointsPerHeart' | 'maxHearts' | 'cropQuality'>,
): number {
  let bonus = 0;
  for (const resident of residents) {
    if (!resident.loves.includes(cropItemId)) continue;
    const hearts = heartsOf(friendship[resident.id]?.points ?? 0, rules);
    if (hearts < rules.cropQuality.minHearts) continue;
    bonus += rules.cropQuality.perResident;
  }
  return Math.min(bonus, rules.cropQuality.cap);
}
