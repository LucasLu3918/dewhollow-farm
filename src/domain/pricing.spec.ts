import { describe, expect, it } from 'vitest';
import { priceWithQuality, sellPriceOf } from './pricing';

describe('sellPriceOf', () => {
  it('applies the linear growth bonus to three times the seed price', () => {
    expect(sellPriceOf(10, 1)).toBe(33); // 10 × 3 × 1.1
    expect(sellPriceOf(15, 2)).toBe(54); // 15 × 3 × 1.2
    expect(sellPriceOf(120, 13)).toBe(828); // 120 × 3 × 2.3
  });

  it('rounds half up to a whole number', () => {
    expect(sellPriceOf(25, 3)).toBe(98); // 25 × 3 × 1.3 = 97.5
  });
});

describe('priceWithQuality', () => {
  it('leaves normal quality untouched', () => {
    expect(priceWithQuality(98, 'normal')).toBe(98);
  });

  it('pays 25% more for good and 50% more for fine, rounded to whole gold', () => {
    expect(priceWithQuality(98, 'good')).toBe(123); // 122.5
    expect(priceWithQuality(98, 'fine')).toBe(147);
    expect(priceWithQuality(33, 'good')).toBe(41); // 41.25
  });
});
