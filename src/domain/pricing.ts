import type { Quality } from './items';

/**
 * 作物售價：種子價 × 3 × (1 + 0.1 × 成長天數)，四捨五入到整數。
 * 以整數運算避免浮點誤差（例如 25 × 3 × 1.3 = 97.5 必須穩定得到 98）。
 */
export function sellPriceOf(seedPrice: number, growthDays: number): number {
  return Math.round((seedPrice * 3 * (10 + growthDays)) / 10);
}

/** 品質倍率（百分比）：普通 100、優良 125、精良 150。 */
const QUALITY_PERCENT: Record<Quality, number> = { normal: 100, good: 125, fine: 150 };

export function priceWithQuality(basePrice: number, quality: Quality): number {
  return Math.round((basePrice * QUALITY_PERCENT[quality]) / 100);
}
