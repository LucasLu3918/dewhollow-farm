import type { Calendar } from './calendar';
import { createCalendar } from './calendar';
import type { ContentPack, Direction, Point } from './content';
import { addItem, createInventory, type Inventory } from './inventory';
import { cropItems, seedItemId } from './items';
import { createEnergy, type Energy } from './energy';
import type { PlotMap } from './farm';
import { createShipBox, type ShipBox } from './shipping';

export const SAVE_SCHEMA_VERSION = 2;

export type ToolId = 'hoe' | 'can' | 'seedbag';
export const TOOL_ORDER: readonly ToolId[] = ['hoe', 'can', 'seedbag'];

export interface PlayerState extends Point {
  facing: Direction;
}

export interface GameState {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  calendar: Calendar;
  energy: Energy;
  gold: number;
  mapId: string;
  player: PlayerState;
  plots: PlotMap;
  inventory: Inventory;
  shipBox: ShipBox;
  /** 劇情或事件旗標，例如 `gift:mira`。 */
  flags: Record<string, boolean>;
  /** 隨機數狀態；收穫等隨機結果由它決定，讀檔後可重現。 */
  rng: number;
  tool: ToolId;
  selectedSeed: string;
  /** 累計真實遊玩秒數，供平衡分析與顯示。 */
  playtimeSeconds: number;
}

export function createNewGame(content: ContentPack, seed: number): GameState {
  const map = content.maps.find((m) => m.id === content.start.mapId);
  if (!map) throw new Error(`起始地圖不存在：${content.start.mapId}`);

  const items = new Map(cropItems(content.crops).map((item) => [item.id, item]));
  let inventory = createInventory(content.tuning.inventory.capacity);
  for (const [cropId, count] of Object.entries(content.start.seeds)) {
    if (count === 0) continue;
    const item = items.get(seedItemId(cropId));
    if (!item) throw new Error(`起始種子不存在：${cropId}`);
    const added = addItem(inventory, item, count);
    if (!added.ok) throw new Error(`背包放不下起始種子：${cropId}`);
    inventory = added.value;
  }

  // 預設選取第一個玩家持有種子的作物，避免一開始就無法播種。
  const held = (cropId: string) => inventory.stacks.some((s) => s.itemId === seedItemId(cropId));
  const selectedSeed = content.crops.find((c) => held(c.id)) ?? content.crops[0];
  if (!selectedSeed) throw new Error('內容缺少作物定義');
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    calendar: createCalendar(content.tuning.time.wakeMinute),
    energy: createEnergy(content.tuning.energy.max),
    gold: content.start.gold,
    mapId: map.id,
    player: { ...map.spawn, facing: 'down' },
    plots: {},
    inventory,
    shipBox: createShipBox(),
    flags: {},
    rng: seed >>> 0,
    tool: 'hoe',
    selectedSeed: selectedSeed.id,
    playtimeSeconds: 0,
  };
}
