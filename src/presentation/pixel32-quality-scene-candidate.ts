import type { MapDef, TileDef } from '../domain/content';
import { isWalkable, tileAt } from '../domain/world';
import { resolveDestination } from '../domain/house';

export const PIXEL32_QUALITY_SCENE_QUERY = 'qualityMapScene';
export const PIXEL32_QUALITY_SCENE_VALUE = 'high-detail-candidate';
export const PIXEL32_QUALITY_SCENE_ROOT = 'docs/art/candidates/pixel-movement/pixel32-quality-rebuild/maps';

export const PIXEL32_QUALITY_MAP_IDS = [
  'farm', 'village', 'plaza', 'forest', 'lake', 'house', 'house-wing', 'house-full',
  'mine-entrance', 'coop', 'pasture', 'cowbarn',
] as const;

export interface Pixel32QualitySceneManifest {
  mapId: string;
  imageFile: string;
  renderMode: 'scene' | 'map-tiles';
  width?: number;
  height?: number;
  sha256: string;
  dynamicLayerKinds?: TileDef['kind'][];
}

export interface Pixel32QualitySceneAsset extends Pixel32QualitySceneManifest {
  imageUrl: string;
  textureKey: string;
}

export interface Pixel32QualitySceneFit {
  scale: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const PRESERVED_ACTION_KINDS = new Set<TileDef['kind']>([
  'tuft', 'trough', 'shop', 'forage', 'ore', 'stairs', 'bed', 'shipbox', 'tree',
  'door', 'cave', 'rock', 'kitchen', 'workshop', 'workbench',
]);

const INTERACTABLE_KINDS = new Set<TileDef['kind']>([
  'tuft', 'trough', 'shop', 'forage', 'ore', 'stairs', 'bed', 'shipbox', 'door', 'cave',
  'kitchen', 'workshop', 'workbench',
]);
const APPROACHABILITY_KINDS = new Set<TileDef['kind']>([...INTERACTABLE_KINDS, 'tree', 'rock', 'water']);

/** Full-scene art remains fail-closed outside DEV or without the existing Pixel32 runtime opt-in. */
export function pixel32QualitySceneCandidateRequested(
  search: URLSearchParams,
  isDev: boolean,
  pixel32RuntimeEnabled: boolean,
): boolean {
  return isDev
    && pixel32RuntimeEnabled
    && search.get(PIXEL32_QUALITY_SCENE_QUERY) === PIXEL32_QUALITY_SCENE_VALUE;
}

/** Normalize each art producer's per-map metadata and accept only the exact unapproved PNG candidate. */
export function pixel32QualitySceneManifestFor(mapId: string, value: unknown): Pixel32QualitySceneManifest | null {
  if (!value || typeof value !== 'object') return null;
  const manifest = value as {
    id?: unknown;
    mapId?: unknown;
    status?: unknown;
    approved?: unknown;
    image?: unknown;
    file?: unknown;
    scene?: unknown;
    source?: { file?: unknown; sha256?: unknown };
    sha256?: unknown;
    dimensions?: { width?: unknown; height?: unknown };
    dimensions_px?: { width?: unknown; height?: unknown };
    render_mode?: unknown;
    dynamic_object_layer?: { kinds?: unknown };
    dynamic_layer?: { kinds?: unknown };
  };
  const declaredMapId = manifest.mapId ?? manifest.id;
  const imageFile = manifest.source?.file ?? manifest.image ?? manifest.file ?? manifest.scene ?? 'scene.png';
  const sha256 = manifest.source?.sha256 ?? manifest.sha256;
  const dimensions = manifest.dimensions ?? manifest.dimensions_px;
  const renderMode = manifest.render_mode ?? 'scene';
  const dynamicKinds = manifest.dynamic_object_layer?.kinds ?? manifest.dynamic_layer?.kinds;
  const allowedDynamicKinds = new Set<TileDef['kind']>(['tree', 'forage', 'tuft', 'rock', 'ore']);
  if (manifest.status !== 'candidate' || manifest.approved !== false
    || declaredMapId !== mapId
    || typeof imageFile !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.png$/.test(imageFile)
    || (renderMode !== 'scene' && renderMode !== 'map-tiles')
    || typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(sha256)
    || (dimensions !== undefined && (!Number.isInteger(dimensions.width) || (dimensions.width as number) <= 0
      || !Number.isInteger(dimensions.height) || (dimensions.height as number) <= 0))
    || (dynamicKinds !== undefined && (!Array.isArray(dynamicKinds)
      || dynamicKinds.some((kind) => typeof kind !== 'string' || !allowedDynamicKinds.has(kind as TileDef['kind']))))) return null;
  const result: Pixel32QualitySceneManifest = {
    mapId,
    imageFile,
    renderMode,
    width: dimensions?.width as number | undefined,
    height: dimensions?.height as number | undefined,
    sha256,
  };
  if (Array.isArray(dynamicKinds)) result.dynamicLayerKinds = [...new Set(dynamicKinds as TileDef['kind'][])];
  return result;
}

export function pixel32QualitySceneAsset(manifest: Pixel32QualitySceneManifest, baseUrl = '/'): Pixel32QualitySceneAsset {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return {
    ...manifest,
    imageUrl: `${base}${PIXEL32_QUALITY_SCENE_ROOT}/${manifest.mapId}/${manifest.imageFile}`,
    textureKey: `pixel32-quality-scene-${manifest.mapId}`,
  };
}

/** Validate every authored portal destination before candidate layouts enter the runtime content pack. */
export function pixel32QualityPortalProblems(maps: readonly MapDef[]): string[] {
  const mapsById = new Map(maps.map((map) => [map.id, map]));
  const problems: string[] = [];
  for (const map of maps) {
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const tile = tileAt(map, x, y);
        if (tile?.kind !== 'door') continue;
        if (!tile.to) {
          problems.push(`${map.id} (${x},${y}) 出口缺少目的地`);
          continue;
        }
        const flagScenarios: Readonly<Record<string, boolean>>[] = tile.to === 'house'
          ? [{}, { 'house-wing': true }, { 'house-wing': true, 'house-full': true }]
          : [{}];
        for (const flags of flagScenarios) {
          const destinationId = resolveDestination(tile.to, flags);
          const destination = mapsById.get(destinationId);
          if (!destination) {
            problems.push(`${map.id} (${x},${y}) 出口目的地不存在：${destinationId}`);
            continue;
          }
          const spawn = tile.spawn ?? destination.spawn;
          const landing = tileAt(destination, spawn.x, spawn.y);
          if (!landing || !isWalkable(landing.kind)) {
            problems.push(`${map.id} (${x},${y}) 出口落點位於不可走格：${destinationId} (${spawn.x},${spawn.y})`);
          }
        }
      }
    }
  }
  return problems;
}

