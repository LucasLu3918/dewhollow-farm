import { describe, expect, it } from 'vitest';
import type { CropDef, MapDef } from '../domain/content';
import type { PlotMap } from '../domain/farm';
import { legacyMapRenderPlan, plotRenderPlan } from './map-render-plan';

describe('legacyMapRenderPlan', () => {
  it('maps the legacy legend into stable ground and object layers without changing tile semantics', () => {
    const map: MapDef = {
      id: 'render-test',
      name: 'render test',
      width: 3,
      height: 2,
      rows: ['gWf', ' p '],
      legend: {
        g: { kind: 'grass' },
        W: { kind: 'wall', ground: 'path' },
        f: { kind: 'field' },
        p: { kind: 'path' },
      },
      spawn: { x: 0, y: 0 },
    };

    expect(legacyMapRenderPlan(map)).toEqual({
      mapId: 'render-test',
      width: 3,
      height: 2,
      tiles: [
        { x: 0, y: 0, base: 'grass', ground: 'grass', object: null },
        { x: 1, y: 0, base: 'wall', ground: 'path', object: 'wall' },
        { x: 2, y: 0, base: 'field', ground: 'field', object: null },
        { x: 1, y: 1, base: 'path', ground: 'path', object: null },
      ],
    });
  });

  it('uses the existing map-family floor fallback for an isolated legacy object', () => {
    const map: MapDef = {
      id: 'house',
      name: 'house',
      width: 1,
      height: 1,
      rows: ['B'],
      legend: { B: { kind: 'bed' } },
      spawn: { x: 0, y: 0 },
    };

    expect(legacyMapRenderPlan(map).tiles).toEqual([
      { x: 0, y: 0, base: 'bed', ground: 'floor', object: 'bed' },
    ]);
  });
});

describe('plotRenderPlan', () => {
  it('uses per-crop visual milestones and keeps candidate sprites at native scale', () => {
    const map: MapDef = {
      id: 'farm',
      name: 'farm',
      width: 3,
      height: 2,
      rows: ['ggg', 'ggg'],
      legend: { g: { kind: 'grass' } },
      spawn: { x: 0, y: 0 },
    };
    const plots: PlotMap = {
      'farm|0,0': { watered: false, crop: { cropId: 'radish', growthDays: 1 }, dryDays: 0 },
      'farm|1,0': { watered: true, crop: { cropId: 'radish', growthDays: 2 }, dryDays: 0 },
      'farm|2,0': { watered: false, crop: { cropId: 'radish', growthDays: 8 }, dryDays: 0 },
      'farm|3,0': { watered: false, crop: null, dryDays: 0 },
    };

    const crops: Record<string, Pick<CropDef, 'id' | 'growthDays' | 'visualGrowthStages'>> = {
      'dew-grass': { id: 'dew-grass', growthDays: 1, visualGrowthStages: [{ day: 0, stage: 'seed' }, { day: 1, stage: 'mature' }] },
      'moon-bean': { id: 'moon-bean', growthDays: 2, visualGrowthStages: [{ day: 0, stage: 'seed' }, { day: 1, stage: 'sprout' }, { day: 2, stage: 'mature' }] },
      radish: { id: 'radish', growthDays: 3, visualGrowthStages: [{ day: 0, stage: 'seed' }, { day: 1, stage: 'sprout' }, { day: 2, stage: 'growing-1' }, { day: 3, stage: 'mature' }] },
    };
    expect(plotRenderPlan(plots, map, (cropId) => crops[cropId]!)).toEqual([
      { x: 0, y: 0, watered: false, crop: { cropId: 'radish', stage: 'sprout' } },
      { x: 1, y: 0, watered: true, crop: { cropId: 'radish', stage: 'growing-1' } },
      { x: 2, y: 0, watered: false, crop: { cropId: 'radish', stage: 'mature' } },
    ]);
  });

  it('keeps the legacy fallback for crops without optional visual milestones', () => {
    const plots: PlotMap = {
      'farm|0,0': { watered: false, crop: { cropId: 'legacy', growthDays: 2 }, dryDays: 0 },
    };
    const map: MapDef = { id: 'farm', name: 'farm', width: 1, height: 1, rows: ['g'], legend: { g: { kind: 'grass' } }, spawn: { x: 0, y: 0 } };

    expect(plotRenderPlan(plots, map, () => ({ id: 'legacy', growthDays: 4 }))[0]?.crop).toEqual({
      cropId: 'legacy', stage: 'sprout', scale: 0.75, alpha: 0.75,
    });
  });
});
