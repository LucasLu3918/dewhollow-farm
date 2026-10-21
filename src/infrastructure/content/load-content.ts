import type { ContentPack, MapDef, Point } from '../../domain/content';
import { isWalkable, tileAt } from '../../domain/world';
import { assetProblems, missingAssetIds, requiredAssetIds, type AssetManifest } from '../assets/asset-manifest';
import { rigProblems, type RigManifest } from '../assets/rig-manifest';
import {
  assetsFileSchema,
  cropsFileSchema,
  mapFileSchema,
  npcsFileSchema,
  rigsFileSchema,
  startFileSchema,
  tuningFileSchema,
} from './content-schema';

export interface RawContentFiles {
  crops: unknown;
  npcs: unknown;
  maps: unknown[];
  start: unknown;
  tuning: unknown;
  assets: unknown;
  rigs: unknown;
}

export interface LoadedContent {
  pack: ContentPack;
  assets: AssetManifest;
  rigs: RigManifest;
}

/** 內容錯誤會一次列出所有問題，方便一次修正。 */
export class ContentError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`內容資料有 ${problems.length} 個問題：\n- ${problems.join('\n- ')}`);
    this.name = 'ContentError';
    this.problems = problems;
  }
}

export function loadContent(raw: RawContentFiles): LoadedContent {
  const crops = cropsFileSchema.parse(raw.crops);
  const npcs = npcsFileSchema.parse(raw.npcs);
  const maps = raw.maps.map((m) => mapFileSchema.parse(m));
  const start = startFileSchema.parse(raw.start);
  const tuning = tuningFileSchema.parse(raw.tuning);
  const assets = assetsFileSchema.parse(raw.assets);
  const rigs: RigManifest = rigsFileSchema.parse(raw.rigs);

  const pack: ContentPack = { crops, npcs, maps, start, tuning };
  const problems = [...validateCrossReferences(pack, assets), ...rigProblems(rigs, assets)];
  if (problems.length > 0) throw new ContentError(problems);
  return { pack, assets, rigs };
}

export function validateCrossReferences(pack: ContentPack, assets: AssetManifest): string[] {
  const problems: string[] = [];
  const cropIds = new Set(pack.crops.map((c) => c.id));
  const npcIds = new Set(pack.npcs.map((n) => n.id));
  const mapById = new Map(pack.maps.map((m) => [m.id, m]));

  duplicates(pack.crops.map((c) => c.id), 'crop', problems);
  duplicates(pack.npcs.map((n) => n.id), 'npc', problems);
  duplicates(pack.maps.map((m) => m.id), 'map', problems);

  for (const npc of pack.npcs) {
    if (npc.gift && !cropIds.has(npc.gift.cropId)) {
      problems.push(`NPC ${npc.id} 的贈禮作物 ${npc.gift.cropId} 不存在`);
    }
  }

  for (const map of pack.maps) {
    validateMapShape(map, problems);
    for (const [symbol, tile] of Object.entries(map.legend)) {
      if (tile.kind === 'door') {
        if (!tile.to || !mapById.has(tile.to)) {
          problems.push(`地圖 ${map.id} 的門 ${symbol} 指向不存在的地圖 ${tile.to ?? '(未填)'}`);
          continue;
        }
        const target = mapById.get(tile.to);
        if (!target) continue;
        const landing = tile.spawn ?? target.spawn;
        if (!isWalkableAt(target, landing)) {
          problems.push(`地圖 ${map.id} 的門 ${symbol} 落點 (${landing.x},${landing.y}) 在 ${target.id} 不可行走`);
        }
      }
    }
    const seen = new Set<string>();
    for (const placement of map.npcs) {
      if (!npcIds.has(placement.npcId)) {
        problems.push(`地圖 ${map.id} 的 NPC ${placement.npcId} 不存在`);
      }
      const key = `${placement.x},${placement.y}`;
      if (seen.has(key)) problems.push(`地圖 ${map.id} 在 (${key}) 有重複的 NPC`);
      seen.add(key);
      if (!isWalkableAt(map, placement)) {
        problems.push(`地圖 ${map.id} 的 NPC ${placement.npcId} 位於不可行走的格子 (${key})`);
      }
    }
  }

  const start = mapById.get(pack.start.mapId);
  if (!start) {
    problems.push(`起始地圖 ${pack.start.mapId} 不存在`);
  } else if (!isWalkableAt(start, start.spawn)) {
    problems.push(`起始地圖 ${start.id} 的出生點不可行走`);
  }
  for (const cropId of Object.keys(pack.start.seeds)) {
    if (!cropIds.has(cropId)) problems.push(`起始種子 ${cropId} 不存在`);
  }

  const tileKinds = new Set<string>();
  for (const map of pack.maps) for (const tile of Object.values(map.legend)) tileKinds.add(tile.kind);
  const required = requiredAssetIds(
    [...tileKinds],
    pack.crops.map((c) => c.id),
    pack.npcs.map((n) => n.id),
  );
  for (const id of missingAssetIds(assets, required)) {
    problems.push(`素材清單缺少 ${id}`);
  }
  problems.push(...assetProblems(assets));

  return problems;
}

function validateMapShape(map: MapDef, problems: string[]): void {
  if (map.rows.length !== map.height) {
    problems.push(`地圖 ${map.id} 的列數 ${map.rows.length} 與 height ${map.height} 不符`);
  }
  map.rows.forEach((row, y) => {
    if (row.length !== map.width) {
      problems.push(`地圖 ${map.id} 第 ${y} 列長度 ${row.length} 與 width ${map.width} 不符`);
    }
    for (const symbol of row) {
      if (!map.legend[symbol]) problems.push(`地圖 ${map.id} 使用了未定義的符號 "${symbol}"`);
    }
  });
  if (!isWalkableAt(map, map.spawn)) {
    problems.push(`地圖 ${map.id} 的出生點 (${map.spawn.x},${map.spawn.y}) 不可行走`);
  }
}

function isWalkableAt(map: MapDef, point: Point): boolean {
  const tile = tileAt(map, point.x, point.y);
  return tile !== null && isWalkable(tile.kind) && tile.kind !== 'door';
}

function duplicates(ids: string[], label: string, problems: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) problems.push(`${label} id 重複：${id}`);
    seen.add(id);
  }
}
