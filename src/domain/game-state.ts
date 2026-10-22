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
import type { TalentChoices } from './talents';
import type { Friendship } from './friendship';
import { EMPTY_BOARD, type BoardState } from './bulletin';
import type { QuestRecord } from './quests';
import type { LetterStatus } from './mail';
import { emptyFestivalState, type FestivalState } from './festival';
import { emptyStory, type StoryState } from './story';
import type { RepairState } from './repairs';
import { noEvent, type TodayEvent } from './random-events';
import { emptyCollection, type CollectionState } from './collection';
import { emptyAchievements, type AchievementState } from './achievements';

export const SAVE_SCHEMA_VERSION = 19;

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
  /** 每項技能已選的天賦 id（5 級才能選，每項只能選一次，見 talents.ts）。 */
  talents: TalentChoices;
  /** 雞舍裡的雞（依座位排序）。 */
  animals: Animal[];
  /** 牛舍裡的牛（依座位排序）。牛舍要先改建（flags.cowbarn），見 game-commands.ts。 */
  cows: Animal[];
  /** 加工機裡的批次（醃漬、烘乾）；daysLeft 為 0 表示已完成、等玩家取回。 */
  processing: ProcessingJob[];
  /** 投竿後等待收線的魚（魚上鉤後才有；任何其他動作都會放掉它）。 */
  fishing: { fishId: string } | null;
  /** 每位居民的好感與今日紀錄（對話、送禮）；沒有紀錄的居民視為 0 顆心。見 friendship.ts。 */
  friendship: Record<string, Friendship>;
  /** 已經觸發過的心形事件 id（每個事件只會觸發一次）。 */
  heartEvents: string[];
  /** 正在進行、還沒選完選項的心形事件 id；有值時畫面要先讓玩家選完（其他指令會被擋下）。 */
  pendingHeartEvent: string | null;
  /** 委託的紀錄（接過的才有）：進行中或已完成，見 quests.ts。 */
  quests: Record<string, QuestRecord>;
  /** 佈告欄今天的抽取（day 為抽取當天的總天數；0 表示還沒抽過），見 bulletin.ts。 */
  board: BoardState;
  /** 信箱：送進來的信與已讀狀態（沒有紀錄代表還沒送到）。 */
  mail: Record<string, LetterStatus>;
  /** 圖鑑碎片的數量（委託獎勵；圖鑑本身在之後的里程碑）。 */
  dexFragments: number;
  /** 主線進度：目前要完成的章節號（見 story.ts）。 */
  story: StoryState;
  /** 節慶紀錄：每項活動每年一次、釣魚比賽、夜市攤位的售出數（見 festival.ts）。 */
  festival: FestivalState;
  /** 夜釣星星：已經甩竿、等玩家在時機到的時候按 X（任何其他動作都會放掉它）。 */
  starLine: boolean;
  /** 社區修復的捐獻紀錄（每項修復每年一份，見 repairs.ts）。 */
  repairs: RepairState;
  /** 今天的隨機事件（睡醒時決定，見 random-events.ts）；id 為 null 表示今天沒有事件。 */
  dailyEvent: TodayEvent;
  /** 圖鑑：每一類已發現的條目與已領過的門檻獎勵（見 collection.ts）。 */
  collection: CollectionState;
  /** 成就：已達成的成就、計數器與稱號（見 achievements.ts）。 */
  achievements: AchievementState;
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
    talents: {},
    fishing: null,
    animals: [],
    cows: [],
    processing: [],
    friendship: {},
    heartEvents: [],
    pendingHeartEvent: null,
    quests: {},
    board: { ...EMPTY_BOARD },
    mail: {},
    dexFragments: 0,
    story: emptyStory(),
    festival: emptyFestivalState(),
    starLine: false,
    repairs: {},
    dailyEvent: noEvent(),
    collection: emptyCollection(),
    achievements: emptyAchievements(),
    mineSeed: advanceRng(seed >>> 0),
    mineCheckpoint: 1,
    selectedSeed: selectedSeed.id,
    playtimeSeconds: 0,
  };
}
