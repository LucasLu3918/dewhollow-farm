import { SEASONS } from '../../domain/calendar';
import type { ContentPack, MapDef, Point } from '../../domain/content';
import { isWalkable, tileAt } from '../../domain/world';
import { assetProblems, missingAssetIds, requiredAssetIds, type AssetManifest } from '../assets/asset-manifest';
import { companionProblems, type CompanionManifest } from '../assets/companion-manifest';
import { rigProblems, type RigManifest } from '../assets/rig-manifest';
import { toolProblems, type ToolManifest } from '../assets/tool-manifest';
import {
  assetsFileSchema,
  companionsFileSchema,
  cropsFileSchema,
  mapFileSchema,
  npcsFileSchema,
  rigsFileSchema,
  itemsFileSchema,
  shopsFileSchema,
  fishFileSchema,
  animalsFileSchema,
  recipesFileSchema,
  processingFileSchema,
  craftingFileSchema,
  musicFileSchema,
  soundsFileSchema,
  startFileSchema,
  terrainFileSchema,
  toolsFileSchema,
  tuningFileSchema,
  weatherFileSchema,
  type MusicFile,
  type SoundsFile,
  type TerrainFile,
} from './content-schema';

export interface RawContentFiles {
  crops: unknown;
  npcs: unknown;
  maps: unknown[];
  start: unknown;
  tuning: unknown;
  assets: unknown;
  rigs: unknown;
  companions: unknown;
  tools: unknown;
  sounds: unknown;
  music: unknown;
  terrain: unknown;
  weather: unknown;
  items: unknown;
  shops: unknown;
  fish: unknown;
  animals: unknown;
  recipes: unknown;
  processing: unknown;
  crafting: unknown;
}

export interface LoadedContent {
  pack: ContentPack;
  assets: AssetManifest;
  rigs: RigManifest;
  companions: CompanionManifest;
  tools: ToolManifest;
  sounds: SoundsFile;
  music: MusicFile;
  terrain: TerrainFile;
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
  const companions: CompanionManifest = companionsFileSchema.parse(raw.companions);
  const tools: ToolManifest = toolsFileSchema.parse(raw.tools);
  const sounds = soundsFileSchema.parse(raw.sounds);
  const music = musicFileSchema.parse(raw.music);
  const terrain = terrainFileSchema.parse(raw.terrain);
  const weather = weatherFileSchema.parse(raw.weather);

  const items = itemsFileSchema.parse(raw.items);
  const shops = shopsFileSchema.parse(raw.shops);
  const fish = fishFileSchema.parse(raw.fish);
  const animals = animalsFileSchema.parse(raw.animals);
  const recipes = recipesFileSchema.parse(raw.recipes);
  const processing = processingFileSchema.parse(raw.processing);
  const crafting = craftingFileSchema.parse(raw.crafting);

  const pack: ContentPack = { crops, npcs, maps, start, tuning, weather: weather.seasons, items: items.items, shops: shops.shops, fish: fish.fish, animals: animals.animals, recipes: recipes.recipes, processing: processing.recipes, crafting: crafting.recipes };
  const problems = [
    ...validateCrossReferences(pack, assets),
    ...rigProblems(rigs, assets),
    ...companionProblems(companions, rigs, pack),
    ...toolProblems(tools, assets),
    ...terrainProblems(terrain, sounds, maps),
    ...musicProblems(music),
    ...economyProblems(pack),
  ];
  if (problems.length > 0) throw new ContentError(problems);
  return { pack, assets, rigs, companions, tools, sounds, music, terrain };
}

/** 背景音樂：音階要存在、旋律與低音等長（循環才對齊），且每個季節與時段恰好一首。 */
export function musicProblems(music: MusicFile): string[] {
  const problems: string[] = [];
  duplicates(music.tracks.map((t) => t.id), 'music track', problems);
  for (const track of music.tracks) {
    if (!(track.scale in music.scales)) problems.push(`曲目 ${track.id} 的音階 ${track.scale} 不存在`);
    const melodyBeats = track.melody.notes.reduce((sum, [, beats]) => sum + beats, 0);
    const bassBeats = track.bass.notes.reduce((sum, [, beats]) => sum + beats, 0);
    if (melodyBeats !== bassBeats) {
      problems.push(`曲目 ${track.id} 的旋律與低音拍數不同（${melodyBeats} 與 ${bassBeats}）`);
    }
  }
  for (const season of SEASONS) {
    for (const period of ['day', 'night'] as const) {
      const count = music.tracks.filter((t) => t.season === season && t.period === period).length;
      if (count === 0) problems.push(`缺少 ${season} ${period} 的曲目`);
      if (count > 1) problems.push(`${season} ${period} 有 ${count} 首曲目，每個季節與時段只能有一首`);
    }
  }
  return problems;
}

