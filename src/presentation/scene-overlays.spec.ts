import { describe, expect, it } from 'vitest';
import farm from '../../content/maps/farm.json';
import { isWalkable, tileAt } from '../domain/world';
import type { MapDef } from '../domain/content';
import { sceneOverlaysFor } from './scene-overlays';

describe('sceneOverlaysFor', () => {
  it('places only the authored farm house and boundary tree visuals', () => {
    expect(sceneOverlaysFor('farm')).toEqual([
      { assetId: 'scene.farm.tree', anchorTile: { x: 33, y: 21 } },
      { assetId: 'scene.farm.house', anchorTile: { x: 2, y: 4 } },
    ]);
    const treeAnchor = tileAt(farm as MapDef, 33, 21);
    expect(treeAnchor?.kind).toBe('fence');
    expect(isWalkable(treeAnchor!.kind)).toBe(false);
  });

  it('keeps village building visuals aligned to existing shop interaction tiles', () => {
    expect(sceneOverlaysFor('village')).toEqual([
      { assetId: 'scene.village.general-shop', anchorTile: { x: 3, y: 4 } },
      { assetId: 'scene.village.smithy', anchorTile: { x: 12, y: 4 } },
    ]);
  });

  it('does not add overlays to unrelated maps', () => {
    expect(sceneOverlaysFor('house')).toEqual([]);
  });
});
