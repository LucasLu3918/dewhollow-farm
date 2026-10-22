import { describe, expect, it } from 'vitest';
import type { Calendar } from './calendar';
import {
  doneThisYear,
  emptyFestivalState,
  festivalKey,
  festivalOnDay,
  markDone,
  isOpen,
  openFestival,
  recordCatch,
  contestReached,
  recordSale,
  soldThisYear,
  exchangedThisYear,
  exchangeRefusal,
  recordExchange,
  recordHarvest,
  harvestContestReached,
  litLanterns,
  warmGiftsLeft,
  type FestivalDef,
  type StarExchangeDef,
} from './festival';

const sprout: FestivalDef = {
  id: 'sprout',
  name: '萌芽祭',
  season: 'spring',
  day: 12,
  mapId: 'plaza',
  fromMinute: 0,
  playMinutes: 9,
};

const starMarket: FestivalDef = {
  id: 'starmarket',
  name: '星河夜市',
  season: 'summer',
  day: 14,
  mapId: 'plaza',
  fromMinute: 1080,
  playMinutes: 10,
  shop: 'night-market',
};

function at(season: Calendar['season'], day: number, minuteOfDay: number, year = 1): Calendar {
  return { year, season, day, minuteOfDay };
}

describe('festival open window (節慶只在當天開放)', () => {
  it('a daytime festival is open all day on its date and nowhere else', () => {
    expect(isOpen(sprout, at('spring', 12, 360))).toBe(true);
    expect(isOpen(sprout, at('spring', 12, 1439))).toBe(true);
    expect(isOpen(sprout, at('spring', 11, 720))).toBe(false);
    expect(isOpen(sprout, at('spring', 13, 720))).toBe(false);
    expect(isOpen(sprout, at('summer', 12, 720))).toBe(false);
    expect(isOpen(sprout, at('spring', 12, 720, 2))).toBe(true);
  });

  it('a night festival opens at its start minute and stays open past midnight', () => {
    expect(isOpen(starMarket, at('summer', 14, 1079))).toBe(false);
    expect(isOpen(starMarket, at('summer', 14, 1080))).toBe(true);
    expect(isOpen(starMarket, at('summer', 14, 1500))).toBe(true);
    expect(isOpen(starMarket, at('summer', 15, 1200))).toBe(false);
  });

  it('festivalOnDay names the festival of the day regardless of the hour', () => {
    expect(festivalOnDay([sprout, starMarket], at('summer', 14, 0))?.id).toBe('starmarket');
    expect(festivalOnDay([sprout, starMarket], at('summer', 13, 0))).toBeNull();
  });

  it('openFestival returns the festival running right now, or null', () => {
    const defs = [sprout, starMarket];
    expect(openFestival(defs, at('spring', 12, 600))?.id).toBe('sprout');
    expect(openFestival(defs, at('summer', 14, 1200))?.id).toBe('starmarket');
    expect(openFestival(defs, at('summer', 14, 600))).toBeNull();
    expect(openFestival(defs, at('autumn', 1, 600))).toBeNull();
  });
});

describe('once per year per activity (每年每項活動一次)', () => {
  it('a key is marked done for its year only', () => {
    const key = festivalKey('sprout', 'swap', 'maomao');
    const state = markDone(emptyFestivalState(), key, 1);
    expect(doneThisYear(state, key, 1)).toBe(true);
    expect(doneThisYear(state, key, 2)).toBe(false);
    expect(doneThisYear(state, festivalKey('sprout', 'swap', 'rong-bo'), 1)).toBe(false);
  });

  it('the key names the festival, the activity and the subject', () => {
    expect(festivalKey('sprout', 'crown')).toBe('sprout:crown');
    expect(festivalKey('sprout', 'swap', 'maomao')).toBe('sprout:swap:maomao');
  });
});

describe('fishing contest (釣魚比賽計數)', () => {
  it('counts catches within a year and reports when the target is reached', () => {
    const rule = { count: 3, gold: 200 };
    let contest = emptyFestivalState().contest;
    contest = recordCatch(contest, 1);
    contest = recordCatch(contest, 1);
    expect(contestReached(contest, rule)).toBe(false);
    contest = recordCatch(contest, 1);
    expect(contest).toEqual({ year: 1, caught: 3 });
    expect(contestReached(contest, rule)).toBe(true);
  });

  it('starts over when the year changes', () => {
    const contest = recordCatch({ year: 1, caught: 2 }, 2);
    expect(contest).toEqual({ year: 2, caught: 1 });
  });
});

