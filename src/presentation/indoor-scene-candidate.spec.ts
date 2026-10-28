import { describe, expect, it } from 'vitest';
import type { MapDef } from '../domain/content';
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

const greenhouse: MapDef = {
  id: 'farm', name: 'farm', width: 34, height: 26,
  rows: Array.from({ length: 26 }, (_, y) => {
    const row = Array.from({ length: 34 }, () => '.');
    if (y === 20) { row[30] = 'Q'; row[27] = 'W'; row[28] = 'W'; row[29] = 'W'; row[31] = 'W'; row[32] = 'W'; row[33] = 'W'; }
    if (y === 21) { row[27] = 'W'; row[28] = 'g'; row[29] = 'g'; row[30] = 'q'; row[31] = 'g'; row[32] = 'g'; row[33] = 'W'; }
    if (y >= 22 && y <= 24) { row[27] = 'W'; row[33] = 'W'; }
    if (y >= 22 && y <= 24) for (let x = 28; x <= 32; x += 1) row[x] = 'g';
    if (y === 25) for (let x = 27; x <= 33; x += 1) row[x] = 'W';
    return row.join('');
  }),
  legend: {
    W: { kind: 'fence' }, Q: { kind: 'door' }, q: { kind: 'door' },
    g: { kind: 'field', greenhouse: true },
  },
  spawn: { x: 0, y: 0 },
};

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

  it('only presents greenhouse candidates after the existing unlock flag is true', () => {
    expect(indoorSceneCandidateFrameFor(greenhouse, 28, 21, 'ground', false)).toBeNull();
    expect(indoorSceneCandidateFrameFor(greenhouse, 28, 21, 'ground', true)).toEqual({ atlas: 'farm', frame: 'greenhouse-ground' });
    expect(indoorSceneCandidateFrameFor(greenhouse, 27, 21, 'object', true)).toEqual({ atlas: 'farm', frame: 'greenhouse-glass' });
    expect(indoorSceneCandidateFrameFor(greenhouse, 30, 20, 'object', true)).toEqual({ atlas: 'farm', frame: 'greenhouse-door' });
    expect(indoorSceneCandidateFrameFor(greenhouse, 30, 25, 'object', true)).toEqual({ atlas: 'farm', frame: 'greenhouse-front' });
    expect(greenhouse.rows[21]?.slice(28, 33)).toBe('ggqgg');
  });
});
