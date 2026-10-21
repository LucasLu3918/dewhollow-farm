import { describe, expect, it } from 'vitest';
import { SaveFormatError } from './save-errors';
import { migrateState } from './save-migrations';

const context = { inventoryCapacity: 24, daysPerSeason: 20, wakeMinute: 360 };

/** 一份合法的 v1 存檔內容（MVP 時期的格式）。 */
function v1State(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    calendar: { year: 1, season: 'spring', day: 3, minuteOfDay: 400 },
    energy: { current: 60, max: 100 },
    gold: 250,
    mapId: 'farm',
    player: { x: 7, y: 9, facing: 'down' },
    plots: { '4,3': { watered: true, dryDays: 0, crop: { cropId: 'moon-bean', growthDays: 1 } } },
    bag: { seeds: { 'moon-bean': 2, 'sweet-radish': 5 }, crops: { 'sweet-radish': 3 } },
    shipBox: { items: { 'sweet-radish': 2 } },
    flags: { 'talked:maomao': true },
    tool: 'can',
    selectedSeed: 'moon-bean',
    rng: 12345,
    ...overrides,
  };
}

describe('migrateState v1 → v2', () => {
  it('turns the bag into inventory stacks, seeds first then produce', () => {
    const migrated = migrateState(v1State(), context) as Record<string, unknown>;
    expect(migrated.schemaVersion).toBe(11);
    expect(migrated.inventory).toEqual({
      capacity: 24,
      stacks: [
        { itemId: 'seed.moon-bean', quality: 'normal', count: 2 },
        { itemId: 'seed.sweet-radish', quality: 'normal', count: 5 },
        { itemId: 'crop.sweet-radish', quality: 'normal', count: 3 },
      ],
    });
    expect(migrated).not.toHaveProperty('bag');
  });

  it('turns the shipping box into normal-quality entries', () => {
    const migrated = migrateState(v1State(), context) as Record<string, unknown>;
    expect(migrated.shipBox).toEqual({ entries: [{ itemId: 'crop.sweet-radish', quality: 'normal', count: 2 }] });
  });

  it('starts play time at zero and keeps every other field as it was', () => {
    const before = v1State();
    const migrated = migrateState(before, context) as Record<string, unknown>;
    expect(migrated.playtimeSeconds).toBe(0);
    for (const key of ['calendar', 'energy', 'gold', 'mapId', 'player', 'plots', 'flags', 'tool', 'selectedSeed', 'rng']) {
      expect(migrated[key]).toEqual(before[key]);
    }
  });

  it('splits a stack that is larger than the stack limit', () => {
    const migrated = migrateState(v1State({ bag: { seeds: {}, crops: { 'sweet-radish': 120 } } }), context) as {
      inventory: { stacks: { count: number }[] };
    };
    expect(migrated.inventory.stacks.map((s) => s.count)).toEqual([99, 21]);
  });

  it('grows the capacity rather than dropping items that no longer fit', () => {
    const migrated = migrateState(v1State(), { ...context, inventoryCapacity: 2 }) as { inventory: { capacity: number } };
    expect(migrated.inventory.capacity).toBe(3);
  });

  it('migrates an empty bag and an empty shipping box', () => {
    const migrated = migrateState(v1State({ bag: { seeds: {}, crops: {} }, shipBox: { items: {} } }), context) as Record<
      string,
      unknown
    >;
    expect(migrated.inventory).toEqual({ capacity: 24, stacks: [] });
    expect(migrated.shipBox).toEqual({ entries: [] });
  });

  it('does not mutate the input', () => {
    const before = v1State();
    const snapshot = structuredClone(before);
    migrateState(before, context);
    expect(before).toEqual(snapshot);
  });
});

