/** Presentation-only art anchors. Map JSON remains the authority for collision and interactions. */
export interface SceneOverlay {
  assetId: string;
  /** The existing tile under the visual structure's entrance/foot anchor. */
  anchorTile: { x: number; y: number };
}

const MAP_SCENE_OVERLAYS: Readonly<Record<string, readonly SceneOverlay[]>> = {
  farm: [
    { assetId: 'scene.farm.tree', anchorTile: { x: 33, y: 21 } },
    { assetId: 'scene.farm.house', anchorTile: { x: 2, y: 4 } },
  ],
  village: [
    { assetId: 'scene.village.general-shop', anchorTile: { x: 3, y: 4 } },
    { assetId: 'scene.village.smithy', anchorTile: { x: 12, y: 4 } },
  ],
};

export function sceneOverlaysFor(mapId: string): readonly SceneOverlay[] {
  return MAP_SCENE_OVERLAYS[mapId] ?? [];
}
