import { describe, expect, it } from 'vitest';
import { growCrops, harvestPlot, isRipe, plantCrop, plotKey, plotMapKey, tillPlot, waterPlot } from './farm';
import type { PlotMap } from './farm';

const KEY = plotKey(3, 4);
const days = (id: string) => (id === 'sweet-radish' ? 3 : 5);

describe('farm plots', () => {
  it('builds stable keys', () => {
    expect(plotKey(3, 4)).toBe('3,4');
  });

  it('keeps crop plots from different maps in separate namespaces', () => {
    expect(plotMapKey('farm', 3, 4)).toBe('farm|3,4');
    expect(plotMapKey('greenhouse', 3, 4)).not.toBe(plotMapKey('farm', 3, 4));
  });

  it('tills an empty field into soil', () => {
    const r = tillPlot({}, KEY);
    expect(r).toEqual({ ok: true, value: { [KEY]: { watered: false, dryDays: 0, crop: null } } });
  });

  it('refuses to till a plot that is already soil', () => {
    const tilled: PlotMap = { [KEY]: { watered: false, dryDays: 0, crop: null } };
    expect(tillPlot(tilled, KEY)).toEqual({ ok: false, reason: 'ALREADY_TILLED' });
  });

  it('waters soil and marks it watered', () => {
    const tilled: PlotMap = { [KEY]: { watered: false, dryDays: 0, crop: null } };
    const r = waterPlot(tilled, KEY);
    expect(r.ok && r.value[KEY]?.watered).toBe(true);
  });

  it('cannot water or plant where there is no soil', () => {
    expect(waterPlot({}, KEY)).toEqual({ ok: false, reason: 'NO_SOIL' });
    expect(plantCrop({}, KEY, 'sweet-radish')).toEqual({ ok: false, reason: 'NO_SOIL' });
  });

  it('plants one crop per plot', () => {
    const soil: PlotMap = { [KEY]: { watered: false, dryDays: 0, crop: null } };
    const planted = plantCrop(soil, KEY, 'sweet-radish');
    expect(planted.ok && planted.value[KEY]?.crop).toEqual({ cropId: 'sweet-radish', growthDays: 0 });
    if (!planted.ok) throw new Error('plant should succeed');
    expect(plantCrop(planted.value, KEY, 'sweet-radish')).toEqual({ ok: false, reason: 'ALREADY_PLANTED' });
  });

  it('grows only watered crops at night, then clears watering', () => {
    const plots: PlotMap = {
      [KEY]: { watered: true, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 0 } },
      [plotKey(0, 0)]: { watered: false, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 0 } },
    };
    const next = growCrops(plots, days).plots;
    expect(next[KEY]).toEqual({ watered: false, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 1 } });
    expect(next[plotKey(0, 0)]?.crop?.growthDays).toBe(0);
  });

  it('caps growth at the crop maturity', () => {
    const plots: PlotMap = { [KEY]: { watered: true, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 3 } } };
    expect(growCrops(plots, days).plots[KEY]?.crop?.growthDays).toBe(3);
  });

  it('reports ripeness from growth days', () => {
    expect(isRipe({ cropId: 'sweet-radish', growthDays: 2 }, 3)).toBe(false);
    expect(isRipe({ cropId: 'sweet-radish', growthDays: 3 }, 3)).toBe(true);
  });

  it('harvests a ripe crop and keeps the soil', () => {
    const plots: PlotMap = { [KEY]: { watered: false, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 3 } } };
    const r = harvestPlot(plots, KEY, 3);
    expect(r).toEqual({
      ok: true,
      value: { plots: { [KEY]: { watered: false, dryDays: 0, crop: null } }, cropId: 'sweet-radish' },
    });
  });

  it('refuses to harvest an unripe crop or an empty plot', () => {
    const young: PlotMap = { [KEY]: { watered: false, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 1 } } };
    expect(harvestPlot(young, KEY, 3)).toEqual({ ok: false, reason: 'NOT_RIPE' });
    const empty: PlotMap = { [KEY]: { watered: false, dryDays: 0, crop: null } };
    expect(harvestPlot(empty, KEY, 3)).toEqual({ ok: false, reason: 'NO_CROP' });
  });

  it('shrinks growth by one on the first unwatered night', () => {
    const plots: PlotMap = { [KEY]: { watered: false, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 2 } } };
    const report = growCrops(plots, days);
    expect(report.plots[KEY]).toEqual({ watered: false, dryDays: 1, crop: { cropId: 'sweet-radish', growthDays: 1 } });
    expect(report.withered).toEqual([]);
  });

  it('never shrinks growth below zero', () => {
    const plots: PlotMap = { [KEY]: { watered: false, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 0 } } };
    expect(growCrops(plots, days).plots[KEY]?.crop?.growthDays).toBe(0);
  });

  it('withers the crop on the second consecutive unwatered night', () => {
    const plots: PlotMap = { [KEY]: { watered: false, dryDays: 1, crop: { cropId: 'sweet-radish', growthDays: 1 } } };
    const report = growCrops(plots, days);
    expect(report.plots[KEY]).toEqual({ watered: false, dryDays: 0, crop: null });
    expect(report.withered).toEqual(['sweet-radish']);
  });

  it('resets the dry count when the crop is watered again', () => {
    const plots: PlotMap = { [KEY]: { watered: true, dryDays: 1, crop: { cropId: 'sweet-radish', growthDays: 1 } } };
    expect(growCrops(plots, days).plots[KEY]).toEqual({
      watered: false,
      dryDays: 0,
      crop: { cropId: 'sweet-radish', growthDays: 2 },
    });
  });
});

describe('fertilizer on a planted field (施肥的田)', () => {
  it('keeps the fertilizer while the crop grows overnight', () => {
    const plots = { '4,4': { watered: true, crop: { cropId: 'moon-bean', growthDays: 0 }, dryDays: 0, fertilizer: 'basic' as const } };
    const grown = growCrops(plots, () => 2).plots['4,4'];
    expect(grown?.crop?.growthDays).toBe(1);
    expect(grown?.fertilizer).toBe('basic');
  });

  it('a harvested field loses its fertilizer with the crop', () => {
    const plots = { '4,4': { watered: true, crop: { cropId: 'moon-bean', growthDays: 2 }, dryDays: 0, fertilizer: 'fine' as const } };
    const result = harvestPlot(plots, '4,4', 2);
    expect(result.ok && result.value.plots['4,4']).toEqual({ watered: true, crop: null, dryDays: 0 });
  });
});