/** 每種可走的地形都要有腳步設定，且腳步指向存在的音效。 */
export function terrainProblems(terrain: TerrainFile, sounds: SoundsFile, maps: MapDef[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const entry of terrain.terrains) {
    if (seen.has(entry.kind)) problems.push(`地形 ${entry.kind} 重複定義`);
    seen.add(entry.kind);
    if (!(entry.footstep.sound in sounds.sounds)) {
      problems.push(`地形 ${entry.kind} 的腳步音效 ${entry.footstep.sound} 不存在`);
    }
  }
  const walkedKinds = new Set<string>();
  for (const map of maps) {
    for (const tile of Object.values(map.legend)) {
      if (isWalkable(tile.kind) && tile.kind !== 'door') walkedKinds.add(tile.kind);
    }
  }
  for (const kind of walkedKinds) {
    if (!seen.has(kind)) problems.push(`地圖上的地形 ${kind} 沒有腳步設定（content/terrain.json）`);
  }
  return problems;
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

/** 商店與物品的交叉檢查：櫃檯指向的店要存在、賣的東西與升級的材料要存在、升級的階級要在範圍內。 */
export function economyProblems(pack: ContentPack): string[] {
  const problems: string[] = [];
  const itemIds = new Set([
    ...pack.items.map((i) => i.id),
    ...pack.crops.flatMap((c) => [`seed.${c.id}`, `crop.${c.id}`]),
    ...pack.fish.map((f) => `fish.${f.id}`),
    ...pack.animals.map((a) => `animal.${a.id}`),
  ]);
  for (const animal of pack.animals) {
    if (!pack.items.some((i) => i.id === animal.eggItem)) problems.push(`動物 ${animal.id} 下的蛋 ${animal.eggItem} 不存在`);
  }
  const shopIds = new Set(pack.shops.map((s) => s.id));
  for (const recipe of pack.crafting) {
    for (const itemId of Object.keys(recipe.ingredients)) {
      if (!itemIds.has(itemId)) problems.push(`合成配方 ${recipe.id} 的材料 ${itemId} 不存在`);
    }
    if (recipe.output && !itemIds.has(recipe.output.item)) problems.push(`合成配方 ${recipe.id} 的產物 ${recipe.output.item} 不存在`);
  }
  for (const map of pack.maps) {
    for (const [symbol, tile] of Object.entries(map.legend)) {
      if (tile.item && !itemIds.has(tile.item)) problems.push(`地圖 ${map.id} 的採集點 ${symbol} 的物品 ${tile.item} 不存在`);
    }
  }
  for (const recipe of pack.processing) {
    for (const itemId of Object.keys(recipe.ingredients)) {
      if (!itemIds.has(itemId)) problems.push(`加工配方 ${recipe.id} 的材料 ${itemId} 不存在`);
    }
    if (!itemIds.has(recipe.output)) problems.push(`加工配方 ${recipe.id} 的成品 ${recipe.output} 不存在`);
  }
  duplicates(pack.items.map((i) => i.id), 'item', problems);
  duplicates(pack.shops.map((s) => s.id), 'shop', problems);
  for (const shop of pack.shops) {
    for (const line of shop.stock) {
      if (!itemIds.has(line.itemId)) problems.push(`商店 ${shop.id} 賣的物品 ${line.itemId} 不存在`);
    }
    for (const upgrade of shop.upgrades) {
      if (upgrade.tier >= pack.tuning.tools.tiers.length) problems.push(`商店 ${shop.id} 的升級階級 ${upgrade.tier} 超出工具階級範圍`);
      for (const itemId of Object.keys(upgrade.items)) {
        if (!itemIds.has(itemId)) problems.push(`商店 ${shop.id} 的升級材料 ${itemId} 不存在`);
      }
    }
  }
  for (const map of pack.maps) {
    for (const tile of Object.values(map.legend)) {
      if (tile.kind === 'shop' && (!tile.shop || !shopIds.has(tile.shop))) {
        problems.push(`地圖 ${map.id} 的櫃檯指向不存在的商店 ${tile.shop ?? '(未填)'}`);
      }
    }
  }
  return problems;
}

