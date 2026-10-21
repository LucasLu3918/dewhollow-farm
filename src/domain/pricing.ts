/**
 * 作物售價：種子價 × 3 × (1 + 0.1 × 成長天數)，四捨五入到整數。
 * 以整數運算避免浮點誤差（例如 25 × 3 × 1.3 = 97.5 必須穩定得到 98）。
 */
export function sellPriceOf(seedPrice: number, growthDays: number): number {
  return Math.round((seedPrice * 3 * (10 + growthDays)) / 10);
}
