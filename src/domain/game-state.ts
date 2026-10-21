import type { Calendar } from './calendar';
import { createCalendar } from './calendar';
import { rollWeather, type Weather } from './weather';
import { advanceRng } from './random';
import { emptySkills, type SkillXp } from './skills';
import type { Animal } from './animals';
import type { ProcessingJob } from './processing';
import { TOOL_IDS, type ToolId } from './tools';
import type { WorldChanges } from './world-changes';

export { TOOL_ORDER, TOOL_IDS, type ToolId } from './tools';
import type { ContentPack, Direction, Point } from './content';
import { addItem, createInventory, type Inventory } from './inventory';
import { cropItems, seedItemId } from './items';
import { createEnergy, type Energy } from './energy';
import type { PlotMap } from './farm';
import { createShipBox, type ShipBox } from './shipping';

export const SAVE_SCHEMA_VERSION = 11;

export interface PlayerState extends Point {
  facing: Direction;
}

export interface GameState {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  calendar: Calendar;
  /** 今天的天氣。 */
  weather: Weather;
  /** 明天的天氣預報（睡醒後就會變成今天的天氣）。 */
  forecast: Weather;
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
  /** 每件工具的階級（0 基礎、1 銅、2 銀、3 金）。 */
  toolTiers: Record<ToolId, number>;
  /** 玩家造成的地圖變化（砍樹、採野薄荷、敲礦），見 world-changes.ts。 */
  worldChanges: WorldChanges;
  /** 五項技能的經驗（等級由經驗換算，見 skills.ts）。 */
  skills: SkillXp;
  /** 雞舍裡的動物（依座位排序）。 */
  animals: Animal[];
  /** 加工機裡的批次（醃漬、烘乾）；daysLeft 為 0 表示已完成、等玩家取回。 */
  processing: ProcessingJob[];
  /** 投竿後等待收線的魚（魚上鉤後才有；任何其他動作都會放掉它）。 */
  fishing: { fishId: string } | null;
  /** 礦坑的種子：同一個種子每一層的樣子都一樣。 */
  mineSeed: number;
  /** 最深到過的檢查點層數（從入口下來會直接到這裡）；至少是第 1 層。 */
  mineCheckpoint: number;
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
  const today = rollWeather(content.weather, 'spring', seed >>> 0);
  const tomorrow = rollWeather(content.weather, 'spring', today.rng);
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    calendar: createCalendar(content.tuning.time.wakeMinute),
    weather: today.value,
    forecast: tomorrow.value,
    energy: createEnergy(content.tuning.energy.max),
    gold: content.start.gold,
    mapId: map.id,
    player: { ...map.spawn, facing: 'down' },
    plots: {},
    inventory,
    shipBox: createShipBox(),
    flags: {},
    rng: tomorrow.rng,
    tool: 'hoe',
    toolTiers: Object.fromEntries(TOOL_IDS.map((tool) => [tool, 0])) as Record<ToolId, number>,
    worldChanges: {},
    skills: emptySkills(),
    fishing: null,
    animals: [],
    processing: [],
    mineSeed: advanceRng(seed >>> 0),
    mineCheckpoint: 1,
    selectedSeed: selectedSeed.id,
    playtimeSeconds: 0,
  };
}
