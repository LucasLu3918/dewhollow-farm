import { describe, expect, it } from 'vitest';
import type { MapDef, TileKind } from '../domain/content';
import {
  worldV2CandidateFramesFromManifest,
  worldV2SceneCandidateFrameFor,
  worldV2SceneCandidateRequested,
} from './world-v2-scene-candidate';

const farm: MapDef = {
  id: 'farm',
  name: 'farm',
  width: 4,
  height: 3,
  rows: ['....', '.f=.', '....'],
  legend: {
    '.': { kind: 'grass' },
    f: { kind: 'field' },
    '=': { kind: 'path' },
  },
  spawn: { x: 0, y: 0 },
};

const house: MapDef = {
  id: 'house',
  name: 'house',
  width: 5,
  height: 4,
  rows: ['#####', '#BKW#', '#...#', '##D##'],
  legend: {
    '#': { kind: 'wall' },
    '.': { kind: 'floor' },
    B: { kind: 'bed' },
    K: { kind: 'kitchen' },
    W: { kind: 'workbench' },
    D: { kind: 'door' },
  },
  spawn: { x: 2, y: 2 },
};

const farmBoundary: MapDef = {
  ...farm,
  width: 4,
  rows: ['####', '#WW#', '#W.#', '####'],
  legend: {
    '#': { kind: 'wall' },
    W: { kind: 'fence', ground: 'grass' },
    '.': { kind: 'grass' },
  },
};