describe('migrateState version handling', () => {
  it('passes a current-version state through untouched', () => {
    const current = { schemaVersion: 11, anything: 'goes' };
    expect(migrateState(current, context)).toBe(current);
  });

  it('refuses a save from a newer game version with a clear message', () => {
    expect(() => migrateState({ schemaVersion: 12 }, context)).toThrow(SaveFormatError);
    expect(() => migrateState({ schemaVersion: 12 }, context)).toThrow('更新版本');
  });

  it('refuses a state without a usable version', () => {
    expect(() => migrateState({}, context)).toThrow('缺少存檔版本');
    expect(() => migrateState({ schemaVersion: 0 }, context)).toThrow(SaveFormatError);
    expect(() => migrateState('nope', context)).toThrow(SaveFormatError);
  });

  it('reports where a damaged v1 state is wrong instead of guessing', () => {
    try {
      migrateState(v1State({ bag: { seeds: { 'moon-bean': -1 }, crops: {} } }), context);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(SaveFormatError);
      expect((error as Error).message).toContain('v1');
      expect((error as Error).message).toContain('bag.seeds.moon-bean');
    }
  });
});

/** 一份合法的 v2 存檔內容（四季之前的格式，day 是從開始算起的總天數）。 */
function v2State(day: number): Record<string, unknown> {
  return {
    schemaVersion: 2,
    calendar: { year: 1, season: 'spring', day, minuteOfDay: 420 },
    energy: { current: 60, max: 100 },
    gold: 250,
    mapId: 'farm',
    player: { x: 7, y: 9, facing: 'down' },
    plots: {},
    inventory: { capacity: 24, stacks: [] },
    shipBox: { entries: [] },
    flags: {},
    rng: 7,
    tool: 'hoe',
    selectedSeed: 'moon-bean',
    playtimeSeconds: 0,
  };
}

describe('v2 → v3 (seasons and weather)', () => {
  it('reads the old total day as a season position: day 25 is summer day 5 of year 1', () => {
    const migrated = migrateState(v2State(25), context) as { calendar: unknown; schemaVersion: number };
    expect(migrated.schemaVersion).toBe(11);
    expect(migrated.calendar).toEqual({ year: 1, season: 'summer', day: 5, minuteOfDay: 420 });
  });

  it('keeps the time of day and starts with sunny weather today and tomorrow', () => {
    const migrated = migrateState(v2State(1), context) as Record<string, unknown>;
    expect(migrated.calendar).toEqual({ year: 1, season: 'spring', day: 1, minuteOfDay: 420 });
    expect(migrated.weather).toBe('sunny');
    expect(migrated.forecast).toBe('sunny');
  });

  it('carries day 81 over into year 2', () => {
    const migrated = migrateState(v2State(81), context) as { calendar: unknown };
    expect(migrated.calendar).toEqual({ year: 2, season: 'spring', day: 1, minuteOfDay: 420 });
  });

  it('rejects a v2 save whose day is not a positive whole number', () => {
    expect(() => migrateState(v2State(0), context)).toThrow(SaveFormatError);
  });
});

/** 一份合法的 v3 存檔內容（季節與天氣之後、工具階級之前）。 */
function v3State(): Record<string, unknown> {
  return { ...v2State(3), schemaVersion: 3, calendar: { year: 1, season: 'spring', day: 3, minuteOfDay: 420 }, weather: 'rain', forecast: 'sunny', tool: 'seedbag' };
}

describe('v3 → v4 (tool tiers and world changes)', () => {
  it('starts every tool at the basic tier and nothing has been changed in the world yet', () => {
    const migrated = migrateState(v3State(), context) as Record<string, unknown>;
    expect(migrated.schemaVersion).toBe(11);
    expect(migrated.toolTiers).toEqual({ hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0 });
    expect(migrated.worldChanges).toEqual({});
  });

  it('keeps the tool in hand and everything else as it was', () => {
    const migrated = migrateState(v3State(), context) as Record<string, unknown>;
    expect(migrated.tool).toBe('seedbag');
    expect(migrated.weather).toBe('rain');
  });
});
