import type { TileKind } from '../domain/content';
import { TILE_SIZE } from './constants';
import { foregroundDepth } from './actor-depth';
import type { MapRenderPlan, PlotRenderTile } from './map-render-plan';

export interface MapTileSprite<Image> {
  x: number;
  y: number;
  base: TileKind;
  ground: TileKind;
  groundImage: Image;
  objectImage?: Image;
}

export interface MapTileRenderPorts<Image> {
  image(kind: TileKind, x: number, y: number, depth: 0 | 1): Image;
  addGround(image: Image): void;
  placeObject(image: Image, kind: TileKind, y: number): void;
}

/** Render the pure row-major map plan into Phaser images while the caller supplies asset/depth policies. */
export function renderMapTileLayers<Image>(
  plan: MapRenderPlan,
  ports: MapTileRenderPorts<Image>,
): MapTileSprite<Image>[] {
  const sprites: MapTileSprite<Image>[] = [];
  for (const tile of plan.tiles) {
    const groundImage = ports.image(tile.ground, tile.x, tile.y, 0);
    const objectImage = tile.object ? ports.image(tile.object, tile.x, tile.y, 1) : undefined;
    sprites.push({
      x: tile.x,
      y: tile.y,
      base: tile.base,
      ground: tile.ground,
      groundImage,
      objectImage,
    });
    ports.addGround(groundImage);
    if (objectImage && tile.object) ports.placeObject(objectImage, tile.object, tile.y);
  }
  return sprites;
}

export interface DisposableMapImage {
  parentContainer: unknown;
  destroy(): unknown;
}

export interface ClearableMapWorld {
  removeAll(destroy: boolean): unknown;
}

/** Dispose scene-list trees before clearing the world container that owns all other tile images. */
export function clearMapTileLayers<Image extends DisposableMapImage>(
  sprites: readonly MapTileSprite<Image>[],
  world: ClearableMapWorld,
): void {
  for (const sprite of sprites) {
    if (sprite.objectImage && sprite.objectImage.parentContainer !== world) sprite.objectImage.destroy();
  }
  world.removeAll(true);
}

export interface PlotRenderPorts<Image> {
  soil(tile: PlotRenderTile): Image;
  crop(tile: PlotRenderTile): Image;
  add(image: Image): void;
}

/** Paint the provided plot snapshot; state merging and crop content lookup stay in MapScene. */
export function renderPlotLayer<Image>(
  plots: readonly PlotRenderTile[],
  ports: PlotRenderPorts<Image>,
): void {
  for (const plot of plots) {
    ports.add(ports.soil(plot));
    if (plot.crop) ports.add(ports.crop(plot));
  }
}

export interface DepthSortedMapObject {
  parentContainer: unknown;
  getBounds(): { bottom: number };
  setDepth(depth: number): unknown;
}

/** Keep ordinary objects inside the world container and depth-sort tree images with runtime actors. */
export function placeDepthSortedMapObject<Image extends DepthSortedMapObject>(
  image: Image,
  kind: TileKind,
  tileY: number,
  world: object,
  worldPorts: { add(image: Image): unknown; remove(image: Image): unknown },
  bringToTop: (image: Image) => void,
): void {
  if (kind !== 'tree') {
    if (image.parentContainer !== world) worldPorts.add(image);
    image.setDepth(1);
    return;
  }

  if (image.parentContainer === world) worldPorts.remove(image);
  const footY = image.getBounds().bottom || (tileY + 1) * TILE_SIZE;
  image.setDepth(foregroundDepth(footY));
  bringToTop(image);
}
