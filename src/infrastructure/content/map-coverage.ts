import type { MapDef, Point, TileKind } from '../../domain/content';
import { isWalkable } from '../../domain/world';
import type { AssetManifest } from '../assets/asset-manifest';

export interface AuthoredMapFile {
  file: string;
  map: MapDef;
}

export interface MapCoverageIssue {
  code:
    | 'duplicate-map-id'
    | 'id-file-mismatch'
    | 'invalid-shape'
    | 'unknown-symbol'
    | 'invalid-spawn'
    | 'missing-start-map'
    | 'missing-tile-asset'
    | 'missing-portal-destination'
    | 'invalid-portal-landing'
    | 'unreachable-portal'
    | 'unreachable-map';
  mapId: string | null;
  detail: string;
}

export interface MapPortalCoverage {
  symbol: string;
  x: number;
  y: number;
  destination: string | null;
  destinationExists: boolean;
  landing: Point | null;
  landingKind: TileKind | null;
  landingValid: boolean;
  reachableFromSpawn: boolean;
  reachableInWorld: boolean;
  requiresUnlock: boolean;
}

export interface MapCoverageEntry {
  file: string;
  mapId: string;
  idMatchesFile: boolean;
  shape: {
    width: number;
    height: number;
    rowCount: number;
    invalidRows: number[];
    unknownSymbols: string[];
    valid: boolean;
  };
  spawn: {
    x: number;
    y: number;
    kind: TileKind | null;
    valid: boolean;
    reachableWalkableTiles: number;
    totalWalkableTiles: number;
  };
  tileAssets: {
    required: string[];
    missing: string[];
  };
  portals: MapPortalCoverage[];
  reachability: {
    fromStart: boolean;
    classification: 'standard' | 'conditional-variant';
  };
  complete: boolean;
}

export interface MapCoverageReport {
  startMapId: string;
  summary: {
    totalMaps: number;
    completeMaps: number;
    coveragePercent: number;
    portalCells: number;
  };
  reachableMapIds: string[];
  unreachableMapIds: string[];
  maps: MapCoverageEntry[];
  issues: MapCoverageIssue[];
}

interface MapCoverageInput {
  files: readonly AuthoredMapFile[];
  assets: Pick<AssetManifest, 'assets'>;
  startMapId: string;
  conditionalVariants?: readonly string[];
}

const CONDITIONAL_VARIANTS = new Set(['house-full', 'house-wing']);

