import { describe, expect, it } from 'vitest';
import type { MapDef } from '../domain/content';
import greenhouseContent from '../../content/maps/greenhouse.json';
import {
  INDOOR_FARM_REQUIRED_FRAMES,
  INDOOR_MINE_REQUIRED_FRAMES,
  indoorSceneCandidateFrameFor,
  indoorSceneCandidateFramesFromManifest,
  indoorSceneCandidateRequested,
} from './indoor-scene-candidate';

const coop: MapDef = {
  id: 'coop', name: 'coop', width: 4, height: 3,
  rows: ['####', '#P.#', '#D##'],
  legend: {
    '#': { kind: 'wall' }, '.': { kind: 'floor' }, P: { kind: 'floor', slot: true }, D: { kind: 'door' },
  },
  spawn: { x: 1, y: 1 },
};

const mine: MapDef = {
  id: 'mine-41', name: 'mine', width: 5, height: 3,
  rows: ['#####', '#os<#', '#.r>#'],
  legend: {
    '#': { kind: 'wall' }, o: { kind: 'ore', item: 'copper-ore' }, s: { kind: 'ore', item: 'silver-ore' },
    '<': { kind: 'stairs', to: 'mine-40' }, '>': { kind: 'stairs', to: 'mine-42' }, '.': { kind: 'path' }, r: { kind: 'rock' },
  },
  spawn: { x: 1, y: 1 },
};

const greenhouse = greenhouseContent as MapDef;

function manifest(requiredFrames: readonly string[]) {
  const ids = [...requiredFrames];
  const width = 32 * ids.length;
  return {
    status: 'candidate', approved: false,
    pixelContract: { nativeTileSize: 32, displayScale: 2 },
    atlas: { file: 'atlas.png', width, height: 32 },
    frames: Object.fromEntries(ids.map((id, index) => [id, {
      x: index * 32, y: 0, width: 32, height: 32, approved: false,
    }])),
  };
}

describe('P6-062 indoor scene candidate', () => {
  it('requires the exact DEV, Pixel32, runtime and P6-062 gate', () => {
    const query = new URLSearchParams('gate1IndoorScene=p6-062');
    expect(indoorSceneCandidateRequested(query, true, 'pixel32', true)).toBe(true);
    expect(indoorSceneCandidateRequested(query, false, 'pixel32', true)).toBe(false);
    expect(indoorSceneCandidateRequested(query, true, 'legacy', true)).toBe(false);
    expect(indoorSceneCandidateRequested(query, true, 'pixel32', false)).toBe(false);
    expect(indoorSceneCandidateRequested(new URLSearchParams('gate1IndoorScene=other'), true, 'pixel32', true)).toBe(false);
  });

  it('validates explicitly unapproved farm and mine candidate manifests', () => {
    expect(indoorSceneCandidateFramesFromManifest(manifest(INDOOR_FARM_REQUIRED_FRAMES), 'atlas.png', INDOOR_FARM_REQUIRED_FRAMES)).not.toBeNull();
    expect(indoorSceneCandidateFramesFromManifest(manifest(INDOOR_MINE_REQUIRED_FRAMES), 'atlas.png', INDOOR_MINE_REQUIRED_FRAMES)).not.toBeNull();
    expect(indoorSceneCandidateFramesFromManifest({ ...manifest(INDOOR_MINE_REQUIRED_FRAMES), approved: true }, 'atlas.png', INDOOR_MINE_REQUIRED_FRAMES)).toBeNull();
    expect(indoorSceneCandidateFramesFromManifest(manifest(INDOOR_FARM_REQUIRED_FRAMES.slice(1)), 'atlas.png', INDOOR_FARM_REQUIRED_FRAMES)).toBeNull();
  });

  it('maps coop floors, wall and animal stall without changing interaction tiles', () => {
    expect(indoorSceneCandidateFrameFor(coop, 1, 1, 'ground')).toEqual({ atlas: 'farm', frame: 'coop-stall' });
    expect(indoorSceneCandidateFrameFor(coop, 2, 1, 'ground')).toEqual({ atlas: 'farm', frame: 'coop-floor-b' });
    expect(indoorSceneCandidateFrameFor(coop, 0, 0, 'object')).toEqual({ atlas: 'farm', frame: 'coop-wall' });
    expect(indoorSceneCandidateFrameFor(coop, 1, 2, 'object')).toBeNull();
    expect(coop.rows).toEqual(['####', '#P.#', '#D##']);
  });

  it('maps dynamic mine layers from their existing item and stair destinations', () => {
    expect(indoorSceneCandidateFrameFor(mine, 1, 1, 'object')).toEqual({ atlas: 'mine', frame: 'ore-copper' });
    expect(indoorSceneCandidateFrameFor(mine, 2, 1, 'object')).toEqual({ atlas: 'mine', frame: 'ore-silver' });
    expect(indoorSceneCandidateFrameFor(mine, 3, 1, 'object')).toEqual({ atlas: 'mine', frame: 'stairs-up' });
    expect(indoorSceneCandidateFrameFor(mine, 3, 2, 'object')).toEqual({ atlas: 'mine', frame: 'stairs-down' });
    expect(indoorSceneCandidateFrameFor(mine, 2, 2, 'object')).toEqual({ atlas: 'mine', frame: 'loose-rock' });
    expect(indoorSceneCandidateFrameFor(mine, 0, 0, 'object')).toEqual({ atlas: 'mine', frame: 'rock-wall' });
  });

  it('stacks the greenhouse ground, glass, door, and front wall in the standalone small map', () => {
    expect(indoorSceneCandidateFrameFor(greenhouse, 1, 2, 'ground')).toEqual({ atlas: 'farm', frame: 'greenhouse-ground' });
    expect(indoorSceneCandidateFrameFor(greenhouse, 0, 2, 'object')).toEqual({ atlas: 'farm', frame: 'greenhouse-glass' });
    expect(indoorSceneCandidateFrameFor(greenhouse, 6, 8, 'object')).toEqual({ atlas: 'farm', frame: 'greenhouse-door' });
    expect(indoorSceneCandidateFrameFor(greenhouse, 1, 8, 'object')).toEqual({ atlas: 'farm', frame: 'greenhouse-front' });
    expect(greenhouse.rows[1]).toBe('#gggg..gggg#');
    expect(greenhouse.rows[4]).toBe('#..........#');
    expect(greenhouse.rows[5]).toBe('#gggg..gggg#');
  });
});
