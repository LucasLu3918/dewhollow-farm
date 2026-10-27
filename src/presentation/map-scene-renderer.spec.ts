import { describe, expect, it } from 'vitest';
import type { MapDef } from '../domain/content';
import { legacyMapRenderPlan, type PlotRenderTile } from './map-render-plan';
import {
  clearMapTileLayers,
  placeDepthSortedMapObject,
  renderMapTileLayers,
  renderPlotLayer,
  type DisposableMapImage,
  type MapTileSprite,
} from './map-scene-renderer';

const map: MapDef = {
  id: 'render-test',
  name: 'render test',
  width: 2,
  height: 1,
  rows: ['gT'],
  legend: { g: { kind: 'grass' }, T: { kind: 'tree', ground: 'grass' } },
  spawn: { x: 0, y: 0 },
};

describe('map-scene-renderer', () => {
  it('renders the adapted ground and object descriptors into tile sprite records', () => {
    const added: string[] = [];
    const placed: string[] = [];
    const records = renderMapTileLayers(legacyMapRenderPlan(map), {
      image: (kind, x, y, depth) => `${kind}@${x},${y}:${depth}`,
      addGround: (image) => added.push(image),
      placeObject: (image, kind, y) => placed.push(`${image}:${kind}:${y}`),
    });

    expect(records).toEqual([
      { x: 0, y: 0, base: 'grass', ground: 'grass', groundImage: 'grass@0,0:0', objectImage: undefined },
      { x: 1, y: 0, base: 'tree', ground: 'grass', groundImage: 'grass@1,0:0', objectImage: 'tree@1,0:1' },
    ]);
    expect(added).toEqual(['grass@0,0:0', 'grass@1,0:0']);
    expect(placed).toEqual(['tree@1,0:1:tree:0']);
  });

  it('destroys scene-list object images before removing world-contained tile children', () => {
    const calls: string[] = [];
    const world = {
      removeAll: (destroy: boolean) => calls.push(`removeAll:${destroy}`),
    };
    const sprite: MapTileSprite<DisposableMapImage> = {
      x: 0,
      y: 0,
      base: 'tree',
      ground: 'grass',
      groundImage: { parentContainer: null, destroy: () => undefined },
      objectImage: {
        parentContainer: null,
        destroy: () => calls.push('destroy-tree'),
      },
    };

    clearMapTileLayers([sprite], world as never);
    expect(calls).toEqual(['destroy-tree', 'removeAll:true']);
  });

  it('renders soil and crops from an already merged plot snapshot', () => {
    const plot: PlotRenderTile = {
      x: 1,
      y: 2,
      watered: true,
      crop: { cropId: 'radish', stage: 'sprout', scale: 0.75, alpha: 0.75 },
    };
    const rendered: string[] = [];

    renderPlotLayer([plot], {
      soil: (tile) => `soil:${tile.x},${tile.y}:${tile.watered}`,
      crop: (tile) => `crop:${tile.crop?.cropId}:${tile.crop?.stage}`,
      add: (image) => rendered.push(image),
    });

    expect(rendered).toEqual(['soil:1,2:true', 'crop:radish:sprout']);
  });

  it('keeps trees on the scene list and places them ahead of an actor at the same foot anchor', () => {
    const world = {
      add: () => { throw new Error('tree should stay outside the world container'); },
      remove: () => { throw new Error('tree is not in the world container'); },
    };
    const calls: string[] = [];
    const tree = {
      parentContainer: null,
      getBounds: () => ({ bottom: 64 }),
      setDepth: (depth: number) => calls.push(`depth:${depth}`),
    };

      placeDepthSortedMapObject(tree, 'tree', 1, world, world, () => calls.push('bring-to-top'));

    expect(calls[0]).toMatch(/^depth:11\.0019/);
    expect(calls[1]).toBe('bring-to-top');
  });

  it('puts non-tree objects in the world container at tile depth', () => {
    const calls: string[] = [];
    const world = {
      add: () => calls.push('add'),
      remove: () => calls.push('remove'),
    };
    const object = {
      parentContainer: null,
      getBounds: () => ({ bottom: 64 }),
      setDepth: (depth: number) => calls.push(`depth:${depth}`),
    };

    placeDepthSortedMapObject(object, 'rock', 1, world, world, () => calls.push('bring-to-top'));

    expect(calls).toEqual(['add', 'depth:1']);
  });
});