/** Build a read-only inventory for every authored map file and its current content references. */
export function mapCoverageReport({ files, assets, startMapId, conditionalVariants = [...CONDITIONAL_VARIANTS] }: MapCoverageInput): MapCoverageReport {
  const issues: MapCoverageIssue[] = [];
  const mapById = new Map<string, MapDef>();
  const duplicateIds = new Set<string>();
  for (const { map } of files) {
    if (mapById.has(map.id)) duplicateIds.add(map.id);
    else mapById.set(map.id, map);
  }

  for (const mapId of duplicateIds) addIssue(issues, 'duplicate-map-id', mapId, `map id ${mapId} appears in more than one authored file`);
  if (!mapById.has(startMapId)) addIssue(issues, 'missing-start-map', null, `start map ${startMapId} is not present in authored maps`);

  const worldReachability = traceWorldReachability(mapById, startMapId);

  const knownAssets = new Set(assets.assets.map(({ id }) => id));
  const conditionalIds = new Set(conditionalVariants);
  const entries = files.map(({ file, map }): MapCoverageEntry => {
    const fileId = file.split('/').at(-1)?.replace(/\.json$/i, '') ?? '';
    const idMatchesFile = map.id === fileId;
    if (!idMatchesFile) addIssue(issues, 'id-file-mismatch', map.id, `${file} declares map id ${map.id}`);

    const invalidRows: number[] = [];
    if (map.rows.length !== map.height || map.width <= 0 || map.height <= 0) {
      addIssue(issues, 'invalid-shape', map.id, `expected ${map.height} rows of width ${map.width}; got ${map.rows.length} rows`);
    }
    map.rows.forEach((row, y) => {
      if (row.length !== map.width) {
        invalidRows.push(y);
        addIssue(issues, 'invalid-shape', map.id, `row ${y} has width ${row.length}; expected ${map.width}`);
      }
    });
    const unknownSymbols = [...new Set(map.rows.join('').split('').filter((symbol) => !map.legend[symbol]))].sort();
    for (const symbol of unknownSymbols) addIssue(issues, 'unknown-symbol', map.id, `row data uses symbol ${JSON.stringify(symbol)} absent from legend`);
    const shapeValid = map.rows.length === map.height && map.width > 0 && map.height > 0
      && invalidRows.length === 0 && unknownSymbols.length === 0;

    const spawnTile = tileAt(map, map.spawn);
    const spawnValid = Boolean(spawnTile && isWalkable(spawnTile.kind) && spawnTile.kind !== 'door');
    if (!spawnValid) addIssue(issues, 'invalid-spawn', map.id, `spawn (${map.spawn.x},${map.spawn.y}) is not a walkable non-portal tile`);
    const reachableTiles = localReachableTiles(map, map.spawn);
    const totalWalkableTiles = countWalkableTiles(map);

    const required = [...new Set(Object.values(map.legend).map(({ kind }) => `tile.${kind}`))].sort();
    const missing = required.filter((id) => !knownAssets.has(id));
    for (const id of missing) addIssue(issues, 'missing-tile-asset', map.id, `asset manifest does not contain ${id}`);

    const portals: MapPortalCoverage[] = [];
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const symbol = map.rows[y]?.[x];
        if (!symbol) continue;
        const tile = map.legend[symbol];
        if (tile?.kind !== 'door') continue;
        const target = tile.to ? mapById.get(tile.to) : undefined;
        const landing = target ? (tile.spawn ?? target.spawn) : null;
        const landingTile = target && landing ? tileAt(target, landing) : null;
        const landingValid = Boolean(landingTile && isWalkable(landingTile.kind) && landingTile.kind !== 'door');
        const portal: MapPortalCoverage = {
          symbol,
          x,
          y,
          destination: tile.to ?? null,
          destinationExists: Boolean(target),
          landing: landing ? { ...landing } : null,
          landingKind: landingTile?.kind ?? null,
          landingValid,
          reachableFromSpawn: reachableTiles.has(pointKey({ x, y })),
          reachableInWorld: worldReachability.portals.has(portalKey(map.id, x, y)),
          requiresUnlock: Boolean(tile.requires),
        };
        portals.push(portal);
        if (!target) addIssue(issues, 'missing-portal-destination', map.id, `portal ${symbol} at (${x},${y}) targets missing map ${tile.to ?? '(unset)'}`);
        else if (!landingValid) addIssue(issues, 'invalid-portal-landing', map.id, `portal ${symbol} at (${x},${y}) lands on a blocked or out-of-bounds tile in ${target.id}`);
        if (!portal.reachableInWorld && !(conditionalIds.has(map.id) && portal.reachableFromSpawn)) {
          addIssue(issues, 'unreachable-portal', map.id, `portal ${symbol} at (${x},${y}) is unreachable from the start map through authored map entries`);
        }
      }
    }

    const fromStart = worldReachability.maps.has(map.id);
    const classification = conditionalIds.has(map.id) ? 'conditional-variant' : 'standard';
    if (!fromStart && classification === 'standard') {
      addIssue(issues, 'unreachable-map', map.id, `map ${map.id} is not reachable from start map ${startMapId}`);
    }

    return {
      file,
      mapId: map.id,
      idMatchesFile,
      shape: { width: map.width, height: map.height, rowCount: map.rows.length, invalidRows, unknownSymbols, valid: shapeValid },
      spawn: {
        x: map.spawn.x,
        y: map.spawn.y,
        kind: spawnTile?.kind ?? null,
        valid: spawnValid,
        reachableWalkableTiles: reachableTiles.size,
        totalWalkableTiles,
      },
      tileAssets: { required, missing },
      portals,
      reachability: { fromStart, classification },
      complete: false,
    };
  });

  for (const entry of entries) {
    entry.complete = !issues.some((issue) => issue.mapId === entry.mapId);
  }

  const completeMaps = entries.filter(({ complete }) => complete).length;
  const totalMaps = entries.length;
  return {
    startMapId,
    summary: {
      totalMaps,
      completeMaps,
      coveragePercent: totalMaps === 0 ? 0 : Math.round((completeMaps / totalMaps) * 100),
      portalCells: entries.reduce((sum, entry) => sum + entry.portals.length, 0),
    },
    reachableMapIds: [...worldReachability.maps].sort(),
    unreachableMapIds: entries.filter((entry) => !entry.reachability.fromStart).map(({ mapId }) => mapId).sort(),
    maps: entries,
    issues,
  };
}

