/** 內容的純型別定義。資料實體放在 content/*.json，由基礎設施層載入並驗證。 */

export interface Point {
  x: number;
  y: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface CropDef {
  id: string;
  name: string;
  seedPrice: number;
  growthDays: number;
}

export interface NpcDef {
  id: string;
  name: string;
  lines: string[];
  /** 首次對話時贈送的種子；沒有則不送。 */
  gift?: { cropId: string; count: number };
}

export type TileKind = 'grass' | 'field' | 'path' | 'wall' | 'bed' | 'shipbox' | 'door';

export interface TileDef {
  kind: TileKind;
  /** 僅門會用到：通往的地圖與落點。 */
  to?: string;
  spawn?: Point;
}

export interface MapNpcPlacement {
  npcId: string;
  x: number;
  y: number;
}

export interface MapDef {
  id: string;
  name: string;
  width: number;
  height: number;
  /** 每列一個字串，字元對應 legend。 */
  rows: string[];
  legend: Record<string, TileDef>;
  spawn: Point;
  npcs: MapNpcPlacement[];
}

import type { Tuning } from './tuning';

/** 新遊戲的起始設定。 */
export interface StartConfig {
  mapId: string;
  gold: number;
  seeds: Record<string, number>;
}

export interface ContentPack {
  crops: CropDef[];
  npcs: NpcDef[];
  maps: MapDef[];
  start: StartConfig;
  tuning: Tuning;
}
