import { describe, expect, it } from 'vitest';
import companions from '../../../content/companions.json';
import rigs from '../../../content/rigs.json';
import farm from '../../../content/maps/farm.json';
import village from '../../../content/maps/village.json';
import npcs from '../../../content/npcs.json';
import type { ContentPack, MapDef } from '../../domain/content';
import { companionsFileSchema } from '../content/content-schema';
import { companionProblems, type CompanionDef, type CompanionManifest } from './companion-manifest';
import type { RigManifest } from './rig-manifest';

/** 一個小村莊：(2,1) 是草地，(0,0) 是牆，(2,2) 是門，NPC 米拉站在 (1,1)。 */
const map: MapDef = {
  id: 'village',
  name: '村莊',
  width: 4,
  height: 3,
  rows: ['#...', '.M..', '##D#'],
  legend: {
    '#': { kind: 'wall' },
    '.': { kind: 'grass' },
    M: { kind: 'grass' },
    D: { kind: 'door', to: 'farm', spawn: { x: 1, y: 1 } },
  },
  spawn: { x: 2, y: 1 },
  npcs: [{ npcId: 'mira', x: 1, y: 1 }],
};
const pack = { maps: [map], npcs: [{ id: 'mira', name: '米拉', lines: ['你好'] }] } as unknown as Pick<ContentPack, 'maps' | 'npcs'>;

const rigList: RigManifest = {
  version: 1,
  rigs: [
    { id: 'cat', kind: 'hop', textureSize: { width: 96, height: 96 }, asset: 'pet.cat' },
    { id: 'maomao', kind: 'single', textureSize: { width: 128, height: 160 }, asset: 'npc.maomao' },
  ],
};

const follower: CompanionDef = { id: 'cat', rig: 'cat', follows: 'player' };
const resident: CompanionDef = { id: 'pup', rig: 'cat', home: { mapId: 'village', x: 2, y: 1 }, reactsTo: 'mira' };
const manifestOf = (...list: CompanionDef[]): CompanionManifest => ({ version: 1, companions: list });

describe('companionsFileSchema', () => {
  const parse = (value: unknown) => companionsFileSchema.safeParse({ version: 1, companions: [value] });

  it('accepts a follower and a resident', () => {
    expect(parse(follower).success).toBe(true);
    expect(parse(resident).success).toBe(true);
  });

  it('only allows following the player', () => {
    expect(parse({ ...follower, follows: 'maomao' }).success).toBe(false);
  });

  it('rejects a home without a whole-number position, a missing rig and a wrong file version', () => {
    expect(parse({ ...resident, home: { mapId: 'village', x: 1.5, y: 1 } }).success).toBe(false);
    expect(parse({ id: 'x', follows: 'player' }).success).toBe(false);
    expect(companionsFileSchema.safeParse({ version: 2, companions: [] }).success).toBe(false);
  });
});

describe('companionProblems', () => {
  it('accepts a follower and a resident that stands on a free walkable tile', () => {
    // 常駐夥伴站在 (2,1)，不與 NPC (1,1) 重疊。
    expect(companionProblems(manifestOf(follower, resident), rigList, pack)).toEqual([]);
  });

  it('rejects two companions with the same id', () => {
    expect(companionProblems(manifestOf(follower, follower), rigList, pack)).toEqual(['夥伴 id 重複：cat']);
  });

  it('rejects a rig that does not exist', () => {
    expect(companionProblems(manifestOf({ ...follower, rig: 'dog' }), rigList, pack)).toEqual(['夥伴 cat 的 rig dog 不存在']);
  });

  it('rejects a rig that is not a hopping rig', () => {
    expect(companionProblems(manifestOf({ ...follower, rig: 'maomao' }), rigList, pack)).toEqual([
      '夥伴 cat 的 rig maomao 必須是 hop',
    ]);
  });

  it('wants exactly one of follows and home', () => {
    expect(companionProblems(manifestOf({ id: 'cat', rig: 'cat' }), rigList, pack)).toEqual(['夥伴 cat 必須擇一設定 follows 或 home']);
    expect(companionProblems(manifestOf({ ...resident, follows: 'player' }), rigList, pack)).toEqual([
      '夥伴 pup 必須擇一設定 follows 或 home',
    ]);
  });

  it('rejects a home on a map that does not exist', () => {
    const home = { mapId: 'nowhere', x: 2, y: 1 };
    expect(companionProblems(manifestOf({ ...resident, home }), rigList, pack)).toEqual(['夥伴 pup 的 home 地圖 nowhere 不存在']);
  });

  it('rejects a home on a tile nobody can stand on, including a wall, a door and outside the map', () => {
    for (const [x, y] of [[0, 0], [2, 2], [9, 9]] as const) {
      expect(companionProblems(manifestOf({ ...resident, home: { mapId: 'village', x, y } }), rigList, pack), `(${x},${y})`).toEqual([
        `夥伴 pup 的 home (${x},${y}) 在 village 不可行走`,
      ]);
    }
  });

  it('rejects a home on top of a villager', () => {
    expect(companionProblems(manifestOf({ ...resident, home: { mapId: 'village', x: 1, y: 1 } }), rigList, pack)).toEqual([
      '夥伴 pup 的 home (1,1) 與 NPC mira 重疊',
    ]);
  });

  it('rejects two residents on the same tile', () => {
    const second: CompanionDef = { ...resident, id: 'pup2' };
    expect(companionProblems(manifestOf(resident, second), rigList, pack)).toEqual([
      '夥伴 pup2 的 home (2,1) 與夥伴 pup 重疊',
    ]);
  });

  it('rejects a reaction to a villager that does not exist', () => {
    expect(companionProblems(manifestOf({ ...resident, reactsTo: 'ghost' }), rigList, pack)).toEqual([
      '夥伴 pup 的 reactsTo NPC ghost 不存在',
    ]);
  });
});

describe('shipped companions', () => {
  const shipped = companions as CompanionManifest;
  const realPack = { maps: [farm, village], npcs } as unknown as Pick<ContentPack, 'maps' | 'npcs'>;

  it('pass the schema and cross-reference the shipped rigs, maps and villagers without problems', () => {
    expect(companionsFileSchema.safeParse(companions).success).toBe(true);
    expect(companionProblems(shipped, rigs as RigManifest, realPack)).toEqual([]);
  });

  it('give the player a following black cat and Maomao a resident marsupial that reacts to him', () => {
    const byId = new Map(shipped.companions.map((c) => [c.id, c]));
    expect(byId.get('cat')).toMatchObject({ rig: 'cat', follows: 'player' });
    expect(byId.get('marsupial')).toMatchObject({ rig: 'marsupial', home: { mapId: 'village' }, reactsTo: 'maomao' });
  });
});