describe('night market stock (夜市攤位的數量限制)', () => {
  it('sales are counted per item and reset in a new year', () => {
    let sold = emptyFestivalState().sold;
    sold = recordSale(sold, 1, 'bait', 2);
    sold = recordSale(sold, 1, 'bait', 1);
    expect(soldThisYear(sold, 1, 'bait')).toBe(3);
    expect(soldThisYear(sold, 1, 'lantern')).toBe(0);
    expect(soldThisYear(sold, 2, 'bait')).toBe(0);
    expect(recordSale(sold, 2, 'bait', 1)).toEqual({ year: 2, counts: { bait: 1 } });
  });
});

describe('star exchange (星河兌換：每項每年有上限)', () => {
  const starString: StarExchangeDef = {
    id: 'star-string',
    name: '星空燈串',
    give: { itemId: 'star-shard', count: 3 },
    receive: { itemId: 'star-string', count: 1 },
    limit: 1,
    playMinutes: 1,
  };
  const starSugarRecipe: StarExchangeDef = {
    id: 'star-sugar-recipe',
    name: '星河糖的配方',
    give: { itemId: 'star-shard', count: 4 },
    flag: 'recipe:star-sugar',
    limit: 1,
    playMinutes: 1.5,
  };

  it('counts exchanges per line within a year and starts over in a new year', () => {
    let tally = emptyFestivalState().exchanged;
    tally = recordExchange(tally, 1, 'star-string');
    expect(exchangedThisYear(tally, 1, 'star-string')).toBe(1);
    expect(exchangedThisYear(tally, 1, 'night-canvas')).toBe(0);
    expect(exchangedThisYear(tally, 2, 'star-string')).toBe(0);
    expect(recordExchange(tally, 2, 'star-string')).toEqual({ year: 2, counts: { 'star-string': 1 } });
  });

  it('starts with nothing exchanged', () => {
    expect(emptyFestivalState().exchanged).toEqual({ year: 0, counts: {} });
  });

  it('refuses when the shards are short, the yearly limit is reached, or the recipe is already unlocked', () => {
    const none = emptyFestivalState().exchanged;
    expect(exchangeRefusal(starString, { shards: 2, year: 1, exchanged: none, flagSet: false })).toBe('NOT_ENOUGH_SHARDS');
    expect(exchangeRefusal(starString, { shards: 3, year: 1, exchanged: none, flagSet: false })).toBeNull();
    const used = recordExchange(none, 1, 'star-string');
    expect(exchangeRefusal(starString, { shards: 9, year: 1, exchanged: used, flagSet: false })).toBe('EXCHANGE_LIMIT');
    expect(exchangeRefusal(starString, { shards: 9, year: 2, exchanged: used, flagSet: false })).toBeNull();
    expect(exchangeRefusal(starSugarRecipe, { shards: 9, year: 1, exchanged: none, flagSet: true })).toBe('ALREADY_UNLOCKED');
  });
});

describe('豐穗祭的收成比賽（計數與每年一次）', () => {
  it('starts with nothing harvested', () => {
    expect(emptyFestivalState().harvest).toEqual({ year: 0, count: 0 });
  });

  it('counts harvests within a year and starts over in a new year', () => {
    let tally = emptyFestivalState().harvest;
    tally = recordHarvest(tally, 1);
    tally = recordHarvest(tally, 1);
    expect(tally).toEqual({ year: 1, count: 2 });
    expect(recordHarvest(tally, 2)).toEqual({ year: 2, count: 1 });
  });

  it('is reached when the count hits the target, not before', () => {
    const rules = { cropId: 'bell-pumpkin', count: 3, gold: 400 };
    expect(harvestContestReached({ year: 1, count: 2 }, rules)).toBe(false);
    expect(harvestContestReached({ year: 1, count: 3 }, rules)).toBe(true);
  });
});

describe('暖燈節：燈與交換禮物', () => {
  const done = (keys: string[], year: number): Record<string, number> => Object.fromEntries(keys.map((k) => [`warm-lamp:lantern:${k}`, year]));

  it('counts the lanterns lit this year among the lantern positions only', () => {
    const lamps = ['2,1', '13,1', '4,4'];
    expect(litLanterns(done(['2,1', '4,4'], 1), 'warm-lamp', lamps, 1)).toBe(2);
    expect(litLanterns(done(['2,1', '4,4'], 1), 'warm-lamp', lamps, 2)).toBe(0);
    expect(litLanterns({ 'sprout:crown': 1, 'warm-lamp:lantern:9,9': 1 }, 'warm-lamp', lamps, 1)).toBe(0);
  });

  it('counts the warm gifts left this year out of the yearly limit', () => {
    const none = emptyFestivalState().exchanged;
    expect(warmGiftsLeft(none, 1, 3)).toBe(3);
    const used = recordExchange(recordExchange(none, 1, 'warm-gift'), 1, 'warm-gift');
    expect(warmGiftsLeft(used, 1, 3)).toBe(1);
    expect(warmGiftsLeft(used, 2, 3)).toBe(3);
  });
});
