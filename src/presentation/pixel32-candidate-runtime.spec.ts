import { describe, expect, it } from 'vitest';
import farm from '../../content/maps/farm.json';
import type { MapDef } from '../domain/content';
import {
  PIXEL32_CANDIDATE_OVERLAYS,
  candidateFramesFromManifest,
  pixel32CandidateRuntimeRequested,
  pixel32MapFrameFor,
  pixel32OverlayPreviewRequested,
} from './pixel32-candidate-runtime';

const farmMap = farm as MapDef;

describe('pixel32 candidate runtime opt-in', () => {
  it('requires development mode and both explicit query values', () => {
    const search = new URLSearchParams('renderProfile=pixel32&gate1Runtime=pixel32-map-animation');
    expect(pixel32CandidateRuntimeRequested(search, true)).toBe(true);
    expect(pixel32CandidateRuntimeRequested(search, false)).toBe(false);
    expect(pixel32CandidateRuntimeRequested(new URLSearchParams('gate1Runtime=pixel32-map-animation'), true)).toBe(false);
    expect(pixel32CandidateRuntimeRequested(new URLSearchParams('renderProfile=pixel32'), true)).toBe(false);
  });
});

describe('pixel32 candidate manifest frames', () => {
  const valid = {
    status: 'candidate',
    approved: false,
    atlas: { file: 'map-atlas.png', width: 64, height: 64 },
    frames: { 'spring-grass': { x: 0, y: 0, width: 32, height: 32, approved: false as const } },
  };

  it('accepts only a candidate manifest with explicitly unapproved valid frames', () => {
    expect(candidateFramesFromManifest(valid, 'map-atlas.png')).toEqual(valid.frames);
    expect(candidateFramesFromManifest({ ...valid, approved: true }, 'map-atlas.png')).toBeNull();
    expect(candidateFramesFromManifest({ ...valid, status: 'approved' }, 'map-atlas.png')).toBeNull();
    expect(candidateFramesFromManifest({ ...valid, atlas: { ...valid.atlas, file: 'other.png' } }, 'map-atlas.png')).toBeNull();
    expect(candidateFramesFromManifest({ ...valid, frames: { bad: { x: -1, y: 0, width: 32, height: 32, approved: false } } }, 'map-atlas.png')).toBeNull();
    expect(candidateFramesFromManifest({ ...valid, frames: { bad: { x: 40, y: 0, width: 32, height: 32, approved: false } } }, 'map-atlas.png')).toBeNull();
    expect(candidateFramesFromManifest({ ...valid, frames: { unmarked: { x: 0, y: 0, width: 32, height: 32 } } }, 'map-atlas.png')).toEqual({
      unmarked: { x: 0, y: 0, width: 32, height: 32 },
    });
    expect(candidateFramesFromManifest({ ...valid, frames: { approved: { x: 0, y: 0, width: 32, height: 32, approved: true } } }, 'map-atlas.png')).toBeNull();
  });
});

describe('pixel32 seasonal map frames', () => {
  it('uses seasonal ground frames and computes grass-edge bits around field tiles', () => {
    expect(pixel32MapFrameFor('tile.grass', 'winter', farmMap, 2, 7)).toBe('winter-grass');
    expect(pixel32MapFrameFor('tile.path', 'autumn', farmMap, 2, 7)).toBe('autumn-path');
    expect(pixel32MapFrameFor('tile.water', 'summer', farmMap, 2, 7)).toBe('summer-water');

    const edgeMap: MapDef = {
      ...farm,
      width: 3,
      height: 3,
      rows: ['ggg', 'gfg', 'ggg'],
      legend: {
        g: { kind: 'grass' as const },
        f: { kind: 'field' as const },
      },
    };
    expect(pixel32MapFrameFor('tile.field', 'spring', edgeMap, 1, 1)).toBe('spring-field-edge-f');
    expect(pixel32MapFrameFor('tile.grass', 'spring', edgeMap, 1, 0)).toBe('spring-grass');
    expect(pixel32MapFrameFor('tile.field', 'spring', edgeMap, 1, 1, (x, y) => x === 0 && y === 1 ? 'grass' : 'field'))
      .toBe('spring-field-edge-8');
    expect(pixel32MapFrameFor('tile.soil', 'spring', farmMap, 2, 7)).toBeNull();
  });
});

describe('pixel32 overlay candidate preview', () => {
  it('requires DEV mode, the base pixel32 runtime, and the exact overlay query', () => {
    const query = new URLSearchParams('gate1OverlayPreview=pixel32-overlay-12x10');

    expect(pixel32OverlayPreviewRequested(query, true, true)).toBe(true);
    expect(pixel32OverlayPreviewRequested(query, false, true)).toBe(false);
    expect(pixel32OverlayPreviewRequested(query, true, false)).toBe(false);
    expect(pixel32OverlayPreviewRequested(new URLSearchParams('gate1OverlayPreview=true'), true, true)).toBe(false);
    expect(pixel32OverlayPreviewRequested(new URLSearchParams(), true, true)).toBe(false);
  });

  it('keeps a deterministic 3-layer review layout with the house panels sharing one anchor', () => {
    expect(PIXEL32_CANDIDATE_OVERLAYS.map(({ id, layer }) => ({ id, layer }))).toEqual([
      { id: 'house-back', layer: 'back' },
      { id: 'tree-canopy', layer: 'front' },
      { id: 'house-front', layer: 'front' },
    ]);
    expect(PIXEL32_CANDIDATE_OVERLAYS[0]).toMatchObject({ tileX: 3, tileY: 3, widthTiles: 3, heightTiles: 2 });
    expect(PIXEL32_CANDIDATE_OVERLAYS[2]).toMatchObject({ tileX: 3, tileY: 3, widthTiles: 3, heightTiles: 2 });
  });
});
