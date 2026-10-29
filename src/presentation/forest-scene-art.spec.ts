import { describe, expect, it } from 'vitest';
import forest from '../../content/maps/forest.json';
import assets from '../../content/assets.json';
import type { MapDef, TileKind } from '../domain/content';
import { tileAt } from '../domain/world';
import { FOREST_MOSS_TILES, FOREST_ROCK_TILES, forestSceneAssetFor } from './forest-scene-art';

const forestMap = forest as MapDef;

describe('forestSceneAssetFor', () => {
  it('uses forest-only ground art without changing other map art', () => {
    expect(forestSceneAssetFor('forest', 'grass', 2, 1)).toBe('scene.forest.grass');
    expect(forestSceneAssetFor('forest', 'path', 10, 5)).toBe('scene.forest.path');
    expect(forestSceneAssetFor('forest', 'wall', 1, 1)).toBe('scene.forest.tree');
    expect(forestSceneAssetFor('farm', 'grass', 1, 1)).toBeNull();
  });

  it('uses moss only beneath existing forest grass cells', () => {
    expect(FOREST_MOSS_TILES.length).toBeGreaterThan(0);
    for (const { x, y } of FOREST_MOSS_TILES) {
      expect(tileAt(forestMap, x, y)?.kind, `moss at ${x},${y}`).toBe('grass');
      expect(forestSceneAssetFor('forest', 'grass', x, y)).toBe('scene.forest.moss');
    }
  });

  it('uses the approved tree and rock textures only on existing blocked tree cells', () => {
    expect(FOREST_ROCK_TILES.length).toBeGreaterThan(0);
    for (const { x, y } of FOREST_ROCK_TILES) {
      expect(tileAt(forestMap, x, y)?.kind, `rock at ${x},${y}`).toBe('tree');
      expect(forestSceneAssetFor('forest', 'tree', x, y)).toBe('scene.forest.rock');
    }

    for (const { x, y } of [{ x: 15, y: 7 }, { x: 7, y: 9 }, { x: 8, y: 9 }]) {
      expect(tileAt(forestMap, x, y)?.kind).toBe('tree');
      expect(forestSceneAssetFor('forest', 'tree', x, y)).toBe('scene.forest.tree');
    }
  });

  it('does not map unrelated tile kinds to forest art', () => {
    const unrelatedKinds: TileKind[] = ['field', 'door', 'forage', 'water'];
    for (const kind of unrelatedKinds) {
      expect(forestSceneAssetFor('forest', kind, 1, 1)).toBeNull();
    }
  });

  it('records the exact approved forest image hashes and display densities', () => {
    const approved = [
      ['scene.forest.grass', 'assets/forest/ground-grass.png', '839c2cfd2de5c063a8b12933beffa42f27647381a8b765d90e90ce6c25f1b1c5', 2],
      ['scene.forest.path', 'assets/forest/ground-path.png', 'd697f250602cbb1f4f1b2755cce6e58876e451ef977864dbdef47badff09e00e', 2],
      ['scene.forest.moss', 'assets/forest/ground-moss.png', 'eb2d1e1037ee2d67b4122f05a1845a36c9f9904ede10d72f875698a2b06516f7', 2],
      ['scene.forest.tree', 'assets/forest/tree.png', 'd9a43c1d9a6fa1948dc30e25fb6a164b6578ef207186cf727c0bb22d8f24e10c', 4],
      ['scene.forest.rock', 'assets/forest/rock.png', '5928ba117c42b5f1b334f93771cf079724452def76f19a9dd8b8295df9363171', 2],
    ] as const;
    const byId = new Map(assets.assets.map((entry) => [entry.id, entry]));

    for (const [id, file, hash, density] of approved) {
      const entry = byId.get(id);
      expect(entry).toMatchObject({ file, density });
      expect(entry?.source, id).toContain(`SHA-256 ${hash}`);
    }
  });
});
