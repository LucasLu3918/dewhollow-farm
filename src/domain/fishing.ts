/**
 * 投竿後魚上鉤的機率（百分比）：基礎機率 + 有浮標 + 這一竿用了魚餌，最多 100。
 */
export function biteChanceFor(
  tuning: { biteChance: number; bobberBonus: number; baitBonus: number },
  extras: { bobber: boolean; bait: boolean },
): number {
  const bonus = (extras.bobber ? tuning.bobberBonus : 0) + (extras.bait ? tuning.baitBonus : 0);
  return Math.min(100, tuning.biteChance + bonus);
}
