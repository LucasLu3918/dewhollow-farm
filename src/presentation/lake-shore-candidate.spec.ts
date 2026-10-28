import { describe, expect, it } from 'vitest';
import lake from '../../content/maps/lake.json';
import forest from '../../content/maps/forest.json';
import type { MapDef } from '../domain/content';
import {
  lakeShoreCandidateRequested,
  lakeShoreFrameFor,
} from './lake-shore-candidate';

const lakeMap = lake as MapDef;
const forestMap = forest as MapDef;

describe('lake shore candidate gates', () => {
  it('requires DEV, the pixel32 runtime, and the exact lake visual query', () => {
    const exact = new URLSearchParams('renderProfile=pixel32&gate1Runtime=pixel32-map-animation&gate1LakeVisual=p6-061');
    expect(lakeShoreCandidateRequested(exact, true, true)).toBe(true);
    expect(lakeShoreCandidateRequested(new URLSearchParams('renderProfile=pixel32&gate1Runtime=pixel32-map-animation'), true, true)).toBe(false);
    expect(lakeShoreCandidateRequested(exact, false, true)).toBe(false);
    expect(lakeShoreCandidateRequested(exact, true, false)).toBe(false);
    expect(lakeShoreCandidateRequested(new URLSearchParams('gate1LakeVisual=P6-061'), true, true)).toBe(false);
    expect(lakeShoreCandidateRequested(new URLSearchParams('gate1LakeVisual=p6-061&gate1LakeVisual=p6-061x'), true, true)).toBe(false);
  });
});

describe('lakeShoreFrameFor', () => {
  it('uses lake-only water and shoreline frames derived from existing grass/path adjacency', () => {
    expect(lakeShoreFrameFor(lakeMap, 2, 6)).toBe('shore-south'); // grass shoreline
    expect(lakeShoreFrameFor(lakeMap, 1, 6)).toBe('shore-south'); // path shoreline
    expect(lakeShoreFrameFor(lakeMap, 7, 7)).toBe('shore-west'); // grass shoreline
    expect(lakeShoreFrameFor(lakeMap, 2, 5)).toBe('fishing-ripple'); // static decoration only
    expect(lakeShoreFrameFor(lakeMap, 2, 7)).toBeNull(); // never replaces land
  });

  it('uses the basin frame when existing map data places shore on multiple sides', () => {
    const enclosedShore: MapDef = {
      id: 'lake',
      name: 'fixture',
      width: 3,
      height: 3,
      rows: ['~~~', '~~.', '~..'],
      legend: { '~': { kind: 'water' }, '.': { kind: 'grass' } },
      spawn: { x: 0, y: 0 },
    };
    expect(lakeShoreFrameFor(enclosedShore, 1, 1)).toBe('shore-basin');
  });

  it('does not replace water on another map or modify map data', () => {
    expect(lakeShoreFrameFor(forestMap, 2, 1)).toBeNull();
    expect(lakeMap.rows[6]).toBe('~~~~~~~~~~~~~~~~~~~~');
    expect(lakeMap.legend['~']?.kind).toBe('water');
  });
});