/** Cover the logical map world without distorting each authored candidate's aspect ratio. */
export function pixel32QualitySceneFit(
  imageWidth: number,
  imageHeight: number,
  worldWidth: number,
  worldHeight: number,
): Pixel32QualitySceneFit {
  if (![imageWidth, imageHeight, worldWidth, worldHeight].every(Number.isFinite)
    || imageWidth <= 0 || imageHeight <= 0 || worldWidth <= 0 || worldHeight <= 0) {
    throw new RangeError('候選場景與地圖尺寸必須是正數');
  }
  const scale = Math.max(worldWidth / imageWidth, worldHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return { scale, x: (worldWidth - width) / 2, y: (worldHeight - height) / 2, width, height };
}

/** Validate a DEV MapDef before application assembly; gameplay rules stay identical while placements may move. */
export function pixel32QualityMapProblems(original: MapDef, candidate: MapDef): string[] {
  const problems: string[] = [];
  if (candidate.id !== original.id) problems.push('地圖 ID 不可更改');
  if (candidate.width !== original.width || candidate.height !== original.height) problems.push('地圖尺寸不可更改');
  if (candidate.spawn.x !== original.spawn.x || candidate.spawn.y !== original.spawn.y) problems.push('出生點不可更改');
  if (candidate.flock !== original.flock) problems.push('動物群設定不可更改');
  if (!Array.isArray(candidate.rows) || candidate.rows.length !== candidate.height) {
    problems.push('rows 高度必須符合地圖尺寸');
    return problems;
  }
  for (let y = 0; y < candidate.height; y += 1) {
    const row = candidate.rows[y];
    if (typeof row !== 'string' || row.length !== candidate.width) {
      problems.push(`第 ${y} 列寬度不符合地圖尺寸`);
      continue;
    }
    for (const symbol of row) if (!candidate.legend[symbol]) problems.push(`未知地圖符號：${symbol}`);
  }
  if (problems.length) return [...new Set(problems)];

  semanticCountsPreserved(original, candidate, problems);
  const candidateWalkable = walkableReachability(candidate);
  if (!candidateWalkable.startIsWalkable) problems.push('出生點必須位於可走格');
  if (candidateWalkable.reachable.size !== candidateWalkable.total) problems.push('可走格未全部連通至出生點');

  const originalReachable = walkableReachability(original);
  const originalApproachable = approachableTargetCounts(original, originalReachable.reachable);
  const candidateApproachable = approachableTargetCounts(candidate, candidateWalkable.reachable);
  for (const [kind, originalCount] of originalApproachable) {
    const candidateCount = candidateApproachable.get(kind) ?? 0;
    if (candidateCount < originalCount) {
      problems.push(`${kind} 可操作數量不可減少：需至少 ${originalCount}（候選 ${candidateCount}）`);
    }
  }
  for (const [x, y] of candidateWalkable.targets) {
    if (!hasReachableWalkableNeighbor(candidate, x, y, candidateWalkable.reachable)) {
      problems.push(`互動格 (${x},${y}) 沒有可達的操作站位`);
    }
  }
  return [...new Set(problems)];
}

function semanticCountsPreserved(original: MapDef, candidate: MapDef, problems: string[]): boolean {
  const originalCounts = semanticCounts(original);
  const candidateCounts = semanticCounts(candidate);
  for (const [signature, count] of originalCounts) {
    const actual = candidateCounts.get(signature) ?? 0;
    const portal = signature.startsWith('portal:');
    if ((portal ? actual < count : actual !== count)) {
      problems.push(`${signature} 數量需維持 ${count}（候選 ${actual}）`);
    }
  }
  for (const [signature, count] of candidateCounts) {
    if (!originalCounts.has(signature) && signature.startsWith('portal:')) {
      problems.push(`${signature} 不可新增新的出口語意（候選 ${count}）`);
    }
  }
  return problems.length === 0;
}

function semanticCounts(map: MapDef): Map<string, number> {
  const counts = new Map<string, number>();
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = tileAt(map, x, y);
      if (!tile) continue;
      let signature: string | null = null;
      if (tile.kind === 'door') signature = `portal:${stableValue({ to: tile.to, spawn: tile.spawn, requires: tile.requires })}`;
      else if (tile.kind === 'field') signature = `field:${tile.greenhouse === true ? 'greenhouse' : 'outdoor'}`;
      else if (PRESERVED_ACTION_KINDS.has(tile.kind)) {
        const properties: Partial<TileDef> = { kind: tile.kind };
        if (tile.kind === 'forage') {
          if (tile.item !== undefined) properties.item = tile.item;
          if (tile.seasons !== undefined) properties.seasons = tile.seasons;
        }
        if (tile.kind === 'shop' && tile.shop !== undefined) properties.shop = tile.shop;
        if (tile.kind === 'trough' && tile.slot === true) properties.slot = true;
        signature = `${tile.kind}:${stableValue(properties)}`;
      } else if (tile.slot === true || tile.notice !== undefined || tile.festival !== undefined || tile.wardrobe === true) {
        signature = `service:${stableValue({
          kind: tile.kind,
          slot: tile.slot === true ? true : undefined,
          notice: tile.notice,
          festival: tile.festival,
          wardrobe: tile.wardrobe === true ? true : undefined,
        })}`;
      }
      if (signature) counts.set(signature, (counts.get(signature) ?? 0) + 1);
    }
  }
  return counts;
}

