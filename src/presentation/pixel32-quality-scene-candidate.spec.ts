import { describe, expect, it } from 'vitest';
import type { MapDef } from '../domain/content';
import {
  pixel32QualitySceneCandidateRequested,
  pixel32QualitySceneFit,
  pixel32QualitySceneManifestFor,
  pixel32QualityMapProblems,
  pixel32QualityPortalProblems,
  pixel32QualitySceneAsset,
  PIXEL32_QUALITY_MAP_IDS,
} from './pixel32-quality-scene-candidate';

const originalMap: MapDef = {
  id: 'test-map',
  name: '測試地圖',
  width: 5,
  height: 5,
  rows: ['#####', '#...#', '#.F.#', '#...#', '#####'],
  legend: {
    '#': { kind: 'wall' },
    '.': { kind: 'grass' },
    F: { kind: 'forage', item: 'wild-mint' },
  },
  spawn: { x: 1, y: 1 },
};

describe('pixel32QualitySceneCandidateRequested', () => {
  it('requires DEV, pixel32 runtime, and the exact candidate opt-in', () => {
    const query = new URLSearchParams('qualityMapScene=high-detail-candidate');
    expect(pixel32QualitySceneCandidateRequested(query, true, true)).toBe(true);
    expect(pixel32QualitySceneCandidateRequested(query, false, true)).toBe(false);
    expect(pixel32QualitySceneCandidateRequested(query, true, false)).toBe(false);
    expect(pixel32QualitySceneCandidateRequested(new URLSearchParams('qualityMapScene=1'), true, true)).toBe(false);
  });
});

describe('pixel32QualitySceneManifestFor', () => {
  it('accepts only an explicitly unapproved scene for the requested map', () => {
    const manifest = {
      id: 'test-map',
      status: 'candidate',
      approved: false,
      image: 'scene.png',
      dimensions_px: { width: 1000, height: 1000 },
      sha256: 'a'.repeat(64),
    };
    expect(pixel32QualitySceneManifestFor('test-map', manifest)).toEqual({
      mapId: 'test-map',
      imageFile: 'scene.png',
      width: 1000,
      height: 1000,
      sha256: 'a'.repeat(64),
    });
    expect(pixel32QualitySceneManifestFor('test-map', { ...manifest, approved: true })).toBeNull();
    expect(pixel32QualitySceneManifestFor('farm', manifest)).toBeNull();
    expect(pixel32QualitySceneManifestFor('test-map', { ...manifest, image: '../scene.png' })).toBeNull();
    expect(pixel32QualitySceneManifestFor('house', {
      id: 'house', status: 'candidate', approved: false,
      source: { generated_file: '/outside/project/image-gen.png', sha256: 'b'.repeat(64) },
    })?.imageFile).toBe('scene.png');
  });

  it('accepts only known dynamic object kinds declared by the candidate scene', () => {
    const manifest = {
      id: 'forest', status: 'candidate', approved: false, scene: 'dynamic-base.png',
      dimensions_px: { width: 1536, height: 1024 }, sha256: 'c'.repeat(64),
      dynamic_object_layer: { kinds: ['tree', 'forage', 'tuft'] },
    };
    expect(pixel32QualitySceneManifestFor('forest', manifest)?.dynamicLayerKinds)
      .toEqual(['tree', 'forage', 'tuft']);
    expect(pixel32QualitySceneManifestFor('pasture', {
      ...manifest,
      id: 'pasture',
      dynamic_object_layer: undefined,
      dynamic_layer: { kinds: ['tuft'] },
    })?.dynamicLayerKinds).toEqual(['tuft']);
    expect(pixel32QualitySceneManifestFor('forest', {
      ...manifest,
      dynamic_object_layer: { kinds: ['door'] },
    })).toBeNull();
  });
});

