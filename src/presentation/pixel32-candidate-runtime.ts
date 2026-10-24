import type { Season } from '../domain/calendar';
import type { MapDef, TileKind } from '../domain/content';
import { tileAt } from '../domain/world';

export const PIXEL32_RUNTIME_QUERY = 'gate1Runtime';
export const PIXEL32_RUNTIME_VALUE = 'pixel32-map-animation';
export const PIXEL32_MAP_MANIFEST_KEY = 'gate1-pixel32-map-manifest';
export const PIXEL32_MAP_ATLAS_KEY = 'gate1-pixel32-map-atlas';
export const PIXEL32_ANIMATION_MANIFEST_KEY = 'gate1-pixel32-animation-manifest';
export const PIXEL32_ANIMATION_ATLAS_KEY = 'gate1-pixel32-animation-atlas';

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

/** The candidate runtime requires two explicit development-only query values. */
export function pixel32CandidateRuntimeRequested(search: URLSearchParams, isDev: boolean): boolean {
  return isDev
    && search.get('renderProfile') === 'pixel32'
    && search.get(PIXEL32_RUNTIME_QUERY) === PIXEL32_RUNTIME_VALUE;
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
