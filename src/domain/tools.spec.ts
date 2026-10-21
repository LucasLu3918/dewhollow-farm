import { describe, expect, it } from 'vitest';
import { energyCostFor, TOOL_IDS, TOOL_ORDER, toolForAction, type ToolTier } from './tools';

const TIERS: ToolTier[] = [{ energyDiscount: 0 }, { energyDiscount: 1 }, { energyDiscount: 1 }, { energyDiscount: 2 }];

describe('toolForAction', () => {
  it('maps each farming action to the one tool that performs it', () => {
    expect(toolForAction('till')).toBe('hoe');
    expect(toolForAction('water')).toBe('can');
    expect(toolForAction('plant')).toBe('seedbag');
    expect(toolForAction('chop')).toBe('axe');
  });

  it('actions with no tool (harvest, ship, forage) return null', () => {
    expect(toolForAction('harvest')).toBeNull();
    expect(toolForAction('ship')).toBeNull();
    expect(toolForAction('forage')).toBeNull();
  });

  it('the Z key cycles the three farm tools; the axe has its own key and is not in the cycle', () => {
    expect(TOOL_ORDER).toEqual(['hoe', 'can', 'seedbag']);
    expect(TOOL_IDS).toEqual(['hoe', 'can', 'seedbag', 'axe', 'pick', 'rod']);
  });
});

describe('energyCostFor', () => {
  it('costs the base amount with no tier, and less with a higher tier', () => {
    expect(energyCostFor(2, 0, TIERS)).toBe(2);
    expect(energyCostFor(2, 1, TIERS)).toBe(1);
    expect(energyCostFor(3, 2, TIERS)).toBe(2);
  });

  it('never costs less than 1 and never more than the base', () => {
    expect(energyCostFor(1, 3, TIERS)).toBe(1);
    for (let tier = 0; tier < TIERS.length; tier += 1) {
      expect(energyCostFor(2, tier, TIERS)).toBeLessThanOrEqual(2);
      expect(energyCostFor(2, tier, TIERS)).toBeGreaterThanOrEqual(1);
    }
  });

  it('rejects a tier that is not in the table', () => {
    expect(() => energyCostFor(2, 4, TIERS)).toThrow(RangeError);
  });
});
