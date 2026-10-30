import { describe, expect, it } from 'vitest';
import farm from '../../content/maps/farm.json';
import type { MapDef } from '../domain/content';
import {
  PIXEL32_CANDIDATE_OVERLAYS,
  PIXEL32_CANDIDATE_INTERACTABLES,
  candidateFramesFromManifest,
  explicitlyUnapprovedCandidateFramesFromManifest,
  pixel32CandidatePetFrame,
  pixel32CandidatePetFollowRequested,
  pixel32CandidateReviewRequested,
  pixel32CandidateRuntimeRequested,
  pixel32InteractablesPreviewRequested,
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

  it('can require an explicit approved:false marker on every frame for gated assets', () => {
    expect(explicitlyUnapprovedCandidateFramesFromManifest(valid, 'map-atlas.png')).toEqual(valid.frames);
    expect(explicitlyUnapprovedCandidateFramesFromManifest({
      ...valid,
      frames: { missing: { x: 0, y: 0, width: 32, height: 32 } },
    }, 'map-atlas.png')).toBeNull();
    expect(explicitlyUnapprovedCandidateFramesFromManifest({
      ...valid,
      frames: { approved: { x: 0, y: 0, width: 32, height: 32, approved: true } },
    }, 'map-atlas.png')).toBeNull();
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

  it('keeps a deterministic DEV review layout beside reachable farm paths with shared house anchors', () => {
    expect(PIXEL32_CANDIDATE_OVERLAYS.map(({ id, layer }) => ({ id, layer }))).toEqual([
      { id: 'house-back', layer: 'back' },
      { id: 'tree-canopy', layer: 'front' },
      { id: 'house-front', layer: 'front' },
    ]);
    expect(PIXEL32_CANDIDATE_OVERLAYS[0]).toMatchObject({ tileX: 19, tileY: 9, widthTiles: 3, heightTiles: 2 });
    expect(PIXEL32_CANDIDATE_OVERLAYS[1]).toMatchObject({ tileX: 19, tileY: 3, widthTiles: 2, heightTiles: 2 });
    expect(PIXEL32_CANDIDATE_OVERLAYS[2]).toMatchObject({ tileX: 19, tileY: 9, widthTiles: 3, heightTiles: 2 });
    expect(PIXEL32_CANDIDATE_OVERLAYS.every(({ tileX, tileY }) => tileX >= 0 && tileY >= 0)).toBe(true);
  });
});

describe('pixel32 interactables candidate preview', () => {
  it('requires DEV mode, the base pixel32 runtime, and the exact interactables query', () => {
    const query = new URLSearchParams('gate1InteractablePreview=pixel32-interactables');

    expect(pixel32InteractablesPreviewRequested(query, true, true)).toBe(true);
    expect(pixel32InteractablesPreviewRequested(query, false, true)).toBe(false);
    expect(pixel32InteractablesPreviewRequested(query, true, false)).toBe(false);
    expect(pixel32InteractablesPreviewRequested(new URLSearchParams('gate1InteractablePreview=true'), true, true)).toBe(false);
    expect(pixel32InteractablesPreviewRequested(new URLSearchParams(), true, true)).toBe(false);
  });

  it('keeps four fixed, collision-free samples beside the farm door and shipbox', () => {
    expect(PIXEL32_CANDIDATE_INTERACTABLES).toEqual([
      { id: 'door-closed', frame: 'door-closed', tileX: 2, tileY: 4 },
      { id: 'door-open', frame: 'door-open', tileX: 4, tileY: 4 },
      { id: 'shipbox-closed', frame: 'shipbox-closed', tileX: 2, tileY: 7 },
      { id: 'shipbox-open', frame: 'shipbox-open', tileX: 4, tileY: 7 },
    ]);
  });
});

describe('pixel32 candidate asset review opt-in', () => {
  it('requires DEV, the base runtime, and the exact review query', () => {
    const query = new URLSearchParams('gate1AssetPreview=pixel32-candidates');
    expect(pixel32CandidateReviewRequested(query, true, true)).toBe(true);
    expect(pixel32CandidateReviewRequested(query, false, true)).toBe(false);
    expect(pixel32CandidateReviewRequested(query, true, false)).toBe(false);
    expect(pixel32CandidateReviewRequested(new URLSearchParams('gate1AssetPreview=true'), true, true)).toBe(false);
  });
});

describe('pixel32 candidate cat and quokka follow opt-in', () => {
  const query = new URLSearchParams(
    'renderProfile=pixel32&gate1Runtime=pixel32-map-animation&gate1AssetPreview=pixel32-candidates&gate1CandidatePetFollow=pixel32-cat-quokka-follow',
  );

  it('requires development mode, the pixel32 runtime, candidate assets, and the exact pet-follow query', () => {
    expect(pixel32CandidatePetFollowRequested(query, true, true, true)).toBe(true);
    expect(pixel32CandidatePetFollowRequested(query, false, true, true)).toBe(false);
    expect(pixel32CandidatePetFollowRequested(query, true, false, true)).toBe(false);
    expect(pixel32CandidatePetFollowRequested(query, true, true, false)).toBe(false);
    expect(pixel32CandidatePetFollowRequested(new URLSearchParams('gate1CandidatePetFollow=pixel32-cat-quokka-follow'), true, false, false)).toBe(false);
    expect(pixel32CandidatePetFollowRequested(new URLSearchParams('gate1CandidatePetFollow=pixel32-cat-follow'), true, true, true)).toBe(false);
    expect(pixel32CandidatePetFollowRequested(new URLSearchParams('gate1CandidatePetFollow=true'), true, true, true)).toBe(false);
  });

  it('plays each species manifest hop-a, hop-b, land sequence then returns to its directional idle frame', () => {
    for (const art of ['cat', 'quokka'] as const) {
      expect(pixel32CandidatePetFrame(art, 'down', null)).toBe(`${art}-down-idle`);
      expect(pixel32CandidatePetFrame(art, 'left', 0)).toBe(`${art}-left-hop-a`);
      expect(pixel32CandidatePetFrame(art, 'left', 129)).toBe(`${art}-left-hop-a`);
      expect(pixel32CandidatePetFrame(art, 'left', 130)).toBe(`${art}-left-hop-b`);
      expect(pixel32CandidatePetFrame(art, 'left', 259)).toBe(`${art}-left-hop-b`);
      expect(pixel32CandidatePetFrame(art, 'left', 260)).toBe(`${art}-left-land`);
      expect(pixel32CandidatePetFrame(art, 'left', 389)).toBe(`${art}-left-land`);
      expect(pixel32CandidatePetFrame(art, 'left', 390)).toBe(`${art}-left-idle`);
      expect(pixel32CandidatePetFrame(art, 'right', Number.NaN)).toBe(`${art}-right-idle`);
    }
  });
});
