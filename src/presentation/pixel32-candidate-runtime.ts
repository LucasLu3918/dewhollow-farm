import type { Season } from '../domain/calendar';
import type { MapDef, TileKind } from '../domain/content';
import { tileAt } from '../domain/world';

export const PIXEL32_RUNTIME_QUERY = 'gate1Runtime';
export const PIXEL32_RUNTIME_VALUE = 'pixel32-map-animation';
export const PIXEL32_OVERLAY_PREVIEW_QUERY = 'gate1OverlayPreview';
export const PIXEL32_OVERLAY_PREVIEW_VALUE = 'pixel32-overlay-12x10';
export const PIXEL32_MAP_MANIFEST_KEY = 'gate1-pixel32-map-manifest';
export const PIXEL32_MAP_ATLAS_KEY = 'gate1-pixel32-map-atlas';
export const PIXEL32_ANIMATION_MANIFEST_KEY = 'gate1-pixel32-animation-manifest';
export const PIXEL32_ANIMATION_ATLAS_KEY = 'gate1-pixel32-animation-atlas';
export const PIXEL32_CROPS_ATLAS_KEY = 'gate1-pixel32-crops-atlas';
export const PIXEL32_CROPS_MANIFEST_KEY = 'gate1-pixel32-crops-manifest';
export const PIXEL32_INTERACTABLES_ATLAS_KEY = 'gate1-pixel32-interactables-atlas';
export const PIXEL32_INTERACTABLES_MANIFEST_KEY = 'gate1-pixel32-interactables-manifest';
export const PIXEL32_PETS_ATLAS_KEY = 'gate1-pixel32-pets-atlas';
export const PIXEL32_PETS_MANIFEST_KEY = 'gate1-pixel32-pets-manifest';
export const PIXEL32_CANDIDATE_REVIEW_QUERY = 'gate1AssetPreview';
export const PIXEL32_CANDIDATE_REVIEW_VALUE = 'pixel32-candidates';

export interface CandidateFrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
  approved?: boolean;
}

export interface CandidateAtlasManifest {
  status: string;
  approved: boolean;
  atlas: { file: string; width: number; height: number };
  frames: Record<string, CandidateFrameRect>;
}

export interface Pixel32CandidateOverlay {
  id: 'house-back' | 'tree-canopy' | 'house-front';
  frame: 'house-back' | 'tree-canopy' | 'house-front';
  tileX: number;
  tileY: number;
  layer: 'back' | 'front';
  widthTiles: number;
  heightTiles: number;
}

/** Fixed, collision-free DEV review layout. Coordinates are anchored in farm tiles. */
export const PIXEL32_CANDIDATE_OVERLAYS: readonly Pixel32CandidateOverlay[] = [
  { id: 'house-back', frame: 'house-back', tileX: 3, tileY: 3, layer: 'back', widthTiles: 3, heightTiles: 2 },
  { id: 'tree-canopy', frame: 'tree-canopy', tileX: 8, tileY: 3, layer: 'front', widthTiles: 2, heightTiles: 2 },
  { id: 'house-front', frame: 'house-front', tileX: 3, tileY: 3, layer: 'front', widthTiles: 3, heightTiles: 2 },
];

/** The candidate runtime requires two explicit development-only query values. */
export function pixel32CandidateRuntimeRequested(search: URLSearchParams, isDev: boolean): boolean {
  return isDev
    && search.get('renderProfile') === 'pixel32'
    && search.get(PIXEL32_RUNTIME_QUERY) === PIXEL32_RUNTIME_VALUE;
}

/** Optional DEV-only review board; it requires the pixel32 runtime and an exact second opt-in. */
export function pixel32CandidateReviewRequested(search: URLSearchParams, isDev: boolean, runtimeEnabled: boolean): boolean {
  return isDev
    && runtimeEnabled
    && search.get(PIXEL32_CANDIDATE_REVIEW_QUERY) === PIXEL32_CANDIDATE_REVIEW_VALUE;
}

/** Overlay review requires the already opt-in pixel32 runtime and a second exact DEV query value. */
export function pixel32OverlayPreviewRequested(search: URLSearchParams, isDev: boolean, runtimeEnabled: boolean): boolean {
  return isDev
    && runtimeEnabled
    && search.get(PIXEL32_OVERLAY_PREVIEW_QUERY) === PIXEL32_OVERLAY_PREVIEW_VALUE;
}

/** Fail closed unless every candidate frame is explicitly unapproved and has valid integer bounds. */
export function candidateFramesFromManifest(value: unknown, expectedAtlas: string): Record<string, CandidateFrameRect> | null {
  if (!value || typeof value !== 'object') return null;
  const manifest = value as Partial<CandidateAtlasManifest>;
  const atlas = manifest.atlas;
  if (manifest.status !== 'candidate' || manifest.approved !== false || !atlas || atlas.file !== expectedAtlas
    || !Number.isInteger(atlas.width) || atlas.width <= 0
    || !Number.isInteger(atlas.height) || atlas.height <= 0
    || !manifest.frames || typeof manifest.frames !== 'object') return null;

  const frames = Object.entries(manifest.frames);
  if (!frames.length || frames.some(([, frame]) => !frame
    || !Number.isInteger(frame.x) || frame.x < 0
    || !Number.isInteger(frame.y) || frame.y < 0
    || !Number.isInteger(frame.width) || frame.width <= 0
    || !Number.isInteger(frame.height) || frame.height <= 0
    || frame.x + frame.width > atlas.width
    || frame.y + frame.height > atlas.height
    || frame.approved === true)) return null;
  return manifest.frames as Record<string, CandidateFrameRect>;
}

/** Map only supported static ground layers to the seasonal 32 px atlas. */
export function pixel32MapFrameFor(
  assetId: string,
  season: Season,
  map: MapDef,
  x: number,
  y: number,
  tileKindAt: (x: number, y: number) => TileKind | null = (tileX, tileY) => tileAt(map, tileX, tileY)?.kind ?? null,
): string | null {
  const surface = assetId.startsWith('tile.') ? assetId.slice('tile.'.length) : '';
  if (surface === 'grass' || surface === 'path' || surface === 'water') return `${season}-${surface}`;
  if (surface !== 'field') return null;

  let mask = 0;
  if (tileKindAt(x, y - 1) !== 'field') mask |= 1;
  if (tileKindAt(x + 1, y) !== 'field') mask |= 2;
  if (tileKindAt(x, y + 1) !== 'field') mask |= 4;
  if (tileKindAt(x - 1, y) !== 'field') mask |= 8;
  return `${season}-field-edge-${mask.toString(16)}`;
}