function addIssue(issues: MapCoverageIssue[], code: MapCoverageIssue['code'], mapId: string | null, detail: string): void {
  issues.push({ code, mapId, detail });
}

function tileAt(map: MapDef, point: Point): MapDef['legend'][string] | null {
  if (point.x < 0 || point.y < 0 || point.x >= map.width || point.y >= map.height) return null;
  const symbol = map.rows[point.y]?.[point.x];
  return symbol ? map.legend[symbol] ?? null : null;
}

function localReachableTiles(map: MapDef, start: Point): Set<string> {
  const first = tileAt(map, start);
  if (!first || !isWalkable(first.kind) || first.kind === 'door') return new Set();
  const reached = new Set([pointKey(start)]);
  const queue = [start];
  const directions = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const direction of directions) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      const key = pointKey(next);
      if (reached.has(key)) continue;
      const tile = tileAt(map, next);
      if (!tile || !isWalkable(tile.kind)) continue;
      reached.add(key);
      if (tile.kind !== 'door') queue.push(next);
    }
  }
  return reached;
}

function traceWorldReachability(maps: ReadonlyMap<string, MapDef>, startMapId: string): { maps: Set<string>; portals: Set<string> } {
  const reachableMaps = new Set<string>();
  const reachablePortals = new Set<string>();
  const start = maps.get(startMapId);
  if (!start) return { maps: reachableMaps, portals: reachablePortals };
  const queue: Array<{ mapId: string; entry: Point }> = [{ mapId: startMapId, entry: start.spawn }];
  const visitedEntries = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    const entryKey = `${current.mapId}:${pointKey(current.entry)}`;
    if (visitedEntries.has(entryKey)) continue;
    visitedEntries.add(entryKey);
    const map = maps.get(current.mapId);
    if (!map) continue;
    reachableMaps.add(map.id);
    const reached = localReachableTiles(map, current.entry);
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const key = pointKey({ x, y });
        if (!reached.has(key)) continue;
        const symbol = map.rows[y]?.[x];
        const tile = symbol ? map.legend[symbol] : undefined;
        if (tile?.kind !== 'door' || !tile.to) continue;
        const target = maps.get(tile.to);
        const landing = target && (tile.spawn ?? target.spawn);
        const landingTile = target && landing ? tileAt(target, landing) : null;
        if (!target || !landing || !landingTile || !isWalkable(landingTile.kind) || landingTile.kind === 'door') continue;
        reachablePortals.add(portalKey(map.id, x, y));
        queue.push({ mapId: target.id, entry: landing });
      }
    }
  }
  return { maps: reachableMaps, portals: reachablePortals };
}

function countWalkableTiles(map: MapDef): number {
  let count = 0;
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = tileAt(map, { x, y });
      if (tile && isWalkable(tile.kind)) count += 1;
    }
  }
  return count;
}

function pointKey({ x, y }: Point): string {
  return `${x},${y}`;
}

function portalKey(mapId: string, x: number, y: number): string {
  return `${mapId}:${x},${y}`;
}
