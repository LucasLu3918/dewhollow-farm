import type { ContentPack } from '../../domain/content';
import { isWalkable, tileAt } from '../../domain/world';
import type { RigManifest } from './rig-manifest';

/**
 * 夥伴（寵物）：只存在於畫面上的陪伴者，不參與遊戲規則（不擋路、不進存檔）。
 * - `follows: 'player'`：跟著玩家，永遠落在玩家剛離開的格子；
 * - `home`：住在某張地圖的某一格；`reactsTo` 指定一位居民，玩家跟他說話時夥伴會跳一下。
 * 兩者擇一。
 */
export interface CompanionDef {
  id: string;
  /** 使用 rigs.json 裡 kind 為 hop 的骨架。 */
  rig: string;
  follows?: 'player';
  home?: { mapId: string; x: number; y: number };
  reactsTo?: string;
}

export interface CompanionManifest {
  version: 1;
  companions: CompanionDef[];
}

/** 夥伴與骨架、地圖、居民的交叉檢查。 */
export function companionProblems(
  manifest: CompanionManifest,
  rigs: RigManifest,
  pack: Pick<ContentPack, 'maps' | 'npcs' | 'schedule'>,
): string[] {
  const problems: string[] = [];
  const rigById = new Map(rigs.rigs.map((r) => [r.id, r]));
  const mapById = new Map(pack.maps.map((m) => [m.id, m]));
  const npcIds = new Set(pack.npcs.map((n) => n.id));
  const seen = new Set<string>();
  const homes = new Map<string, string>(); // "地圖,x,y" → 夥伴 id

  for (const c of manifest.companions) {
    if (seen.has(c.id)) problems.push(`夥伴 id 重複：${c.id}`);
    seen.add(c.id);

    const rig = rigById.get(c.rig);
    if (!rig) problems.push(`夥伴 ${c.id} 的 rig ${c.rig} 不存在`);
    else if (rig.kind !== 'hop') problems.push(`夥伴 ${c.id} 的 rig ${c.rig} 必須是 hop`);

    if ((c.follows === undefined) === (c.home === undefined)) {
      problems.push(`夥伴 ${c.id} 必須擇一設定 follows 或 home`);
    }

    if (c.home) problems.push(...homeProblems(c.id, c.home, mapById, homes, pack.schedule.entries));
    if (c.reactsTo !== undefined && !npcIds.has(c.reactsTo)) {
      problems.push(`夥伴 ${c.id} 的 reactsTo NPC ${c.reactsTo} 不存在`);
    }
  }
  return problems;
}

function homeProblems(
  id: string,
  home: { mapId: string; x: number; y: number },
  mapById: ReadonlyMap<string, ContentPack['maps'][number]>,
  homes: Map<string, string>,
  schedule: ContentPack['schedule']['entries'],
): string[] {
  const map = mapById.get(home.mapId);
  if (!map) return [`夥伴 ${id} 的 home 地圖 ${home.mapId} 不存在`];

  const tile = tileAt(map, home.x, home.y);
  if (!tile || !isWalkable(tile.kind) || tile.kind === 'door') {
    return [`夥伴 ${id} 的 home (${home.x},${home.y}) 在 ${map.id} 不可行走`];
  }
  // 居民的行程（任何時段、天氣）若會站在夥伴的家，就重疊了。
  const resident = schedule.find((e) => e.mapId === home.mapId && e.x === home.x && e.y === home.y);
  if (resident) return [`夥伴 ${id} 的 home (${home.x},${home.y}) 與 NPC ${resident.npcId} 重疊`];

  const key = `${map.id},${home.x},${home.y}`;
  const other = homes.get(key);
  homes.set(key, other ?? id);
  if (other) return [`夥伴 ${id} 的 home (${home.x},${home.y}) 與夥伴 ${other} 重疊`];
  return [];
}
