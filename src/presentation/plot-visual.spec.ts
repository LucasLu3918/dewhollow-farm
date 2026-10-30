import { describe, expect, it } from 'vitest';
import type { PlotMap } from '../domain/farm';
import { plotNeighborMask, resolvePlotVisual } from './plot-visual';

describe('plotNeighborMask', () => {
  it('encodes adjacent tilled plots as north/east/south/west bits', () => {
    const plots: PlotMap = {
      'farm|2,1': { watered: false, crop: null, dryDays: 0 },
      'farm|3,2': { watered: false, crop: null, dryDays: 0 },
      'farm|2,3': { watered: false, crop: null, dryDays: 0 },
      'farm|1,2': { watered: false, crop: null, dryDays: 0 },
      '2,2': { watered: false, crop: null, dryDays: 0 },
      '1,1': { watered: true, crop: null, dryDays: 0 },
    };

    expect(plotNeighborMask(2, 2, plots, false)).toBe(0b1111);
    expect(plotNeighborMask(2, 2, { ...plots, 'farm|3,2': { watered: true, crop: null, dryDays: 0 } }, false)).toBe(0b1101);
    expect(plotNeighborMask(0, 0, plots, false)).toBe(0);
  });
});

describe('resolvePlotVisual', () => {
  it('selects a season/moisture-specific soil autotile and exposes a shared foot anchor', () => {
    const dry = resolvePlotVisual({ watered: false, crop: null }, null, 0b1010, 'spring');
    const wet = resolvePlotVisual({ watered: true, crop: null }, null, 0b1010, 'winter');

    expect(dry).toEqual({
      phase: 'tilled-dry', soilFrame: 'spring-dry-soil-edge-a',
      anchor: { x: 32, y: 62 }, depthLayer: 1,
    });
    expect(wet.soilFrame).toBe('winter-wet-soil-edge-a');
    expect(wet.phase).toBe('tilled-wet');
  });

  it('uses crop-provided milestones without embedding growth thresholds', () => {
    const plot = { watered: true, dryDays: 0, crop: { cropId: 'test-crop', growthDays: 5 } };
    const visual = resolvePlotVisual(plot, {
      seedFrame: 'crop/test-crop/seed',
      milestones: [
        { day: 0, phase: 'seeded-wet', frame: 'crop/test-crop/seed' },
        { day: 2, phase: 'sprout', frame: 'crop/test-crop/sprout' },
        { day: 5, phase: 'mature', frame: 'crop/test-crop/mature' },
      ],
    }, 0, 'summer');

    expect(visual).toMatchObject({
      phase: 'mature', plantFrame: 'crop/test-crop/mature', highlight: 'harvestable',
    });
  });
});
