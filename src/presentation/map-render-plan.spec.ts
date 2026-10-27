import { describe, expect, it } from 'vitest';
import type { MapDef } from '../domain/content';
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
  it('keeps map bounds and the legacy seed/sprout/mature growth thresholds', () => {
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
      '0,0': { watered: false, crop: { cropId: 'radish', growthDays: 1 }, dryDays: 0 },
      '1,0': { watered: true, crop: { cropId: 'radish', growthDays: 3 }, dryDays: 0 },
      '2,0': { watered: false, crop: { cropId: 'radish', growthDays: 8 }, dryDays: 0 },
      '3,0': { watered: false, crop: null, dryDays: 0 },
    };

    expect(plotRenderPlan(plots, map, () => 10)).toEqual([
      { x: 0, y: 0, watered: false, crop: { cropId: 'radish', stage: 'seed', scale: 0.55, alpha: 0.55 } },
      { x: 1, y: 0, watered: true, crop: { cropId: 'radish', stage: 'sprout', scale: 0.65, alpha: 0.65 } },
      { x: 2, y: 0, watered: false, crop: { cropId: 'radish', stage: 'mature', scale: 0.9, alpha: 0.9 } },
    ]);
  });
});