describe('pixel32QualitySceneFit', () => {
  it('uses cover scaling while preserving the source aspect ratio', () => {
    expect(pixel32QualitySceneFit(150, 100, 100, 100)).toEqual({
      scale: 1,
      x: -25,
      y: 0,
      width: 150,
      height: 100,
    });
    expect(pixel32QualitySceneFit(100, 100, 100, 100)).toEqual({
      scale: 1,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
  });
});

describe('pixel32QualitySceneAsset', () => {
  it('resolves candidate images relative to the configured Vite base URL', () => {
    const manifest = { mapId: 'farm', imageFile: 'scene.png', sha256: 'a'.repeat(64) };
    expect(pixel32QualitySceneAsset(manifest, '/farm-preview/').imageUrl)
      .toBe('/farm-preview/docs/art/candidates/pixel-movement/pixel32-quality-rebuild/maps/farm/scene.png');
    expect(pixel32QualitySceneAsset(manifest, '/').imageUrl)
      .toBe('/docs/art/candidates/pixel-movement/pixel32-quality-rebuild/maps/farm/scene.png');
  });
});

describe('pixel32QualityPortalProblems', () => {
  const source: MapDef = {
    id: 'source', name: '來源', width: 3, height: 3,
    rows: ['###', '#D#', '###'],
    legend: { '#': { kind: 'wall' }, D: { kind: 'door', to: 'target', spawn: { x: 1, y: 1 } } },
    spawn: { x: 1, y: 1 },
  };
  const target: MapDef = {
    id: 'target', name: '目的地', width: 3, height: 3,
    rows: ['###', '#.#', '###'], legend: { '#': { kind: 'wall' }, '.': { kind: 'grass' } },
    spawn: { x: 1, y: 1 },
  };

  it('rejects portal destinations that land on an obstacle and accepts walkable landings', () => {
    expect(pixel32QualityPortalProblems([source, target])).toEqual([]);
    const blockedTarget = { ...target, rows: ['###', '###', '###'] };
    expect(pixel32QualityPortalProblems([source, blockedTarget])).toContain(
      'source (1,1) 出口落點位於不可走格：target (1,1)',
    );
  });

  it('checks each house expansion destination selected by save flags', () => {
    const entrance: MapDef = {
      ...source,
      rows: ['###', '#D#', '###'],
      legend: { '#': { kind: 'wall' }, D: { kind: 'door', to: 'house' } },
    };
    const house = { ...target, id: 'house' };
    const wing = { ...target, id: 'house-wing', rows: ['###', '###', '###'] };
    const full = { ...target, id: 'house-full' };
    expect(pixel32QualityPortalProblems([entrance, house, wing, full])).toContain(
      'source (1,1) 出口落點位於不可走格：house-wing (1,1)',
    );
  });
});

describe('pixel32QualityMapProblems', () => {
  it('allows redesigning positions while preserving map identity, gameplay counts, and reachable routes', () => {
    const candidate: MapDef = {
      ...originalMap,
      rows: ['#####', '#...#', '#..F#', '#...#', '#####'],
    };
    expect(pixel32QualityMapProblems(originalMap, candidate)).toEqual([]);
  });

  it('rejects a missing forage point and disconnected walkable map region', () => {
    const candidate: MapDef = {
      ...originalMap,
      rows: ['#####', '#...#', '#####', '#...#', '#####'],
    };
    expect(pixel32QualityMapProblems(originalMap, candidate)).toEqual(expect.arrayContaining([
      expect.stringContaining('可走格未全部連通'),
      expect.stringContaining('forage'),
    ]));
  });

  it('rejects candidate layouts with unknown row symbols or a moved global spawn', () => {
    const candidate: MapDef = {
      ...originalMap,
      rows: ['#####', '#...#', '#.F?#', '#...#', '#####'],
      spawn: { x: 2, y: 2 },
    };
    expect(pixel32QualityMapProblems(originalMap, candidate)).toEqual(expect.arrayContaining([
      expect.stringContaining('未知地圖符號'),
      expect.stringContaining('出生點'),
    ]));
  });

  it('preserves the number of reachable destructible obstacle targets', () => {
    const withTree: MapDef = {
      ...originalMap,
      rows: ['#####', '#...#', '#.T.#', '#...#', '#####'],
      legend: { ...originalMap.legend, T: { kind: 'tree' } },
    };
    const blockedTree: MapDef = {
      ...withTree,
      rows: ['T####', '#...#', '#...#', '#...#', '#####'],
    };
    expect(pixel32QualityMapProblems(withTree, blockedTree)).toContain('tree 可操作數量不可減少：需至少 1（候選 0）');
  });

  it('accepts every checked-in candidate layout and explicitly unapproved scene manifest', () => {
    const originals = import.meta.glob('../../content/maps/*.json', { eager: true, import: 'default' }) as Record<string, MapDef>;
    const layouts = import.meta.glob('../../docs/art/candidates/pixel-movement/pixel32-quality-rebuild/maps/*/candidate-layout.json', { eager: true, import: 'default' }) as Record<string, MapDef>;
    const manifests = import.meta.glob('../../docs/art/candidates/pixel-movement/pixel32-quality-rebuild/maps/*/candidate.json', { eager: true, import: 'default' }) as Record<string, unknown>;
    const candidates: MapDef[] = [];
    for (const mapId of PIXEL32_QUALITY_MAP_IDS) {
      const original = originals[`../../content/maps/${mapId}.json`];
      const candidate = layouts[`../../docs/art/candidates/pixel-movement/pixel32-quality-rebuild/maps/${mapId}/candidate-layout.json`];
      const metadata = manifests[`../../docs/art/candidates/pixel-movement/pixel32-quality-rebuild/maps/${mapId}/candidate.json`];
      expect(original, mapId).toBeDefined();
      expect(candidate, mapId).toBeDefined();
      expect(metadata, mapId).toBeDefined();
      expect(pixel32QualityMapProblems(original!, candidate!), mapId).toEqual([]);
      expect(pixel32QualitySceneManifestFor(mapId, metadata), mapId).not.toBeNull();
      candidates.push(candidate!);
    }
    expect(pixel32QualityPortalProblems(candidates)).toEqual([]);
  });

});