function stableValue(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return JSON.stringify(value) ?? 'null';
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => child !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => `${JSON.stringify(key)}:${stableValue(child)}`)
    .join(',')}}`;
}

function walkableReachability(map: MapDef): {
  reachable: Set<string>;
  total: number;
  startIsWalkable: boolean;
  targets: [number, number][];
} {
  const startIsWalkable = isWalkable(tileAt(map, map.spawn.x, map.spawn.y)?.kind ?? 'wall');
  const reachable = new Set<string>();
  const queue: { x: number; y: number }[] = [];
  if (startIsWalkable) {
    const key = `${map.spawn.x},${map.spawn.y}`;
    reachable.add(key);
    queue.push({ x: map.spawn.x, y: map.spawn.y });
  }
  let total = 0;
  const targets: [number, number][] = [];
  const neighbors: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = tileAt(map, x, y);
      if (!tile) continue;
      if (isWalkable(tile.kind)) total += 1;
      if (isInteractableTile(tile)) targets.push([x, y]);
    }
  }
  for (let i = 0; i < queue.length; i += 1) {
    const point = queue[i]!;
    for (const [dx, dy] of neighbors) {
      const x = point.x + dx;
      const y = point.y + dy;
      const key = `${x},${y}`;
      if (reachable.has(key) || !isWalkable(tileAt(map, x, y)?.kind ?? 'wall')) continue;
      reachable.add(key);
      queue.push({ x, y });
    }
  }
  return { reachable, total, startIsWalkable, targets };
}

function isInteractableTile(tile: TileDef): boolean {
  return INTERACTABLE_KINDS.has(tile.kind)
    || tile.slot === true || tile.notice !== undefined || tile.festival !== undefined || tile.wardrobe === true;
}

function approachableTargetCounts(map: MapDef, reachable: ReadonlySet<string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = tileAt(map, x, y);
      if (!tile || !APPROACHABILITY_KINDS.has(tile.kind) && !isInteractableTile(tile)) continue;
      if (hasReachableWalkableNeighbor(map, x, y, reachable)) counts.set(tile.kind, (counts.get(tile.kind) ?? 0) + 1);
    }
  }
  return counts;
}

function hasReachableWalkableNeighbor(map: MapDef, x: number, y: number, reachable: ReadonlySet<string>): boolean {
  return [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => {
    const neighborX = x + dx!;
    const neighborY = y + dy!;
    return isWalkable(tileAt(map, neighborX, neighborY)?.kind ?? 'wall') && reachable.has(`${neighborX},${neighborY}`);
  });
}
