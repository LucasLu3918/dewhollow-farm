import { describe, expect, it } from 'vitest';
import type { ItemStack } from '../domain/items';
import {
  lidAngle,
  lidOpenness,
  SHIP_FLIGHT_MS,
  SHIP_HOLD_END_MS,
  SHIP_ICON_STAGGER_MS,
  SHIP_LID_OPEN_ANGLE,
  SHIP_LID_OPEN_MS,
  SHIP_LID_TOTAL_MS,
  SHIP_MAX_ICONS,
  shipIconDelay,
  shipIconsFor,
  shippedItemIds,
} from './ship-animation';

const stack = (itemId: string, count: number, quality: ItemStack['quality'] = 'normal'): ItemStack => ({ itemId, count, quality });

describe('lidOpenness', () => {
  it('starts and ends with the lid closed', () => {
    expect(lidOpenness(0)).toBe(0);
    expect(lidOpenness(SHIP_LID_TOTAL_MS)).toBe(0);
  });

  it('is fully open once the lid has opened, and stays open until the last item has landed', () => {
    expect(lidOpenness(SHIP_LID_OPEN_MS)).toBe(1);
    expect(lidOpenness((SHIP_LID_OPEN_MS + SHIP_HOLD_END_MS) / 2)).toBe(1);
    expect(lidOpenness(SHIP_HOLD_END_MS)).toBe(1);
  });

  it('stays between closed and fully open all the way through', () => {
    for (let ms = 0; ms <= SHIP_LID_TOTAL_MS; ms += 10) {
      const openness = lidOpenness(ms);
      expect(openness, `ms ${ms}`).toBeGreaterThanOrEqual(0);
      expect(openness, `ms ${ms}`).toBeLessThanOrEqual(1);
    }
  });

  it('opens smoothly and closes smoothly, never backwards', () => {
    for (let ms = 0; ms < SHIP_LID_OPEN_MS; ms += 10) expect(lidOpenness(ms + 10), `open ${ms}`).toBeGreaterThanOrEqual(lidOpenness(ms));
    for (let ms = SHIP_HOLD_END_MS; ms < SHIP_LID_TOTAL_MS; ms += 10) {
      expect(lidOpenness(ms + 10), `close ${ms}`).toBeLessThanOrEqual(lidOpenness(ms));
    }
  });

  it('rejects a time outside the animation', () => {
    expect(() => lidOpenness(-1)).toThrow(RangeError);
    expect(() => lidOpenness(SHIP_LID_TOTAL_MS + 1)).toThrow(RangeError);
    expect(() => lidOpenness(Number.NaN)).toThrow(RangeError);
  });
});

describe('lidAngle', () => {
  it('is zero when closed, and the configured angle when fully open', () => {
    expect(lidAngle(0)).toBe(0);
    expect(Object.is(lidAngle(0), -0)).toBe(false);
    expect(lidAngle(SHIP_HOLD_END_MS)).toBe(SHIP_LID_OPEN_ANGLE);
    expect(SHIP_LID_OPEN_ANGLE).toBeLessThan(0);
  });
});

describe('the timing of items and lid', () => {
  it('keeps the lid open until the last item lands', () => {
    expect(SHIP_HOLD_END_MS).toBeGreaterThanOrEqual(SHIP_FLIGHT_MS + shipIconDelay(SHIP_MAX_ICONS - 1));
  });
});

describe('shippedItemIds', () => {
  it('lists the items whose total count went down, each once, in inventory order', () => {
    const before = [stack('crop.sweet-radish', 3), stack('crop.moon-bean', 1, 'good'), stack('wood', 5)];
    const after = [stack('wood', 5)];
    expect(shippedItemIds(before, after)).toEqual(['crop.sweet-radish', 'crop.moon-bean']);
  });

  it('counts a partly shipped item, even when only one quality went', () => {
    const before = [stack('crop.sweet-radish', 3), stack('crop.sweet-radish', 2, 'fine')];
    const after = [stack('crop.sweet-radish', 1)];
    expect(shippedItemIds(before, after)).toEqual(['crop.sweet-radish']);
  });

  it('ignores items that only went up', () => {
    expect(shippedItemIds([stack('wood', 2)], [stack('wood', 5)])).toEqual([]);
  });

  it('is empty when nothing left the bag', () => {
    expect(shippedItemIds([stack('wood', 2)], [stack('wood', 2)])).toEqual([]);
    expect(shippedItemIds([], [])).toEqual([]);
  });
});

describe('shipIconsFor and shipIconDelay', () => {
  it('shows at most the first few kinds, in order', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    expect(shipIconsFor(ids)).toEqual(ids.slice(0, SHIP_MAX_ICONS));
    expect(shipIconsFor(['a'])).toEqual(['a']);
    expect(shipIconsFor([])).toEqual([]);
  });

  it('starts the first item at once and staggers the rest', () => {
    expect(shipIconDelay(0)).toBe(0);
    expect(shipIconDelay(1)).toBe(SHIP_ICON_STAGGER_MS);
    expect(shipIconDelay(2)).toBe(2 * SHIP_ICON_STAGGER_MS);
  });
});
