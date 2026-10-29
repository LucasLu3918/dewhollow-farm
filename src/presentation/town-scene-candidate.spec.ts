import { describe, expect, it } from 'vitest';
import village from '../../content/maps/village.json';
import plaza from '../../content/maps/plaza.json';
import type { MapDef } from '../domain/content';
import {
  TOWN_SCENE_CANDIDATE_REQUIRED_FRAMES,
  TOWN_SCENE_CANDIDATE_TILE_FRAMES,
  townSceneCandidateTileFrameFor,
  townSceneCandidateFramesFromManifest,
  townSceneCandidatePlacements,
  townSceneCandidateReplacesTileObject,
  townSceneCandidateRequested,
  townSceneCandidateScale,
} from './town-scene-candidate';

const REQUIRED_FRAMES = [
  'general-store', 'blacksmith', 'night-market-stall', 'traveling-merchant-cart',
  'bulletin-board', 'anvil', 'lantern', 'vegetable-crate', 'flower-planter',
  'bench', 'festival-pennants', 'well', 'market-display-table', 'coal-brazier',
  'blank-signpost', 'barrel-and-sack',
] as const;

function manifest() {
  return {
    candidateId: 'p6-village-plaza',
    status: 'candidate',
    approved: false,
    runtimeAtlas: 'atlas.png',
    atlas: {
      width: 544, height: 256, columns: 4, rows: 4, frameWidth: 64, frameHeight: 64,
      tileFrameWidth: 32, tileFrameHeight: 32, tileFrameStartX: 256, tileFrameStartY: 0,
      scale: 2, rendering: 'nearest-neighbor',
    },
    frames: REQUIRED_FRAMES.map((id, index) => ({
      index, id, x: index % 4 * 64, y: Math.floor(index / 4) * 64, width: 64, height: 64,
    })),
    tileFrames: ['grass-base', 'grass-dapple-a', 'grass-dapple-b', 'grass-flower', 'path-stone', 'path-stone-alt', 'plaza-cobble', 'plaza-cobble-alt', 'wall-stone']
      .map((id, index) => ({ id, x: 256 + index * 32, y: 0, width: 32, height: 32, tileable: true, approved: false })),
  };
}

describe('town scene candidate', () => {
  it('requires DEV, pixel32 runtime, and the single exact town visual gate', () => {
    expect(townSceneCandidateRequested(new URLSearchParams('gate1TownVisual=p6-060'), true, true)).toBe(true);
    expect(townSceneCandidateRequested(new URLSearchParams('gate1TownVisual=p6-060&gate1TownVisual=p6-060'), true, true)).toBe(false);
    expect(townSceneCandidateRequested(new URLSearchParams('gate1TownVisual=p6-060x'), true, true)).toBe(false);
    expect(townSceneCandidateRequested(new URLSearchParams('gate1TownVisual=p6-060'), false, true)).toBe(false);
    expect(townSceneCandidateRequested(new URLSearchParams('gate1TownVisual=p6-060'), true, false)).toBe(false);
  });

  it('accepts only the original unapproved prop and ground tile atlas contract', () => {
    expect(TOWN_SCENE_CANDIDATE_REQUIRED_FRAMES).toEqual(REQUIRED_FRAMES);
    const frames = townSceneCandidateFramesFromManifest(manifest());
    expect(frames).toEqual(Object.fromEntries([
      REQUIRED_FRAMES.map((id, index) => [id, {
        x: index % 4 * 64, y: Math.floor(index / 4) * 64, width: 64, height: 64,
      }]),
      manifest().tileFrames.map(({ id, x, y, width, height }) => [id, { x, y, width, height }]),
    ].flat()));
    expect(Object.keys(frames ?? {})).toHaveLength(REQUIRED_FRAMES.length + TOWN_SCENE_CANDIDATE_TILE_FRAMES.length);
    expect(townSceneCandidateFramesFromManifest({ ...manifest(), approved: true })).toBeNull();
    expect(townSceneCandidateFramesFromManifest({ ...manifest(), runtimeAtlas: 'other.png' })).toBeNull();
    expect(townSceneCandidateFramesFromManifest({ ...manifest(), frames: manifest().frames.slice(1) })).toBeNull();
    expect(townSceneCandidateFramesFromManifest({ ...manifest(), tileFrames: [] })).toBeNull();
    expect(townSceneCandidateFramesFromManifest({
      ...manifest(),
      frames: manifest().frames.map((frame, index) => index === 0 ? { ...frame, x: 64 } : frame),
    })).toBeNull();
  });

  it('anchors store and plaza art only to existing interaction/decor tiles', () => {
    const plazaMap = plaza as unknown as MapDef;
    const villagePlacements = townSceneCandidatePlacements(village as MapDef);
    expect(villagePlacements.map(({ frame, anchorTile }) => ({ frame, anchorTile }))).toEqual([
      { frame: 'general-store', anchorTile: { x: 3, y: 4 } },
      { frame: 'blacksmith', anchorTile: { x: 12, y: 4 } },
    ]);

    const plazaPlacements = townSceneCandidatePlacements(plazaMap);
    expect(plazaPlacements.map(({ frame }) => frame)).toEqual(expect.arrayContaining([
      'night-market-stall', 'traveling-merchant-cart', 'bulletin-board', 'anvil',
      'lantern', 'festival-pennants', 'well', 'bench', 'market-display-table', 'barrel-and-sack',
    ]));
    expect(plazaPlacements.map(({ frame }) => frame)).not.toEqual(expect.arrayContaining([
      'vegetable-crate', 'flower-planter', 'coal-brazier', 'blank-signpost',
    ]));
    expect(plazaPlacements.every(({ anchorTile }) => {
      const row = plazaMap.rows[anchorTile.y];
      return row !== undefined && plazaMap.legend[row[anchorTile.x] ?? ''] !== undefined;
    })).toBe(true);
    expect(townSceneCandidatePlacements({ ...(village as MapDef), id: 'farm' })).toEqual([]);
    expect(townSceneCandidateReplacesTileObject(village as MapDef, 3, 4)).toBe(true);
    expect(townSceneCandidateReplacesTileObject(plazaMap, 2, 1)).toBe(true);
    expect(townSceneCandidateReplacesTileObject(plazaMap, 2, 2)).toBe(false);
    expect(village).toEqual(expect.objectContaining({ rows: (village as MapDef).rows, legend: (village as MapDef).legend }));
  });

  it('uses tileable town ground frames and keeps small prop footprints sparse', () => {
    expect(TOWN_SCENE_CANDIDATE_TILE_FRAMES).toHaveLength(9);
    expect(townSceneCandidateTileFrameFor(village as MapDef, 1, 1)).toMatch(/^grass-/);
    expect(townSceneCandidateTileFrameFor(village as MapDef, 7, 7)).toMatch(/^path-stone/);
    expect(townSceneCandidateTileFrameFor(plaza as MapDef, 7, 7)).toMatch(/^plaza-cobble/);
    expect(townSceneCandidateTileFrameFor(plaza as MapDef, 8, 2)).toBeNull();
    expect(townSceneCandidateTileFrameFor(village as MapDef, 0, 0)).toBe('wall-stone');
    expect(townSceneCandidateTileFrameFor({ ...(village as MapDef), id: 'farm' }, 1, 1)).toBeNull();
    expect(townSceneCandidateScale('general-store')).toBe(2);
    expect(townSceneCandidateScale('night-market-stall')).toBe(1.25);
    expect(townSceneCandidateScale('bulletin-board')).toBe(1);
  });
});