describe('world-v2 scene candidate gate', () => {
  it('requires DEV, the Pixel32 runtime, and the exact scene visual opt-in', () => {
    expect(worldV2SceneCandidateRequested(new URLSearchParams('gate1SceneVisual=world-v2-cozy'), true, 'pixel32', true)).toBe(true);
    expect(worldV2SceneCandidateRequested(new URLSearchParams('gate1SceneVisual=world-v2-cozy'), false, 'pixel32', true)).toBe(false);
    expect(worldV2SceneCandidateRequested(new URLSearchParams('gate1SceneVisual=world-v2-cozy'), true, 'legacy', true)).toBe(false);
    expect(worldV2SceneCandidateRequested(new URLSearchParams('gate1SceneVisual=world-v2-cozy'), true, 'pixel32', false)).toBe(false);
    expect(worldV2SceneCandidateRequested(new URLSearchParams('gate1SceneVisual=world-v2'), true, 'pixel32', true)).toBe(false);
  });

  it('accepts only exact-grid, explicitly unapproved atlases with every required frame', () => {
    const manifest = {
      status: 'candidate',
      approved: false,
      pixelContract: { nativeTileSize: 32, displayScale: 2 },
      atlas: { file: 'atlas.png', width: 64, height: 32 },
      frames: {
        'grass-base': { x: 0, y: 0, width: 32, height: 32, approved: false },
        'house-exterior': { x: 32, y: 0, width: 32, height: 32, approved: false },
      },
    };
    expect(worldV2CandidateFramesFromManifest(manifest, 'atlas.png', ['grass-base', 'house-exterior'])).not.toBeNull();
    expect(worldV2CandidateFramesFromManifest(manifest, 'wrong.png', ['grass-base'])).toBeNull();
    expect(worldV2CandidateFramesFromManifest(manifest, 'atlas.png', ['missing'])).toBeNull();
    expect(worldV2CandidateFramesFromManifest({ ...manifest, approved: true }, 'atlas.png', ['grass-base'])).toBeNull();
    expect(worldV2CandidateFramesFromManifest({
      ...manifest,
      frames: { 'grass-base': { x: 0, y: 0, width: 32, height: 32 } },
    }, 'atlas.png', ['grass-base'])).toBeNull();
    const arrayManifest = {
      status: 'candidate',
      approved: false,
      pixelContract: { nativeTileSize: 32, displayScale: 2 },
      atlas: { file: 'atlas.png', width: 64, height: 32 },
      frames: [{ id: 'floor-a', rect: { x: 0, y: 0, width: 32, height: 32 }, approved: false }],
    };
    expect(worldV2CandidateFramesFromManifest(arrayManifest, 'atlas.png', ['floor-a'])).toEqual({
      'floor-a': { x: 0, y: 0, width: 32, height: 32, approved: false },
    });
    expect(worldV2CandidateFramesFromManifest({
      ...arrayManifest,
      frames: [...arrayManifest.frames, { ...arrayManifest.frames[0], id: 'floor-a' }],
    }, 'atlas.png', ['floor-a'])).toBeNull();
    expect(worldV2CandidateFramesFromManifest({
      ...arrayManifest,
      frames: [{ ...arrayManifest.frames[0], rect: { x: 32, y: 0, width: 33, height: 32 } }],
    }, 'atlas.png', ['floor-a'])).toBeNull();
  });

  it('maps only farm candidate ground kinds and leaves unsupported kinds on the legacy path', () => {
    expect(worldV2SceneCandidateFrameFor(farm, 0, 0, 'ground')).toBe('grass-base');
    expect(worldV2SceneCandidateFrameFor(farm, 1, 1, 'ground')).toBe('field-mask-00');
    expect(worldV2SceneCandidateFrameFor(farm, 2, 1, 'ground')).toBe('path-mask-00');
    expect(worldV2SceneCandidateFrameFor(farm, 2, 1, 'object')).toBeNull();
    expect(worldV2SceneCandidateFrameFor({ ...farm, id: 'village' }, 0, 0, 'ground')).toBeNull();
    const fieldPair = { ...farm, rows: ['....', '..ff', '....'] };
    expect(worldV2SceneCandidateFrameFor(fieldPair, 2, 1, 'ground')).toBe('field-mask-02');
    expect(worldV2SceneCandidateFrameFor(fieldPair, 3, 1, 'ground')).toBe('field-mask-08');
  });

  it('maps farm stone borders and fence rails from neighboring fence tiles', () => {
    expect(worldV2SceneCandidateFrameFor(farmBoundary, 0, 0, 'ground')).toBe('grass-base');
    expect(worldV2SceneCandidateFrameFor(farmBoundary, 0, 0, 'object')).toBe('stone-wall');
    expect(worldV2SceneCandidateFrameFor(farmBoundary, 1, 1, 'object')).toBe('fence-south-east');
    expect(worldV2SceneCandidateFrameFor(farmBoundary, 2, 1, 'object')).toBe('fence-horizontal');
    expect(worldV2SceneCandidateFrameFor(farmBoundary, 1, 2, 'object')).toBe('fence-vertical');
  });

  it('keeps house floor and wall layers distinct and leaves multi-tile furniture to layout placements', () => {
    expect(worldV2SceneCandidateFrameFor(house, 0, 0, 'object')).toBe('wall-left-corner');
    expect(worldV2SceneCandidateFrameFor(house, 4, 0, 'object')).toBe('wall-right-corner');
    expect(worldV2SceneCandidateFrameFor(house, 2, 0, 'object')).toBe('wall-window');
    expect(worldV2SceneCandidateFrameFor(house, 2, 0, 'ground')).toBe('floor-a');
    expect(worldV2SceneCandidateFrameFor(house, 0, 1, 'object')).toBe('wall-middle');
    expect(worldV2SceneCandidateFrameFor(house, 2, 2, 'ground')).toBe('floor-a');
    expect(worldV2SceneCandidateFrameFor(house, 2, 3, 'ground')).toBe('floor-b');
    expect(worldV2SceneCandidateFrameFor(house, 2, 3, 'object')).toBeNull();
    expect(worldV2SceneCandidateFrameFor(house, 2, 3, 'ground')).toBe('floor-b');
    expect(worldV2SceneCandidateFrameFor(house, 1, 1, 'object')).toBeNull();
    expect(worldV2SceneCandidateFrameFor(house, 2, 1, 'object')).toBeNull();
    expect(worldV2SceneCandidateFrameFor(house, 3, 1, 'object')).toBeNull();
    expect(house.rows).toEqual(['#####', '#BKW#', '#...#', '##D##']);
  });

  it('keeps remodeled houses on the legacy renderer until matching layouts exist', () => {
    for (const id of ['house-wing', 'house-full']) {
      const remodeledHouse = { ...house, id };
      expect(worldV2SceneCandidateFrameFor(remodeledHouse, 0, 0, 'ground')).toBeNull();
      expect(worldV2SceneCandidateFrameFor(remodeledHouse, 0, 0, 'object')).toBeNull();
    }
  });
});

// Compile-time guard: planner accepts only the domain's map tile contract.
const _tileKind: TileKind = 'floor';
void _tileKind;
