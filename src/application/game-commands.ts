import { advanceMinutes, dateLabel, formatClock, nextMorning, totalDay } from '../domain/calendar';
import type { Direction, MapDef, Point, TileDef, TileKind } from '../domain/content';
import { addPoints, favorQualityBonus, giftPoints, giftReaction, heartCapPoints, heartsOf, NO_FRIENDSHIP, type Friendship, type GiftReaction } from '../domain/friendship';
import { readyHeartEvent, type HeartEmote } from '../domain/heart-events';
import { currentPeriod, residentAt } from './residents';
import { trySpend, restore } from '../domain/energy';
import { growCrops, harvestPlot, isRipe, plantCrop, plotKey, tillPlot, waterAllPlots, waterPlot, type PlotMap } from '../domain/farm';
import { TOOL_ORDER, type GameState, type ToolId } from '../domain/game-state';
import { addItem, countOf, removeItem, takeMatching, type Inventory } from '../domain/inventory';
import { cropItemId, seedItemId } from '../domain/items';
import { fail, ok, type Result } from '../domain/result';
import { settleShipBox, shipStack } from '../domain/shipping';
import { rollInt } from '../domain/random';
import { priceWithQuality } from '../domain/pricing';
import { isWalkable, neighbor, tileAt } from '../domain/world';
import { changeAt, clearDaily, effectiveKind, withChange } from '../domain/world-changes';
import { isCheckpoint, mineId, mineLayerOf } from '../domain/mine';
import { bonusYield, levelOf, qualityFor, skillOfAction, type SkillId, type SkillXp } from '../domain/skills';
import { passDays, startJob, takeReady } from '../domain/processing';
import { fertilizedSkillTuning } from '../domain/fertilizer';
import { biteChanceFor } from '../domain/fishing';
import { dailyCare, feedAll, milkQuality, newAnimal, petAnimal, produceEggs, slotsOf, type Animal, type FlockId } from '../domain/animals';
import { requirementMet } from '../domain/unlock';
import type { Quality } from '../domain/items';
import { energyCostFor, toolForAction, TIER_NAMES, TOOL_NAMES } from '../domain/tools';
import { rollWeather, WEATHER_NAMES, waters } from '../domain/weather';
import type { ActionKind } from '../domain/tuning';
import { applySellBonus, biteBonusPoints, dishEnergyBonus, extraYieldChance, rollExtraYield, sellBonusPercent } from '../domain/talents';
import type { ContentIndex } from './content-index';
import { acceptQuest, collectMail, currentBoard, deliverLetters, recordQuestEvent, refreshBoard, settleQuests, shortfallOf, submitQuest } from './quests';
import { observeProgress } from './collection';
import { festivalCrown, festivalHere, festivalSwap, lightLantern, recordContestCatch, recordHarvestContest, recordStallSale, recordWarmGift, stallRefusal, starExchange, warmGiftOpen, type FestivalOutcome } from './festival';
import { plantableIn, survivesSeasonChange } from '../domain/greenhouse';
import { settleStory, storyObjective } from './story';
import { donateToRepair } from './repairs';
import { endOfDay, eventBitePoints, eventYieldChance, startDay } from './random-events';
import { festivalOnDay } from '../domain/festival';
import { starCatchHit } from '../domain/star-fishing';

export type Command =
  | { type: 'move'; direction: Direction }
  | { type: 'interact' }
  /** 在櫃檯前買東西（店家與物品由內容定義）。 */
  | { type: 'buy'; shopId: string; itemId: string; count: number }
  /** 在鐵匠櫃檯前升級工具到下一階。 */
  | { type: 'upgrade'; shopId: string; toolId: ToolId }
  | { type: 'cycleTool' }
  | { type: 'cycleSeed' }
  /** 直接取出斧頭（不進 Z 的循環）。 */
  | { type: 'takeTool'; tool: ToolId }
  /** 收線：hit 表示有沒有在時限內按下（時機由畫面判斷）。只有魚上鉤後才有效。 */
  | { type: 'reel'; hit: boolean }
  /** 在廚房前面做一道菜（食譜在 recipes.json）。 */
  | { type: 'cook'; recipeId: string }
  /** 吃一道料理，回復體力。 */
  | { type: 'eat'; itemId: string }
  /** 在加工台前面放入一批加工（配方在 processing.json）。 */
  | { type: 'startProcessing'; recipeId: string }
  /** 在加工台前面取回所有已完成的成品。 */
  | { type: 'collectProcessing' }
  /** 在工作台前面合成一項（配方在 crafting.json）。 */
  | { type: 'craft'; recipeId: string }
  /** 技能到 5 級後，從該技能的兩個天賦裡選一個（每項技能只能選一次；不花體力與時間）。 */
  | { type: 'chooseTalent'; talentId: string }
  /** 站在居民面前（面向他）送一件東西：每天對同一人只能送一次，不花體力與時間。 */
  | { type: 'giveGift'; npcId: string; itemId: string }
  /** 心形事件的選項（事件進行中才有效）。 */
  | { type: 'chooseHeartOption'; optionId: string }
  /** 接取委託（居民委託的條件符合、或佈告欄上今天的委託）。不花體力與時間。 */
  | { type: 'acceptQuest'; questId: string }
  /** 交付委託要的物品（交付型委託；東西從背包拿走）。不花體力與時間。 */
  | { type: 'submitQuest'; questId: string }
  /** 節慶的種子交換：節慶當天在鎮廣場，居民此刻也在廣場，每人每年一次（不花體力與時間）。 */
  | { type: 'festivalSwap'; npcId: string }
  /** 節慶的花冠製作：節慶當天在鎮廣場，用合成配方的材料（不花體力與時間）。 */
  | { type: 'festivalCrown' }
  /** 夜市的星河兌換：用星河碎片換物品或解鎖配方，每項每年有上限（不花體力與時間，見 festival.ts）。 */
  | { type: 'starExchange'; lineId: string }
  /** 社區修復的捐獻：站在修復告示前（畫面）送出，從背包拿走 count 件（不花體力與時間，見 application/repairs.ts）。 */
  | { type: 'donate'; repairId: string; itemId: string; count: number }
  /** 夜釣星星：站在節慶水池前甩竿（耗釣魚的體力與時間），之後等 catchStar。 */
  | { type: 'castStar' }
  /** 星星收網：elapsedMs 是甩竿後到按下的毫秒數；null 表示時限內沒按。只有甩竿後才有效。 */
  | { type: 'catchStar'; elapsedMs: number | null }
  | { type: 'manualSave' };

export type GameEvent =
  | { type: 'slept' }
  | { type: 'enteredMap'; mapId: string }
  | { type: 'saveRequested' }
  /** 玩家跟某位居民說話（不論是否領到禮物）；供畫面讓該居民與他的夥伴做出反應。 */
  | { type: 'talked'; npcId: string; /** 第一次說話。 */ first: boolean; /** 這次真的收下了禮物。 */ gifted: boolean }
  /** 送禮的結果（喜歡、中立、討厭）；供畫面顯示表情。 */
  | { type: 'gifted'; npcId: string; reaction: GiftReaction }
  /** 心形事件開始：畫面打開事件面板（頁面與選項由內容定義，見 pendingHeartEvent）。 */
  | { type: 'heartEvent'; npcId: string; eventId: string; emote: HeartEmote }
  /** 動作被拒絕（體力不足、沒有東西可互動…）；供畫面顯示表情，狀態與時間都沒有改變。reason 是失敗代碼。 */
  | { type: 'refused'; reason: string }
  /** 成功的農務或出貨動作，供畫面播放效果；失敗的動作不會發出。 */
  | { type: 'acted'; action: ActionFeedback; x: number; y: number }
  /** 走到櫃檯前按互動：畫面打開對應的商店面板（不花體力與時間）。 */
  | { type: 'shopOpened'; shopId: string }
  /** 魚上鉤了：畫面開始計時，讓玩家收線（見 reel）。 */
  | { type: 'bite' }
  /** 走到廚房前按互動：畫面打開料理面板（不花體力與時間）。 */
  | { type: 'kitchenOpened' }
  | { type: 'workshopOpened' }
  | { type: 'workbenchOpened' }
  /** 站在佈告欄前按互動：畫面打開委託面板（狀態裡的今日佈告欄已經更新）。 */
  | { type: 'bulletinOpened' }
  /** 站在節慶告示前按互動：畫面打開節慶面板（不花體力與時間）。 */
  | { type: 'festivalOpened' }
  /** 夜釣星星甩竿成功：畫面開始星星的時機小遊戲，按 X 時送出 catchStar。 */
  | { type: 'starLine' }
  /** 站在修復告示前按互動：畫面打開修復面板（不花體力與時間）。 */
  | { type: 'repairOpened' }
  /** 合成成功（供圖鑑與成就計數，見 application/collection.ts）。 */
  | { type: 'crafted'; recipeId: string };

export type ActionFeedback = 'till' | 'water' | 'plant' | 'harvest' | 'ship' | 'chop' | 'forage' | 'mine' | 'fish';

export interface CommandOutcome {
  state: GameState;
  /** 要顯示給玩家的文字，依序呈現。 */
  messages: string[];
  events: GameEvent[];
}

const FAILURE_MESSAGES: Record<string, string> = {
  NOT_ENOUGH_ENERGY: '體力不足，請回家睡覺',
  ALREADY_TILLED: '這塊田已經開墾過了',
  NO_SOIL: '這塊地還沒開墾',
  ALREADY_PLANTED: '這塊田已經種了作物',
  NO_CROP: '這裡沒有作物',
  NOT_RIPE: '作物還沒成熟',
  NO_SEED: '種子袋裡沒有這種種子',
  BAG_FULL: '背包已滿',
  NEED_AXE: '要先切到斧頭才能砍樹',
  ALREADY_PICKED: '這裡已經採過了，明天再來',
  NOT_AT_SHOP: '要站在櫃檯前面才能買',
  NOT_SOLD: '這裡沒有賣這個',
  NO_GOLD: '金幣不夠',
  NOT_FOR_SALE: '這裡不升級這件工具',
  TIER_MAX: '這件工具已經是最高階了',
  NO_MATERIAL: '材料不夠',
  NOT_IN_SEASON: '這個季節種不了這種作物',
  MINE_LOCKED: '落石擋住了礦坑入口，要用鎬才清得開',
  NEED_PICK: '要先切到鎬才能敲石頭',
  NEED_ROD: '要先切到釣竿才能釣魚',
  NO_BITE: '現在沒有魚上鉤',
  NO_ROOM: '雞舍已經滿了',
  NO_COW_ROOM: '牛舍已經滿了',
  NOT_AT_STOVE: '要站在廚房前面才能做菜',
  TOO_LOW_LEVEL: '烹飪還不夠高，做不了這道菜',
  NO_DISH: '沒有這道料理',
  NO_HAY: '沒有乾草了（雜貨店有賣）',
  NO_ANIMAL: '雞舍裡還沒有動物',
  NO_COW: '牛舍裡還沒有牛',
  NO_BARN: '牛舍還沒改建，先到雜貨店找人改建',
  NOT_FED: '牛還沒吃飽，先去乾草槽餵牠',
  CARED_TODAY: '今天已經照顧過這頭牛了',
  NOT_AT_WORKSHOP: '要站在加工台前面才能加工',
  MACHINE_FULL: '加工機已經在忙，等有空位再來',
  NOTHING_READY: '加工機裡還沒有完成的成品',
  NOT_AT_WORKBENCH: '要站在工作台前面才能合成',
  LOCKED: '技能還不夠，還不會做這個',
  ALREADY_OWNED: '已經有了，不用再做一個',
  BAG_MAX: '木箱已經放滿了，背包不能再加了',
  OUT_OF_SEASON: '這裡的野菜還沒長出來',
  ALREADY_FERTILIZED: '這塊田已經施過肥了',
  NEED_SICKLE: '要先切到鐮刀才能割草',
  TALENT_LOCKED: '技能要到 5 級才能選天賦',
  TALENT_TAKEN: '這項技能已經選過天賦了',
  NO_TALENT: '沒有這個天賦',
  EVENT_PENDING: '先把眼前的對話看完',
  NOT_AT_RESIDENT: '要站在居民面前（面向他）才能送禮',
  ALREADY_GIFTED: '今天已經送過禮了，明天再來',
  NO_GIFT_ITEM: '背包裡沒有這樣東西',
  NO_OPTION: '沒有這個選項',
  NO_EVENT: '現在沒有進行中的對話',
  NO_QUEST: '沒有這個委託',
  ALREADY_ACCEPTED: '這個委託已經接了',
  ALREADY_DONE: '這個委託已經完成了',
  NOT_OFFERED: '這個委託還沒開放',
  NOT_ON_BOARD: '佈告欄上已經沒有這件委託了',
  NOT_ACTIVE: '這個委託還沒接',
  NOT_DELIVERY: '這個委託不用交付東西',
  NOT_FESTIVAL: '現在沒有這個節慶活動（要在節慶當天的鎮廣場）',
  NO_SWAP: '這位居民今天不跟你交換種子',
  NOT_PRESENT: '他現在不在廣場上',
  ALREADY_THIS_YEAR: '今年已經做過這件事了',
  STALL_CLOSED: '這個攤位只在節慶的夜晚開放',
  SOLD_OUT: '這項今年已經賣完了',
  NOT_STAR_TIME: '星星要等夜市開始、晚上才會出現在水池裡',
  NOT_AT_POOL: '要站在星星水池前面才能釣星星',
  NO_STAR_LINE: '還沒有甩竿，不能收網',
  NO_EXCHANGE: '沒有這項兌換',
  NOT_ENOUGH_SHARDS: '星河碎片不夠',
  EXCHANGE_LIMIT: '這項今年已經換過了',
  ALREADY_UNLOCKED: '這份配方已經解鎖過了',
  NOT_UNLOCKED: '還沒有這個配方，要先在夜市的星河兌換換到',
  NO_REPAIR: '沒有這項修復',
  REPAIR_CLOSED: '這項修復不在這個季節，等它的季節再來',
  REPAIR_DONE: '這項修復已經完成了，明年再來',
  NOT_REPAIR_ITEM: '這項修復不收這個東西',
  BAD_COUNT: '要捐至少一件',
  REPAIR_ENOUGH: '這一項已經捐夠了，換別的東西吧',
  ALREADY_LIT: '這盞燈今年已經點過了',
  NOT_IN_STOCK_SEASON: '雜貨店這個季節還沒進這批種子',
};

const NOTHING_HERE = '這裡沒有可以互動的東西';

function refused(reason: string): GameEvent {
  return { type: 'refused', reason };
}

function reply(state: GameState, messages: string[] = [], events: GameEvent[] = []): CommandOutcome {
  return { state, messages, events };
}

/**
 * 執行一個指令，然後檢查委託：目標已達到（好感、收成、出貨…）的委託在這裡自動完成，並把完成的訊息接在後面。
 * 最後觀察圖鑑與成就（發現條目、推進計數、發獎勵，見 application/collection.ts）。
 */
export function executeCommand(current: GameState, command: Command, index: ContentIndex): CommandOutcome {
  const outcome = executeCore(current, command, index);
  const settled = settleQuests(outcome.state, index);
  // 主線：步驟達成就發獎勵、推進章節（見 story.ts）。
  const story = settleStory(settled.state, index);
  const progressed = observeProgress(current, story.state, outcome.events, index);
  const extra = [...settled.messages, ...story.messages, ...progressed.messages];
  return { ...outcome, state: progressed.state, messages: [...outcome.messages, ...extra] };
}

function executeCore(current: GameState, command: Command, index: ContentIndex): CommandOutcome {
  // 心形事件還沒選完：只有選項能送出，其餘指令都擋下（畫面也會先顯示事件面板）。
  if (current.pendingHeartEvent && command.type !== 'chooseHeartOption') {
    return reply(current, [messageFor('EVENT_PENDING')], [refused('EVENT_PENDING')]);
  }
  // 魚只等一下：收線以外的任何動作都會把它放掉；星星同樣（收網以外的動作放掉）。
  const unhooked = command.type === 'reel' || !current.fishing ? current : { ...current, fishing: null };
  const state = command.type === 'catchStar' || !current.starLine ? unhooked : { ...unhooked, starLine: false };
  switch (command.type) {
    case 'festivalSwap':
      return festivalCommand(state, festivalSwap(state, command.npcId, index));
    case 'festivalCrown':
      return festivalCommand(state, festivalCrown(state, index));
    case 'starExchange':
      return festivalCommand(state, starExchange(state, command.lineId, index));
    case 'donate':
      return donateCommand(state, command, index);
    case 'castStar':
      return castStar(state, index);
    case 'catchStar':
      return catchStar(state, command.elapsedMs, index);
    case 'giveGift':
      return giveGift(state, command.npcId, command.itemId, index);
    case 'chooseHeartOption':
      return chooseHeartOption(state, command.optionId, index);
    case 'reel':
      return reel(state, command.hit, index);
    case 'cook':
      return cook(state, command.recipeId, index);
    case 'eat':
      return eat(state, command.itemId, index);
    case 'startProcessing':
      return startProcessing(state, command.recipeId, index);
    case 'collectProcessing':
      return collectProcessing(state, index);
    case 'craft':
      return craft(state, command.recipeId, index);
    case 'move':
      return move(state, command.direction, index);
    case 'interact':
      return interact(state, index);
    case 'takeTool':
      return reply({ ...state, tool: command.tool });
    case 'buy':
      return buy(state, command, index);
    case 'upgrade':
      return upgrade(state, command, index);
    case 'cycleTool': {
      const i = TOOL_ORDER.indexOf(state.tool);
      return reply({ ...state, tool: TOOL_ORDER[(i + 1) % TOOL_ORDER.length] ?? 'hoe' });
    }
    case 'cycleSeed': {
      const ids = index.cropIds();
      const i = ids.indexOf(state.selectedSeed);
      return reply({ ...state, selectedSeed: ids[(i + 1) % ids.length] ?? state.selectedSeed });
    }
    case 'chooseTalent':
      return chooseTalent(state, command.talentId, index);
    case 'acceptQuest':
      return acceptQuestCommand(state, command.questId, index);
    case 'submitQuest':
      return submitQuestCommand(state, command.questId, index);
    case 'manualSave':
      return reply(state, [], [{ type: 'saveRequested' }]);
  }
}

function move(state: GameState, direction: Direction, index: ContentIndex): CommandOutcome {
  const facing = { ...state.player, facing: direction };
  const map = index.map(state.mapId);
  const target = neighbor(state.player, direction);
  const tile = tileAt(map, target.x, target.y);
  const kind = kindAt(state, map, target.x, target.y);

  if (!tile || !kind || residentAt(state, index, target.x, target.y) || !isWalkable(kind)) {
    return reply({ ...state, player: facing });
  }

  const cleared = tile.kind === 'cave' && changeAt(state.worldChanges, state.mapId, target.x, target.y) === 'cleared';
  if (tile.to && (tile.kind === 'door' || tile.kind === 'stairs' || cleared)) {
    return enter(state, tile, direction, index);
  }

  return reply({ ...state, player: { x: target.x, y: target.y, facing: direction } });
}

/**
 * 走進門、樓梯或清開的洞口。礦坑的層是生成的：先生成再進去。
 * 從入口進礦坑時，會直接到最深的檢查點（見 mine.ts）；到了檢查點層，就記下來。
 */
function enter(state: GameState, tile: TileDef, direction: Direction, index: ContentIndex): CommandOutcome {
  // 門的解鎖條件（日期或旗標）不符時門是鎖著的：留在原地，顯示內容裡寫的 hint。
  if (tile.requires && !requirementMet(tile.requires, state.calendar, state.flags, index.tuning.time.daysPerSeason)) {
    return reply({ ...state, player: { ...state.player, facing: direction } }, [tile.requires.hint], [refused('LOCKED_DOOR')]);
  }
  let destinationId = tile.to ?? '';
  if (tile.kind === 'cave' && destinationId === mineId(1) && state.mineCheckpoint > 1) {
    destinationId = mineId(state.mineCheckpoint);
  }
  const layer = mineLayerOf(destinationId);
  if (layer !== null) index.ensureMine(layer, state.mineSeed);
  const destination = index.map(destinationId);
  const spawn = tile.spawn ?? destination.spawn;
  const mineCheckpoint = layer !== null && isCheckpoint(layer) ? Math.max(state.mineCheckpoint, layer) : state.mineCheckpoint;
  const entered: GameState = { ...state, mapId: destination.id, mineCheckpoint, player: { ...spawn, facing: direction } };
  // 委託的進度：拜訪這張地圖；進礦坑時也記下到了哪一層。
  const visited = recordQuestEvent(entered, { type: 'visit', mapId: destination.id }, index);
  const reached = layer !== null ? recordQuestEvent(visited, { type: 'mineLayer', layer }, index) : visited;
  return reply(reached, [], [{ type: 'enteredMap', mapId: destination.id }]);
}

function interact(state: GameState, index: ContentIndex): CommandOutcome {
  const map = index.map(state.mapId);
  const target = neighbor(state.player, state.player.facing);
  const resident = residentAt(state, index, target.x, target.y);
  if (resident) return talk(state, resident.npcId, index);

  const tile = tileAt(map, target.x, target.y);
  if (!tile) return reply(state, [NOTHING_HERE], [refused('NOTHING_HERE')]);
  const kind = effectiveKind(tile.kind, changeAt(state.worldChanges, state.mapId, target.x, target.y));

  if (tile.notice === 'bulletin') return openBulletin(state, index);
  if (tile.notice === 'mailbox') return collectMailbox(state, index);
  if (tile.notice === 'festival') return reply(state, [], [{ type: 'festivalOpened' }]);
  if (tile.notice === 'repair') return reply(state, [], [{ type: 'repairOpened' }]);
  if (tile.kind === 'rock' || tile.kind === 'ore') {
    if (kind === tile.kind) return mineRock(state, target, tile, index);
  }
  if (tile.festival === 'stars') return castStar(state, index);
  if (tile.festival === 'lantern') return festivalCommand(state, lightLantern(state, `${target.x},${target.y}`, index));
  if (tile.kind === 'water') return cast(state, target, index);
  if (tile.kind === 'trough') return feedAnimals(state, index);
  if (kind === 'kitchen') return reply(state, [], [{ type: 'kitchenOpened' }]);
  if (kind === 'workshop') return reply(state, [], [{ type: 'workshopOpened' }]);
  if (kind === 'workbench') return reply(state, [], [{ type: 'workbenchOpened' }]);
  if (tile.slot) return petAt(state, target, index);
  if (tile.kind === 'cave' && kind === 'cave') return openCave(state, target, index);
  if (kind === 'bed') return sleep(state, index);
  if (kind === 'shipbox') return shipAll(state, index);
  if (kind === 'cave') return reply(state, [messageFor('MINE_LOCKED')], [refused('MINE_LOCKED')]);
  if (kind === 'shop') return reply(state, [], [{ type: 'shopOpened', shopId: tile.shop ?? '' }]);
  if (tile.kind === 'forage') return forage(state, target, index);
  if (kind === 'tree') return chopTree(state, target, index);
  if (kind === 'tuft') return cutGrass(state, target, index);

  const key = plotKey(target.x, target.y);
  if (kind === 'field' || state.plots[key]) return workPlot(state, key, index);
  return reply(state, [NOTHING_HERE], [refused('NOTHING_HERE')]);
}

/**
 * 先執行純規則檢查，成功後才扣體力並前進時間。
 * 失敗時完全不改變狀態，也不耗時間。
 */
function spendThen(
  state: GameState,
  action: ActionKind,
  index: ContentIndex,
  apply: (s: GameState) => Result<GameState, string>,
  /** 體力與經驗預設依動作本身；鐮刀割草的體力沿用砍樹、經驗算採集。 */
  options: { cost?: number; xp?: ActionKind } = {},
): Result<GameState, string> {
  const applied = apply(state);
  if (!applied.ok) return applied;
  const energy = trySpend(state.energy, options.cost ?? actionCost(state, action, index));
  if (!energy.ok) return fail('NOT_ENOUGH_ENERGY');
  return ok({
    ...applied.value,
    energy: energy.value,
    skills: gainXp(applied.value.skills, options.xp ?? action, index),
    calendar: advanceMinutes(applied.value.calendar, index.tuning.time.minutesPerAction),
  });
}

function workPlot(state: GameState, key: string, index: ContentIndex): CommandOutcome {
  const plot = state.plots[key];
  const crop = plot?.crop;

  if (crop && isRipe(crop, index.crop(crop.cropId).growthDays)) {
    const cropDef = index.crop(crop.cropId);
    let yielded = 0;
    let quality: Quality = 'normal';
    let contestMessages: string[] = [];
    const result = spendThen(state, 'harvest', index, (s) => {
      const harvested = harvestPlot(s.plots, key, cropDef.growthDays);
      if (!harvested.ok) return fail(harvested.reason);
      const roll = rollInt(s.rng, index.tuning.harvest.min, index.tuning.harvest.max);
      const level = levelOf(s.skills.farming, index.tuning.skills.thresholds);
      const extra = rollExtraYield(roll.rng, extraYieldChance(s.talents, index.talents.defs, 'harvest') + eventYieldChance(s, index, 'harvest'));
      const count = roll.value + bonusYield(level, index.tuning.skills) + extra.value;
      const q = rollInt(extra.rng, 0, 999);
      // 居民喜歡這種作物、而且好感夠：品質的隨機數往好的方向移（見 friendship.ts 的 favorQualityBonus）。
      const favor = favorQualityBonus(cropItemId(cropDef.id), index.npcs, s.friendship, index.friendship);
      quality = qualityFor(level, Math.max(0, q.value / 1000 - favor), fertilizedSkillTuning(index.tuning.skills, plot?.fertilizer, index.tuning.fertilizer));
      const stored = addItem(s.inventory, index.item(cropItemId(harvested.value.cropId)), count, quality);
      if (!stored.ok) return fail(stored.reason);
      yielded = count;
      const harvestedState: GameState = { ...s, plots: harvested.value.plots, inventory: stored.value, rng: q.rng };
      const quest = recordQuestEvent(harvestedState, { type: 'harvest', cropId: cropDef.id }, index);
      // 豐穗祭的收成比賽：節慶當天收成指定的作物才計數（見 application/festival.ts）。
      const contest = recordHarvestContest(quest, cropDef.id, count, index);
      contestMessages = contest.messages;
      return ok(contest.state);
    });
    const label = QUALITY_LABEL[quality];
    const out = finish(state, result, `收成了 ${cropDef.name}${label} × ${yielded}`, { action: 'harvest', key });
    return contestMessages.length > 0 ? { ...out, messages: [...out.messages, ...contestMessages] } : out;
  }

  if (state.tool === 'hoe') {
    const result = spendThen(state, 'till', index, (s) => {
      const tilled = tillPlot(s.plots, key);
      // 主線的步驟「開墾一塊田」看這個旗標（見 content/main-quest.json）。
      return tilled.ok ? ok({ ...s, plots: tilled.value, flags: { ...s.flags, 'done:till': true } }) : fail(tilled.reason);
    });
    return finish(state, result, '開墾了一塊田', { action: 'till', key });
  }

  if (!plot) return reply(state, [messageFor('NO_SOIL')], [refused('NO_SOIL')]);

  if (state.tool === 'can') {
    const result = spendThen(state, 'water', index, (s) => {
      const watered = waterPlot(s.plots, key);
      return watered.ok ? ok({ ...s, plots: watered.value }) : fail(watered.reason);
    });
    return finish(state, result, '澆了水', { action: 'water', key });
  }

  if (plot?.crop && state.tool === 'seedbag') return fertilize(state, key, index);

  const seedName = index.crop(state.selectedSeed).name;
  const result = spendThen(state, 'plant', index, (s) => {
    // 溫室裡的田不受季節限制（見 domain/greenhouse.ts）；溫室外只能在作物的季節種。
    if (!plantableIn(index.crop(s.selectedSeed).seasons, s.calendar.season, index.greenhouse.has(key))) return fail('NOT_IN_SEASON');
    const seeds = removeItem(s.inventory, seedItemId(s.selectedSeed), 1);
    if (!seeds.ok) return fail('NO_SEED');
    const planted = plantCrop(s.plots, key, s.selectedSeed);
    if (!planted.ok) return fail(planted.reason);
    return ok({ ...s, inventory: seeds.value, plots: planted.value });
  });
  return finish(state, result, `播下了 ${seedName} 種子`, { action: 'plant', key });
}

/**
 * 用種子袋對著已種的田：袋裡有肥料就施肥（每塊田一次，優先用優良肥料）。施肥與播種耗同樣的體力。
 * 沒有肥料時，和以前一樣回報「已經種了作物」。
 */
function fertilize(state: GameState, key: string, index: ContentIndex): CommandOutcome {
  const kind = (['fine', 'basic'] as const).find((k) => countOf(state.inventory, `fertilizer-${k}`) > 0);
  if (!kind) return reply(state, [messageFor('ALREADY_PLANTED')], [refused('ALREADY_PLANTED')]);
  if (state.plots[key]?.fertilizer) return reply(state, [messageFor('ALREADY_FERTILIZED')], [refused('ALREADY_FERTILIZED')]);
  const result = spendThen(state, 'plant', index, (s) => {
    const taken = removeItem(s.inventory, `fertilizer-${kind}`, 1);
    if (!taken.ok) return fail(taken.reason);
    const plot = s.plots[key];
    if (!plot) return fail('NO_SOIL');
    return ok({ ...s, inventory: taken.value, plots: { ...s.plots, [key]: { ...plot, fertilizer: kind } } });
  });
  return finish(state, result, `施了${kind === 'fine' ? '優良' : '普通'}肥料`, { action: 'plant', key });
}

/** 成功才發出 acted 事件，失敗只回傳原因，狀態與時間都不變。 */
function finish(
  state: GameState,
  result: Result<GameState, string>,
  successMessage: string,
  feedback?: { action: ActionFeedback; key: string },
): CommandOutcome {
  if (!result.ok) return reply(state, [messageFor(result.reason)], [refused(result.reason)]);
  const events: GameEvent[] = [];
  if (feedback) {
    const [x, y] = feedback.key.split(',').map(Number);
    events.push({ type: 'acted', action: feedback.action, x: x ?? 0, y: y ?? 0 });
  }
  return reply(result.value, [successMessage], events);
}

/** 失敗代碼的說明文字（節慶面板也用它說明按鈕為什麼不能按）。 */
export function messageFor(reason: string): string {
  return FAILURE_MESSAGES[reason] ?? reason;
}

function shipAll(state: GameState, index: ContentIndex): CommandOutcome {
  const { inventory, taken } = takeMatching(state.inventory, (stack) => index.item(stack.itemId).sellPrice !== undefined);
  if (taken.length === 0) return reply(state, ['背包裡沒有可出貨的作物'], [refused('NO_SHIPPABLE')]);

  const result = spendThen(state, 'ship', index, (s) => {
    let box = s.shipBox;
    for (const stack of taken) box = shipStack(box, stack);
    // 主線的步驟「把作物放進出貨箱」看這個旗標。
    let next: GameState = { ...s, inventory, shipBox: box, flags: { ...s.flags, 'done:ship': true } };
    for (const stack of taken) next = recordQuestEvent(next, { type: 'ship', itemId: stack.itemId, count: stack.count }, index);
    return ok(next);
  });
  const box = neighbor(state.player, state.player.facing);
  return finish(state, result, '把作物放進了出貨箱', { action: 'ship', key: `${box.x},${box.y}` });
}

/**
 * 說話：每天第一次說話加好感；第一次說話會說完全部台詞並領禮物；好感條件符合時開始心形事件（見 heart-events.ts）。
 * 背包放不下禮物時不標記「已對話」，也不加好感，讓玩家整理後還能領到禮物。
 */
function talk(state: GameState, npcId: string, index: ContentIndex): CommandOutcome {
  const npc = index.npc(npcId);
  const firstTime = !state.flags[`talked:${npc.id}`];
  const talkedEvent = (gifted: boolean): GameEvent[] => [{ type: 'talked', npcId: npc.id, first: firstTime, gifted }];

  let next: GameState = dailyTalkPoints(state, npc.id, index);
  const messages = firstTime ? [...npc.lines] : [npc.lines.at(-1) ?? ''];
  let gifted = false;
  if (firstTime) {
    next = { ...next, flags: { ...next.flags, [`talked:${npc.id}`]: true } };
    if (npc.gift) {
      const seed = index.item(seedItemId(npc.gift.cropId));
      const stored = addItem(next.inventory, seed, npc.gift.count);
      if (!stored.ok) return reply(state, [...messages, '背包已滿，先整理一下再來領禮物'], talkedEvent(false));
      next = { ...next, inventory: stored.value };
      messages.push(`獲得 ${seed.name} × ${npc.gift.count}`);
      gifted = true;
    }
  }

  const hearts = heartsOf(next.friendship[npc.id]?.points ?? 0, index.friendship);
  const event = readyHeartEvent(index.heartEvents, npc.id, {
    hearts,
    mapId: next.mapId,
    period: currentPeriod(next, index),
    triggered: next.heartEvents,
  });
  if (!event) return reply(next, messages, talkedEvent(gifted));
  const pending: GameState = { ...next, heartEvents: [...next.heartEvents, event.id], pendingHeartEvent: event.id };
  return reply(pending, messages, [...talkedEvent(gifted), { type: 'heartEvent', npcId: npc.id, eventId: event.id, emote: event.emote }]);
}

/** 每天第一次說話加好感（今天已經說過就不加）。 */
function dailyTalkPoints(state: GameState, npcId: string, index: ContentIndex): GameState {
  const today = totalDay(state.calendar, index.tuning.time.daysPerSeason);
  const current = state.friendship[npcId] ?? NO_FRIENDSHIP;
  if (current.talkedDay === today) return state;
  const points = addPoints(current.points, index.friendship.talkPoints, capPointsOf(state, index));
  return withFriendship(state, npcId, { ...current, points, talkedDay: today });
}

/** 目前日子的好感上限（點數）；春夏是 4 顆心，之後開放（見 friendship.ts）。 */
function capPointsOf(state: GameState, index: ContentIndex): number {
  return heartCapPoints(index.friendship, index.tuning.time.daysPerSeason, totalDay(state.calendar, index.tuning.time.daysPerSeason));
}

function withFriendship(state: GameState, npcId: string, record: Friendship): GameState {
  return { ...state, friendship: { ...state.friendship, [npcId]: record } };
}

const REACTION_LINE: Record<GiftReaction, (who: string, item: string) => string> = {
  love: (who, item) => `${who}眼睛一亮，很喜歡${item}。`,
  neutral: (who, item) => `${who}收下了${item}。`,
  hate: (who, item) => `${who}皺了皺眉，勉強收下了${item}。`,
};

/**
 * 送禮：要站在居民面前（面向他）；每天對同一人只能送一次；送出的東西從背包拿走。
 * 喜歡的東西好感加得多，討厭的東西會扣好感（不低於 0）。不花體力與時間。
 */
function giveGift(state: GameState, npcId: string, itemId: string, index: ContentIndex): CommandOutcome {
  const target = neighbor(state.player, state.player.facing);
  if (residentAt(state, index, target.x, target.y)?.npcId !== npcId) {
    return reply(state, [messageFor('NOT_AT_RESIDENT')], [refused('NOT_AT_RESIDENT')]);
  }
  const npc = index.npc(npcId);
  const today = totalDay(state.calendar, index.tuning.time.daysPerSeason);
  const current = state.friendship[npcId] ?? NO_FRIENDSHIP;
  // 暖燈節的交換禮物：當晚的指定居民不受每日一次限制（今年有次數就算），見 application/festival.ts。
  const warm = warmGiftOpen(state, index, npcId);
  if (!warm && current.giftedDay === today) return reply(state, [messageFor('ALREADY_GIFTED')], [refused('ALREADY_GIFTED')]);
  const taken = removeItem(state.inventory, itemId, 1);
  if (!taken.ok) return reply(state, [messageFor('NO_GIFT_ITEM')], [refused('NO_GIFT_ITEM')]);
  const giftRules = warm ? festivalHere(state, index)?.giftExchange : undefined;
  let inventory = taken.value;
  if (giftRules) {
    const back = addItem(inventory, index.item(giftRules.receive.itemId), giftRules.receive.count);
    if (!back.ok) return reply(state, [messageFor('BAG_FULL')], [refused('BAG_FULL')]);
    inventory = back.value;
  }

  const reaction = giftReaction(itemId, npc.loves, npc.hates);
  const delta = giftPoints(reaction, index.friendship);
  const points = addPoints(current.points, delta, capPointsOf(state, index));
  // 暖燈禮物不記在「今天送過禮」上，所以同一天還能再送一般的禮。
  const record = giftRules ? { ...current, points } : { ...current, points, giftedDay: today };
  let next = withFriendship({ ...state, inventory }, npcId, record);
  const messages = [`${REACTION_LINE[reaction](npc.name, index.item(itemId).name)}（好感 ${delta > 0 ? '+' : ''}${delta}）`];
  if (giftRules) {
    next = recordWarmGift(next);
    messages.push(`${npc.name}回了你${index.item(giftRules.receive.itemId).name} × ${giftRules.receive.count}`);
  }
  return reply(next, messages, [{ type: 'gifted', npcId, reaction }]);
}

/** 心形事件的選項：好感依選項變化，事件結束（之後的指令恢復正常）。 */
function chooseHeartOption(state: GameState, optionId: string, index: ContentIndex): CommandOutcome {
  const eventId = state.pendingHeartEvent;
  if (!eventId) return reply(state, [messageFor('NO_EVENT')], [refused('NO_EVENT')]);
  const event = index.heartEvent(eventId);
  const option = event.options.find((o) => o.id === optionId);
  if (!option) return reply(state, [messageFor('NO_OPTION')], [refused('NO_OPTION')]);
  const current = state.friendship[event.npcId] ?? NO_FRIENDSHIP;
  const points = addPoints(current.points, option.points, capPointsOf(state, index));
  const next = withFriendship({ ...state, pendingHeartEvent: null }, event.npcId, { ...current, points });
  return reply(next, [option.reply]);
}

function sleep(today: GameState, index: ContentIndex): CommandOutcome {
  // 夜間的隨機事件（例如流星）在睡前入袋。
  const night = endOfDay(today, index);
  const state = night.state;
  // 今天的天氣決定田地要不要澆水（雨與暴風雨），然後才結算作物生長。
  const watered = waters(state.weather) || state.flags.sprinkler ? waterAllPlots(state.plots) : state.plots;
  const growth = growCrops(watered, (id) => index.crop(id).growthDays);
  const morning = nextMorning(state.calendar, index.tuning.time.wakeMinute, index.tuning.time.daysPerSeason);
  const { calendar } = morning;

  // 換季：不在新季節適種的作物枯死。
  const plots: PlotMap = { ...growth.plots };
  const outOfSeason: string[] = [];
  if (morning.seasonChanged) {
    for (const [key, plot] of Object.entries(plots)) {
      // 溫室裡的作物不因換季枯死（見 domain/greenhouse.ts）。
      if (!plot.crop || survivesSeasonChange(index.crop(plot.crop.cropId).seasons, calendar.season, index.greenhouse.has(key))) continue;
      outOfSeason.push(index.crop(plot.crop.cropId).name);
      plots[key] = { watered: false, crop: null, dryDays: 0 };
    }
  }

  // 明天的天氣：今天的預報變成今天的天氣，再為新的一天抽一個新的預報。
  // 睡前每隻餵飽的動物下一顆蛋；之後的天氣預報接著用同一串隨機數。
  const laid = layEggs(state, index);
  const forecast = rollWeather(index.weather, calendar.season, laid.rng);
  const processing = passDays(state.processing);
  // 售價：品質倍率之後，再加上已選天賦的售價加成（依物品種類，見 talents.ts）。
  const settled = settleShipBox(state.shipBox, (itemId, quality) => {
    const item = index.item(itemId);
    const bonus = sellBonusPercent(state.talents, index.talents.defs, item.kind);
    return applySellBonus(priceWithQuality(item.sellPrice ?? 0, quality), bonus);
  });
  const wakeUp: GameState = {
    ...state,
    calendar,
    worldChanges: clearDaily(state.worldChanges),
    weather: state.forecast,
    forecast: forecast.value,
    rng: forecast.rng,
    plots,
    inventory: laid.inventory,
    animals: laid.animals,
    cows: dailyCare(state.cows),
    processing,
    gold: state.gold + settled.gold,
    shipBox: settled.box,
    energy: restore(state.energy),
  };
  // 早上：到期的居民來信送進信箱，佈告欄換成今天的委託。
  const delivered = deliverLetters(wakeUp, index);
  // 新的一天的隨機事件：白天的物品在這裡入袋，事件的文字告訴玩家（見 random-events.ts）。
  const day = startDay(refreshBoard(delivered.state, index), index);
  const next = day.state;
  const messages = [`你睡了一覺。${dateLabel(calendar)} ${formatClock(calendar)}`, ...night.messages];
  const festival = festivalOnDay(index.festivals, calendar);
  if (festival) messages.push(`今天是${festival.name}！到${index.map(festival.mapId).name}看看吧。`);
  messages.push(...day.messages);
  if (morning.seasonChanged) messages.push(`季節換了，現在是${SEASON_LABEL[calendar.season]}天`);
  if (delivered.arrived.length > 0) messages.push(`信箱收到 ${delivered.arrived.length} 封信，到信箱取信`);
  if (settled.gold > 0) messages.push(`出貨箱結算 +${settled.gold} 金`);
  if (laid.count > 0) messages.push(`雞下了 ${laid.count} 顆蛋`);
  const finished = takeReady(processing).ready.length;
  if (finished > 0) messages.push(`加工機裡有 ${finished} 批完成了，到加工台取回`);
  if (laid.lost > 0) messages.push(`背包放不下，${laid.lost} 顆蛋壞掉了`);
  if (growth.withered.length > 0) {
    const names = growth.withered.map((id) => index.crop(id).name).join('、');
    messages.push(`缺水，${names} 枯死了`);
  }
  if (outOfSeason.length > 0) messages.push(`換季了，${outOfSeason.join('、')} 不適合這個季節，枯死了`);
  const objective = storyObjective(next, index);
  if (objective) messages.push(objective);
  messages.push(`明天天氣：${WEATHER_NAMES[next.forecast]}`);
  return reply(next, messages, [{ type: 'slept' }]);
}

const SEASON_LABEL = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' } as const;

/** 目前地圖上某格的樣子：玩家造成的變化（砍樹、採野薄荷）會蓋過地圖本身。 */
function kindAt(state: GameState, map: MapDef, x: number, y: number): TileKind | null {
  const tile = tileAt(map, x, y);
  if (!tile) return null;
  return effectiveKind(tile.kind, changeAt(state.worldChanges, state.mapId, x, y));
}

/** 動作的體力消耗：由負責的工具階級決定（階級越高越省）。 */
function actionCost(state: GameState, action: ActionKind, index: ContentIndex): number {
  const base = index.tuning.energy.costs[action];
  const tool = toolForAction(action);
  if (!tool) return base;
  return energyCostFor(base, state.toolTiers[tool], index.tuning.tools.tiers);
}

/**
 * 投竿：扣體力、累積釣魚經驗。湖裡有當季的魚時，有機會上鉤；上鉤的魚記在狀態裡，等玩家收線。
 * 機率與魚種都由隨機數決定，同一個狀態永遠得到同一個結果。
 */
function cast(state: GameState, target: Point, index: ContentIndex): CommandOutcome {
  if (state.tool !== 'rod') return reply(state, [messageFor('NEED_ROD')], [refused('NEED_ROD')]);
  const energy = trySpend(state.energy, actionCost(state, 'fish', index));
  if (!energy.ok) return reply(state, [messageFor('NOT_ENOUGH_ENERGY')], [refused('NOT_ENOUGH_ENERGY')]);

  const bite = rollInt(state.rng, 0, 99);
  let rng = bite.rng;
  const available = index.fish.filter((f) => f.seasons.includes(state.calendar.season));
  let fishing: GameState['fishing'] = null;
  let messages = ['魚沒有上鉤'];
  const events: GameEvent[] = [{ type: 'acted', action: 'fish', x: target.x, y: target.y }];
  const baitInBag = countOf(state.inventory, 'bait') > 0;
  const baitLeft = baitInBag ? removeItem(state.inventory, 'bait', 1) : null;
  const chance = Math.min(100, biteChanceFor(index.tuning.fishing, { bobber: state.flags.bobber === true, bait: baitInBag }) + biteBonusPoints(state.talents, index.talents.defs) + eventBitePoints(state, index));
  if (bite.value < chance && available.length > 0) {
    const total = available.reduce((sum, f) => sum + f.weight, 0);
    const pick = rollInt(rng, 1, total);
    rng = pick.rng;
    let left = pick.value;
    const chosen = available.find((f) => (left -= f.weight) <= 0) ?? available[available.length - 1];
    if (chosen) {
      fishing = { fishId: chosen.id };
      messages = ['魚上鉤了！'];
      events.push({ type: 'bite' });
    }
  }
  const next: GameState = {
    ...state,
    energy: energy.value,
    calendar: advanceMinutes(state.calendar, index.tuning.time.minutesPerAction),
    skills: gainXp(state.skills, 'fish', index),
    rng,
    fishing,
    inventory: baitLeft?.ok ? baitLeft.value : state.inventory,
  };
  return reply(next, messages, events);
}

/** 收線：有魚上鉤才有效；在時限內按到（hit）就釣到魚，否則魚跑掉了。節慶的釣魚比賽在這裡計數。 */
function reel(state: GameState, hit: boolean, index: ContentIndex): CommandOutcome {
  if (!state.fishing) return reply(state, [messageFor('NO_BITE')], [refused('NO_BITE')]);
  const fishId = state.fishing.fishId;
  const cleared: GameState = { ...state, fishing: null };
  if (!hit) return reply(cleared, ['魚跑掉了']);
  const stored = addItem(cleared.inventory, index.item(`fish.${fishId}`), 1);
  if (!stored.ok) return reply(cleared, [messageFor('BAG_FULL')], [refused('BAG_FULL')]);
  const caught = recordQuestEvent({ ...cleared, inventory: stored.value }, { type: 'fish', fishId }, index);
  const contest = recordContestCatch(caught, index);
  return reply(contest.state, [`釣到了${index.item(`fish.${fishId}`).name}`, ...contest.messages]);
}

/** 節慶的指令結果：失敗只回傳原因（狀態不變），成功套用新狀態與訊息。 */
function festivalCommand(state: GameState, result: Result<FestivalOutcome, string>): CommandOutcome {
  if (!result.ok) return reply(state, [messageFor(result.reason)], [refused(result.reason)]);
  return reply(result.value.state, result.value.messages);
}

/**
 * 夜釣星星甩竿：站在節慶水池前（tile.festival 為 stars）、星河夜市正在鎮廣場開著。
 * 耗的體力與時間與釣魚相同（沒有額外成本）。甩竿後畫面等玩家按 X，再送出 catchStar。
 */
function castStar(state: GameState, index: ContentIndex): CommandOutcome {
  const target = neighbor(state.player, state.player.facing);
  const tile = tileAt(index.map(state.mapId), target.x, target.y);
  if (tile?.festival !== 'stars') return reply(state, [messageFor('NOT_AT_POOL')], [refused('NOT_AT_POOL')]);
  if (!festivalHere(state, index)?.stars) return reply(state, [messageFor('NOT_STAR_TIME')], [refused('NOT_STAR_TIME')]);
  const energy = trySpend(state.energy, actionCost(state, 'fish', index));
  if (!energy.ok) return reply(state, [messageFor('NOT_ENOUGH_ENERGY')], [refused('NOT_ENOUGH_ENERGY')]);
  const next: GameState = {
    ...state,
    energy: energy.value,
    calendar: advanceMinutes(state.calendar, index.tuning.time.minutesPerAction),
    skills: gainXp(state.skills, 'fish', index),
    starLine: true,
  };
  return reply(next, ['星星在水面上閃了一下，等它經過時按 X 收網'], [{ type: 'starLine' }]);
}

/**
 * 星星收網：時機由 star-fishing.ts 的純函式判斷（elapsedMs 為 null 表示沒按，沒接到）。
 * 接到的星河碎片放進背包；不論接到與否，收網後這條線就結束了。
 */
function catchStar(state: GameState, elapsedMs: number | null, index: ContentIndex): CommandOutcome {
  if (!state.starLine) return reply(state, [messageFor('NO_STAR_LINE')], [refused('NO_STAR_LINE')]);
  const cleared: GameState = { ...state, starLine: false };
  const rules = index.festivals.find((f) => f.stars)?.stars;
  if (!rules) return reply(cleared, [messageFor('NOT_STAR_TIME')], [refused('NOT_STAR_TIME')]);
  if (!starCatchHit(elapsedMs, { cycleMs: rules.cycleMs, zone: rules.zone })) return reply(cleared, ['星星溜走了']);
  const stored = addItem(cleared.inventory, index.item(rules.itemId), 1);
  if (!stored.ok) return reply(cleared, [messageFor('BAG_FULL')], [refused('BAG_FULL')]);
  return reply({ ...cleared, inventory: stored.value }, [`接到了一顆${index.item(rules.itemId).name}！`]);
}

/**
 * 用鎬敲石頭或礦石：得到石頭或礦石（礦石的物品由地圖的符號決定，預設銅礦石），那一格變成路。
 * 礦石的產量：深層礦石在 mine.json 指定；沒有指定或是銅礦石時用 tuning.gathering.ore。
 */
function mineRock(state: GameState, target: Point, tile: TileDef, index: ContentIndex): CommandOutcome {
  if (state.tool !== 'pick') return reply(state, [messageFor('NEED_PICK')], [refused('NEED_PICK')]);
  const isOre = tile.kind === 'ore';
  const itemId = isOre ? (tile.item ?? 'copper-ore') : 'stone';
  const range = isOre ? (index.mine.ores.find((ore) => ore.item === itemId)?.yield ?? index.tuning.gathering.ore) : index.tuning.gathering.stone;
  let yielded = 0;
  const result = spendThen(state, 'mine', index, (s) => {
    const roll = rollInt(s.rng, range.min, range.max);
    const bonus = isOre ? bonusYield(levelOf(s.skills.mining, index.tuning.skills.thresholds), index.tuning.skills) : 0;
    const extra = rollExtraYield(roll.rng, extraYieldChance(s.talents, index.talents.defs, 'mine', itemId) + eventYieldChance(s, index, 'mine'));
    const count = roll.value + bonus + extra.value;
    const stored = addItem(s.inventory, index.item(itemId), count);
    if (!stored.ok) return fail(stored.reason);
    yielded = count;
    const worldChanges = withChange(s.worldChanges, s.mapId, target.x, target.y, 'mined');
    return ok({ ...s, inventory: stored.value, rng: extra.rng, worldChanges });
  });
  return finish(state, result, `敲下了 ${yielded} 個${index.item(itemId).name}`, { action: 'mine', key: plotKey(target.x, target.y) });
}

/** 用鎬清開礦坑入口的落石：洞口通了，之後走進去就是第 1 層。 */
function openCave(state: GameState, target: Point, index: ContentIndex): CommandOutcome {
  if (state.tool !== 'pick') return reply(state, [messageFor('MINE_LOCKED')], [refused('MINE_LOCKED')]);
  const result = spendThen(state, 'mine', index, (s) =>
    ok({ ...s, worldChanges: withChange(s.worldChanges, s.mapId, target.x, target.y, 'cleared') }),
  );
  return finish(state, result, '清開了落石，洞口通了', { action: 'mine', key: plotKey(target.x, target.y) });
}

function chopTree(state: GameState, target: Point, index: ContentIndex): CommandOutcome {
  if (state.tool !== 'axe') return reply(state, [messageFor('NEED_AXE')], [refused('NEED_AXE')]);
  let yielded = 0;
  const result = spendThen(state, 'chop', index, (s) => {
    const roll = rollInt(s.rng, index.tuning.gathering.wood.min, index.tuning.gathering.wood.max);
    const extra = rollExtraYield(roll.rng, extraYieldChance(s.talents, index.talents.defs, 'chop') + eventYieldChance(s, index, 'chop'));
    const count = roll.value + bonusYield(levelOf(s.skills.foraging, index.tuning.skills.thresholds), index.tuning.skills) + extra.value;
    const stored = addItem(s.inventory, index.item('wood'), count);
    if (!stored.ok) return fail(stored.reason);
    yielded = count;
    const worldChanges = withChange(s.worldChanges, s.mapId, target.x, target.y, 'chopped');
    return ok({ ...s, inventory: stored.value, rng: extra.rng, worldChanges });
  });
  return finish(state, result, `砍下了 ${yielded} 根木材`, { action: 'chop', key: plotKey(target.x, target.y) });
}

function forage(state: GameState, target: Point, index: ContentIndex): CommandOutcome {
  if (changeAt(state.worldChanges, state.mapId, target.x, target.y) === 'picked') {
    return reply(state, [messageFor('ALREADY_PICKED')], [refused('ALREADY_PICKED')]);
  }
  const tile = tileAt(index.map(state.mapId), target.x, target.y);
  if (tile?.seasons && !tile.seasons.includes(state.calendar.season)) {
    return reply(state, [messageFor('OUT_OF_SEASON')], [refused('OUT_OF_SEASON')]);
  }
  const itemId = tile?.item ?? 'mint';
  let yielded = 0;
  const result = spendThen(state, 'forage', index, (s) => {
    const roll = rollInt(s.rng, index.tuning.gathering.forage.min, index.tuning.gathering.forage.max);
    const extra = rollExtraYield(roll.rng, extraYieldChance(s.talents, index.talents.defs, 'forage', itemId) + eventYieldChance(s, index, 'forage'));
    const count = roll.value + extra.value;
    const stored = addItem(s.inventory, index.item(itemId), count);
    if (!stored.ok) return fail(stored.reason);
    yielded = count;
    const worldChanges = withChange(s.worldChanges, s.mapId, target.x, target.y, 'picked');
    return ok({ ...s, inventory: stored.value, rng: extra.rng, worldChanges });
  });
  return finish(state, result, `採到了 ${yielded} 個${index.item(itemId).name}`, { action: 'forage', key: plotKey(target.x, target.y) });
}

/**
 * 用鐮刀割草叢：得到乾草，草叢變成草地（永久，不像野薄荷隔日恢復）。
 * 體力沿用砍樹的消耗（chop），由鐮刀的階級打折；經驗算在採集上。沒有鐮刀時不動作。
 */
function cutGrass(state: GameState, target: Point, index: ContentIndex): CommandOutcome {
  if (state.tool !== 'sickle') return reply(state, [messageFor('NEED_SICKLE')], [refused('NEED_SICKLE')]);
  const cost = energyCostFor(index.tuning.energy.costs.chop, state.toolTiers.sickle, index.tuning.tools.tiers);
  let yielded = 0;
  const result = spendThen(
    state,
    'forage',
    index,
    (s) => {
      const roll = rollInt(s.rng, index.tuning.gathering.forage.min, index.tuning.gathering.forage.max);
      const stored = addItem(s.inventory, index.item('hay'), roll.value);
      if (!stored.ok) return fail(stored.reason);
      yielded = roll.value;
      const worldChanges = withChange(s.worldChanges, s.mapId, target.x, target.y, 'cut');
      return ok({ ...s, inventory: stored.value, rng: roll.rng, worldChanges });
    },
    { cost, xp: 'forage' },
  );
  return finish(state, result, `割下了 ${yielded} 把乾草`, { action: 'forage', key: plotKey(target.x, target.y) });
}

/**
 * 選天賦：技能要到解鎖等級、而且這項技能還沒選過才能選。失敗時只回傳原因，不改狀態、不花體力。
 */
function chooseTalent(state: GameState, talentId: string, index: ContentIndex): CommandOutcome {
  const def = index.talents.defs.find((t) => t.id === talentId);
  if (!def) return reply(state, [messageFor('NO_TALENT')], [refused('NO_TALENT')]);
  const level = levelOf(state.skills[def.skill], index.tuning.skills.thresholds);
  if (level < index.talents.unlockLevel) return reply(state, [messageFor('TALENT_LOCKED')], [refused('TALENT_LOCKED')]);
  if (state.talents[def.skill] !== undefined) return reply(state, [messageFor('TALENT_TAKEN')], [refused('TALENT_TAKEN')]);
  return reply({ ...state, talents: { ...state.talents, [def.skill]: def.id } }, [`選定了天賦「${def.name}」`]);
}

/** 玩家是否面向指定商店的櫃檯。 */
function facingShop(state: GameState, index: ContentIndex, shopId: string): boolean {
  const map = index.map(state.mapId);
  const target = neighbor(state.player, state.player.facing);
  const tile = tileAt(map, target.x, target.y);
  return tile?.kind === 'shop' && tile.shop === shopId;
}

function buy(state: GameState, command: Extract<Command, { type: 'buy' }>, index: ContentIndex): CommandOutcome {
  if (!facingShop(state, index, command.shopId)) return reply(state, [messageFor('NOT_AT_SHOP')], [refused('NOT_AT_SHOP')]);
  const line = index.shop(command.shopId).stock.find((s) => s.itemId === command.itemId);
  if (!line) return reply(state, [messageFor('NOT_SOLD')], [refused('NOT_SOLD')]);
  // 季節進貨：秋季的種子只在秋天賣（shops.json 的 seasons）。
  if (line.seasons && !line.seasons.includes(state.calendar.season)) {
    return reply(state, [messageFor('NOT_IN_STOCK_SEASON')], [refused('NOT_IN_STOCK_SEASON')]);
  }
  // 節慶攤位：只在節慶開著時能買，有限量的物品不能超過今年的數量（見 festival.ts）。
  const closed = stallRefusal(state, index, command.shopId, command.itemId, command.count);
  if (closed) return reply(state, [messageFor(closed)], [refused(closed)]);
  const cost = line.price * command.count;
  if (state.gold < cost) return reply(state, [messageFor('NO_GOLD')], [refused('NO_GOLD')]);
  if (command.itemId.startsWith('animal.')) return buyAnimal(state, command.itemId.slice('animal.'.length), cost, command.count, index);
  if (command.itemId.startsWith('building.')) return remodel(state, command.itemId, cost, command.count, index);
  const stored = addItem(state.inventory, index.item(command.itemId), command.count);
  if (!stored.ok) return reply(state, [messageFor('BAG_FULL')], [refused('BAG_FULL')]);
  const name = index.item(command.itemId).name;
  const sold = recordStallSale(state, index, command.shopId, command.itemId, command.count);
  return reply({ ...sold, gold: state.gold - cost, inventory: stored.value }, [`買了 ${name} × ${command.count}，花了 ${cost} 金`]);
}

function upgrade(state: GameState, command: Extract<Command, { type: 'upgrade' }>, index: ContentIndex): CommandOutcome {
  if (!facingShop(state, index, command.shopId)) return reply(state, [messageFor('NOT_AT_SHOP')], [refused('NOT_AT_SHOP')]);
  const tiers = index.tuning.tools.tiers;
  const next = state.toolTiers[command.toolId] + 1;
  if (next >= tiers.length) return reply(state, [messageFor('TIER_MAX')], [refused('TIER_MAX')]);
  const recipe = index.shop(command.shopId).upgrades.find((u) => u.toolId === command.toolId && u.tier === next);
  if (!recipe) return reply(state, [messageFor('NOT_FOR_SALE')], [refused('NOT_FOR_SALE')]);
  if (state.gold < recipe.gold) return reply(state, [messageFor('NO_GOLD')], [refused('NO_GOLD')]);

  const missing: string[] = [];
  for (const [itemId, count] of Object.entries(recipe.items)) {
    const have = countOf(state.inventory, itemId);
    if (have < count) missing.push(`${index.item(itemId).name} × ${count - have}`);
  }
  if (missing.length > 0) {
    return reply(state, [`${messageFor('NO_MATERIAL')}：還差 ${missing.join('、')}`], [refused('NO_MATERIAL')]);
  }

  let inventory = state.inventory;
  for (const [itemId, count] of Object.entries(recipe.items)) {
    const taken = removeItem(inventory, itemId, count);
    if (!taken.ok) return reply(state, [messageFor('NO_MATERIAL')], [refused('NO_MATERIAL')]);
    inventory = taken.value;
  }
  const upgraded: GameState = {
    ...state,
    gold: state.gold - recipe.gold,
    inventory,
    toolTiers: { ...state.toolTiers, [command.toolId]: next },
  };
  return reply(upgraded, [`${TOOL_NAMES[command.toolId]}升級到${TIER_NAMES[next]}級`]);
}

const QUALITY_LABEL: Record<Quality, string> = { normal: '', good: '（優良）', fine: '（精良）' };

/** 動作的經驗加到對應的技能上（沒有技能的動作不加）。 */
function gainXp(skills: SkillXp, action: ActionKind, index: ContentIndex): SkillXp {
  const skill: SkillId | null = skillOfAction(action);
  const amount = index.tuning.skills.xp[action] ?? 0;
  if (!skill || amount === 0) return skills;
  return { ...skills, [skill]: skills[skill] + amount };
}

/** 雞舍在地圖 coop 上、牛舍在地圖 cowbarn 上；座位數就是那棟建築能養的動物數。 */
const COOP_ID = 'coop';
const COWBARN_ID = 'cowbarn';
/** 牛舍改建的旗標（店家賣的 building.cowbarn 會把它設為真）；沒改建前買不到牛，牛舍的門也開不了。 */
const COWBARN_FLAG = 'cowbarn';

function seatsIn(index: ContentIndex, mapId: string): number {
  return slotsOf(index.map(mapId)).length;
}

/** 這棟建築住的是哪一群動物（地圖的 flock）；沒有動物的地圖回傳 null。 */
function flockAt(state: GameState, index: ContentIndex): FlockId | null {
  return index.map(state.mapId).flock ?? null;
}

function herdOf(state: GameState, flock: FlockId): Animal[] {
  return flock === 'cows' ? state.cows : state.animals;
}

function withHerd(state: GameState, flock: FlockId, herd: Animal[]): GameState {
  return flock === 'cows' ? { ...state, cows: herd } : { ...state, animals: herd };
}

function buyAnimal(state: GameState, kind: string, cost: number, count: number, index: ContentIndex): CommandOutcome {
  const def = index.animal(kind);
  if (count !== 1) return reply(state, [messageFor('NOT_SOLD')], [refused('NOT_SOLD')]);
  if (def.milk) return buyCow(state, kind, cost, index);
  if (state.animals.length >= seatsIn(index, COOP_ID)) return reply(state, [messageFor('NO_ROOM')], [refused('NO_ROOM')]);
  return reply({ ...state, gold: state.gold - cost, animals: [...state.animals, newAnimal(kind)] }, [`買了一隻${def.name}，放進雞舍`]);
}

/** 牛要牛舍已經改建、而且還有座位才能買；牛舍改建後才有座位。 */
function buyCow(state: GameState, kind: string, cost: number, index: ContentIndex): CommandOutcome {
  const def = index.animal(kind);
  if (state.flags[COWBARN_FLAG] !== true) return reply(state, [messageFor('NO_BARN')], [refused('NO_BARN')]);
  if (state.cows.length >= seatsIn(index, COWBARN_ID)) return reply(state, [messageFor('NO_COW_ROOM')], [refused('NO_COW_ROOM')]);
  return reply({ ...state, gold: state.gold - cost, cows: [...state.cows, newAnimal(kind)] }, [`買了一頭${def.name}，牽進牛舍`]);
}

/**
 * 改建店家賣的建築（itemId 為 building.<旗標>）：花金幣，把旗標設為真；不進背包。只能改建一次。
 */
function remodel(state: GameState, itemId: string, cost: number, count: number, index: ContentIndex): CommandOutcome {
  const flag = itemId.slice('building.'.length);
  if (count !== 1) return reply(state, [messageFor('NOT_SOLD')], [refused('NOT_SOLD')]);
  if (state.flags[flag]) return reply(state, [messageFor('ALREADY_OWNED')], [refused('ALREADY_OWNED')]);
  const name = index.item(itemId).name;
  return reply({ ...state, gold: state.gold - cost, flags: { ...state.flags, [flag]: true } }, [`${name}完成，花了 ${cost} 金`]);
}

/** 餵乾草：一包乾草餵這棟建築裡的全部動物（雞舍的雞或牛舍的牛；每天一次，睡醒後就要再餵）。 */
function feedAnimals(state: GameState, index: ContentIndex): CommandOutcome {
  const flock = flockAt(state, index) ?? 'animals';
  const herd = herdOf(state, flock);
  if (herd.length === 0) {
    const reason = flock === 'cows' ? 'NO_COW' : 'NO_ANIMAL';
    return reply(state, [messageFor(reason)], [refused(reason)]);
  }
  if (countOf(state.inventory, 'hay') < 1) return reply(state, [messageFor('NO_HAY')], [refused('NO_HAY')]);
  const taken = removeItem(state.inventory, 'hay', 1);
  if (!taken.ok) return reply(state, [messageFor('NO_HAY')], [refused('NO_HAY')]);
  const next = withHerd(
    { ...state, inventory: taken.value, calendar: advanceMinutes(state.calendar, index.tuning.time.minutesPerAction) },
    flock,
    feedAll(herd),
  );
  return reply(next, [flock === 'cows' ? '餵了牛' : '餵了雞']);
}

/** 摸座位上的動物；空位就只是地板。牛另有擠奶（見 careForCow）。 */
function petAt(state: GameState, target: Point, index: ContentIndex): CommandOutcome {
  const map = index.map(state.mapId);
  const slot = slotsOf(map).findIndex((p) => p.x === target.x && p.y === target.y);
  const animal = map.flock ? herdOf(state, map.flock)[slot] : undefined;
  if (slot < 0 || !map.flock || !animal) return reply(state, [NOTHING_HERE], [refused('NOTHING_HERE')]);
  if (map.flock === 'cows') return careForCow(state, slot, index);
  const next: GameState = {
    ...state,
    animals: petAnimal(state.animals, slot),
    calendar: advanceMinutes(state.calendar, index.tuning.time.minutesPerAction),
  };
  return reply(next, [`摸了摸${index.animal(animal.kind).name}`]);
}

/**
 * 站在牛的座位前面：第一次先摸牠（心情加一），之後擠奶（要已餵飽、今天還沒擠過）。
 * 每頭牛每天一次摸、一次擠；摸與擠各花一次動作的時間，不花體力（和其他畜牧動作相同）。
 */
function careForCow(state: GameState, slot: number, index: ContentIndex): CommandOutcome {
  const cow = state.cows[slot];
  if (!cow) return reply(state, [NOTHING_HERE], [refused('NOTHING_HERE')]);
  const name = index.animal(cow.kind).name;
  if (!cow.petted) {
    const next: GameState = {
      ...state,
      cows: petAnimal(state.cows, slot),
      calendar: advanceMinutes(state.calendar, index.tuning.time.minutesPerAction),
    };
    return reply(next, [`摸了摸${name}`]);
  }
  if (!cow.fed) return reply(state, [messageFor('NOT_FED')], [refused('NOT_FED')]);
  if (cow.milked) return reply(state, [messageFor('CARED_TODAY')], [refused('CARED_TODAY')]);
  return milkCow(state, slot, index);
}

/** 擠奶：奶的品質由心情與一次隨機數決定；奶放進背包，放不下就不擠（牛與時間都不變）。 */
function milkCow(state: GameState, slot: number, index: ContentIndex): CommandOutcome {
  const cow = state.cows[slot];
  const milk = cow ? index.animal(cow.kind).milk : undefined;
  if (!cow || !milk) return reply(state, [NOTHING_HERE], [refused('NOTHING_HERE')]);
  const roll = rollInt(state.rng, 0, 999);
  const quality = milkQuality(cow.mood, roll.value / 1000, milk);
  const stored = addItem(state.inventory, index.item(milk.item), 1, quality);
  if (!stored.ok) return reply(state, [messageFor('BAG_FULL')], [refused('BAG_FULL')]);
  const next: GameState = {
    ...state,
    rng: roll.rng,
    inventory: stored.value,
    cows: state.cows.map((c, i) => (i === slot ? { ...c, milked: true } : c)),
    calendar: advanceMinutes(state.calendar, index.tuning.time.minutesPerAction),
  };
  return reply(next, [`擠了${index.animal(cow.kind).name}的奶，得到${index.item(milk.item).name}${QUALITY_LABEL[quality]}`]);
}

/** 睡醒前的產蛋：每隻餵飽的動物各下一顆蛋（優良與否由心情與隨機數決定），蛋放進背包；放不下的壞掉。 */
function layEggs(state: GameState, index: ContentIndex): { inventory: Inventory; animals: Animal[]; rng: number; count: number; lost: number } {
  const roll = rollInt(state.rng, 0, 999);
  let inventory = state.inventory;
  let count = 0;
  let lost = 0;
  for (const animal of state.animals) {
    const def = index.animal(animal.kind);
    // 只有會下蛋的動物（雞）睡醒時產蛋；牛要人去擠奶。
    if (def.eggItem === undefined || def.eggQuality === undefined) continue;
    for (const egg of produceEggs([animal], { eggItem: def.eggItem, eggQuality: def.eggQuality }, roll.value / 1000).eggs) {
      const stored = addItem(inventory, index.item(egg.itemId), 1, egg.quality);
      if (stored.ok) {
        inventory = stored.value;
        count += 1;
      } else {
        lost += 1;
      }
    }
  }
  return { inventory, animals: dailyCare(state.animals), rng: roll.rng, count, lost };
}

/** 站在廚房前面才能做菜。 */
function facingKitchen(state: GameState, index: ContentIndex): boolean {
  const map = index.map(state.mapId);
  const target = neighbor(state.player, state.player.facing);
  return tileAt(map, target.x, target.y)?.kind === 'kitchen';
}

/**
 * 做菜：材料要夠、烹飪等級要到；成功才扣材料、加上一道料理，並累積烹飪經驗（扣 1 點體力）。
 */
function cook(state: GameState, recipeId: string, index: ContentIndex): CommandOutcome {
  if (!facingKitchen(state, index)) return reply(state, [messageFor('NOT_AT_STOVE')], [refused('NOT_AT_STOVE')]);
  const recipe = index.recipe(recipeId);
  const level = levelOf(state.skills.cooking, index.tuning.skills.thresholds);
  if (level < recipe.level) return reply(state, [messageFor('TOO_LOW_LEVEL')], [refused('TOO_LOW_LEVEL')]);
  const missing = Object.entries(recipe.ingredients)
    .filter(([itemId, count]) => countOf(state.inventory, itemId) < count)
    .map(([itemId, count]) => `${index.item(itemId).name} × ${count - countOf(state.inventory, itemId)}`);
  if (missing.length > 0) return reply(state, [`${messageFor('NO_MATERIAL')}：還差 ${missing.join('、')}`], [refused('NO_MATERIAL')]);

  const result = spendThen(state, 'cook', index, (s) => {
    let inventory = s.inventory;
    for (const [itemId, count] of Object.entries(recipe.ingredients)) {
      const taken = removeItem(inventory, itemId, count);
      if (!taken.ok) return fail(taken.reason);
      inventory = taken.value;
    }
    const stored = addItem(inventory, index.item(`dish.${recipe.id}`), 1);
    if (!stored.ok) return fail(stored.reason);
    return ok(recordQuestEvent({ ...s, inventory: stored.value }, { type: 'cook', recipeId: recipe.id }, index));
  });
  if (!result.ok) return reply(state, [messageFor(result.reason)], [refused(result.reason)]);
  return reply(result.value, [`做好了${recipe.name}`]);
}

/** 站在加工台前面才能放入或取回。 */
function facingWorkshop(state: GameState, index: ContentIndex): boolean {
  const map = index.map(state.mapId);
  const target = neighbor(state.player, state.player.facing);
  return tileAt(map, target.x, target.y)?.kind === 'workshop';
}

/**
 * 放入一批加工：材料要夠、烹飪等級要到、機器要有空位；成功才扣材料與體力，並累積烹飪經驗。
 * 成品要等睡覺過了加工天數，再到加工台取回（見 collectProcessing）。
 */
function startProcessing(state: GameState, recipeId: string, index: ContentIndex): CommandOutcome {
  if (!facingWorkshop(state, index)) return reply(state, [messageFor('NOT_AT_WORKSHOP')], [refused('NOT_AT_WORKSHOP')]);
  const recipe = index.processingRecipe(recipeId);
  const level = levelOf(state.skills.cooking, index.tuning.skills.thresholds);
  if (level < recipe.level) return reply(state, [messageFor('TOO_LOW_LEVEL')], [refused('TOO_LOW_LEVEL')]);
  const missing = Object.entries(recipe.ingredients)
    .filter(([itemId, count]) => countOf(state.inventory, itemId) < count)
    .map(([itemId, count]) => `${index.item(itemId).name} × ${count - countOf(state.inventory, itemId)}`);
  if (missing.length > 0) return reply(state, [`${messageFor('NO_MATERIAL')}：還差 ${missing.join('、')}`], [refused('NO_MATERIAL')]);

  const result = spendThen(state, 'process', index, (s) => {
    let inventory = s.inventory;
    for (const [itemId, count] of Object.entries(recipe.ingredients)) {
      const taken = removeItem(inventory, itemId, count);
      if (!taken.ok) return fail(taken.reason);
      inventory = taken.value;
    }
    const started = startJob(s.processing, recipe.id, recipe.days, index.tuning.processing.slots);
    if (!started.ok) return fail(started.reason);
    return ok({ ...s, inventory, processing: started.value });
  });
  if (!result.ok) return reply(state, [messageFor(result.reason)], [refused(result.reason)]);
  return reply(result.value, [`放進了加工機：${recipe.name}（${recipe.days} 天後完成）`]);
}

/** 取回所有已完成的成品；背包放不下時整筆不取，成品留在機器裡。 */
function collectProcessing(state: GameState, index: ContentIndex): CommandOutcome {
  if (!facingWorkshop(state, index)) return reply(state, [messageFor('NOT_AT_WORKSHOP')], [refused('NOT_AT_WORKSHOP')]);
  const { ready, remaining } = takeReady(state.processing);
  if (ready.length === 0) return reply(state, [messageFor('NOTHING_READY')], [refused('NOTHING_READY')]);
  let inventory = state.inventory;
  for (const job of ready) {
    const recipe = index.processingRecipe(job.recipeId);
    const stored = addItem(inventory, index.item(recipe.output), 1);
    if (!stored.ok) return reply(state, [messageFor(stored.reason)], [refused(stored.reason)]);
    inventory = stored.value;
  }
  const names = ready.map((job) => index.item(index.processingRecipe(job.recipeId).output).name);
  return reply({ ...state, inventory, processing: remaining }, [`取回了${names.join('、')}`]);
}

/** 站在工作台前面才能合成。 */
function facingWorkbench(state: GameState, index: ContentIndex): boolean {
  const map = index.map(state.mapId);
  const target = neighbor(state.player, state.player.facing);
  return tileAt(map, target.x, target.y)?.kind === 'workbench';
}

/**
 * 合成：要站在工作台前面、技能要到、材料要夠。效果型的配方（灑水器、浮標、木箱）改變狀態，
 * 產物型的配方放進背包。合成不耗體力，也不花時間。
 */
function craft(state: GameState, recipeId: string, index: ContentIndex): CommandOutcome {
  if (!facingWorkbench(state, index)) return reply(state, [messageFor('NOT_AT_WORKBENCH')], [refused('NOT_AT_WORKBENCH')]);
  const recipe = index.craftingRecipe(recipeId);
  const unlock = recipe.unlock;
  if (unlock && 'skill' in unlock && levelOf(state.skills[unlock.skill as SkillId], index.tuning.skills.thresholds) < unlock.level) {
    return reply(state, [messageFor('LOCKED')], [refused('LOCKED')]);
  }
  if (unlock && 'flag' in unlock && state.flags[unlock.flag] !== true) {
    return reply(state, [messageFor('NOT_UNLOCKED')], [refused('NOT_UNLOCKED')]);
  }
  const effect = recipe.effect;
  if (effect?.type === 'flag' && state.flags[effect.flag]) return reply(state, [messageFor('ALREADY_OWNED')], [refused('ALREADY_OWNED')]);
  const base = index.tuning.inventory.capacity;
  if (effect?.type === 'bagSlots' && state.inventory.capacity >= base + effect.slots * effect.max) {
    return reply(state, [messageFor('BAG_MAX')], [refused('BAG_MAX')]);
  }
  const missing = Object.entries(recipe.ingredients)
    .filter(([itemId, count]) => countOf(state.inventory, itemId) < count)
    .map(([itemId, count]) => `${index.item(itemId).name} × ${count - countOf(state.inventory, itemId)}`);
  if (missing.length > 0) return reply(state, [`${messageFor('NO_MATERIAL')}：還差 ${missing.join('、')}`], [refused('NO_MATERIAL')]);

  let inventory = state.inventory;
  for (const [itemId, count] of Object.entries(recipe.ingredients)) {
    const taken = removeItem(inventory, itemId, count);
    if (!taken.ok) return reply(state, [messageFor(taken.reason)], [refused(taken.reason)]);
    inventory = taken.value;
  }
  if (recipe.output) {
    const stored = addItem(inventory, index.item(recipe.output.item), recipe.output.count);
    if (!stored.ok) return reply(state, [messageFor(stored.reason)], [refused(stored.reason)]);
    inventory = stored.value;
  }
  let next: GameState = { ...state, inventory };
  if (effect?.type === 'flag') next = { ...next, flags: { ...next.flags, [effect.flag]: true } };
  if (effect?.type === 'bagSlots') next = { ...next, inventory: { ...next.inventory, capacity: next.inventory.capacity + effect.slots } };
  return reply(next, [`做好了${recipe.name}`], [{ type: 'crafted', recipeId: recipe.id }]);
}

/** 吃一道料理：回復它的體力，但不會超過上限；吃掉一份。 */
function eat(state: GameState, itemId: string, index: ContentIndex): CommandOutcome {
  if (countOf(state.inventory, itemId) < 1 || !itemId.startsWith('dish.')) {
    return reply(state, [messageFor('NO_DISH')], [refused('NO_DISH')]);
  }
  const recipe = index.recipe(itemId.slice('dish.'.length));
  const taken = removeItem(state.inventory, itemId, 1);
  if (!taken.ok) return reply(state, [messageFor('NO_DISH')], [refused('NO_DISH')]);
  const current = Math.min(state.energy.max, state.energy.current + recipe.energy + dishEnergyBonus(state.talents, index.talents.defs));
  const gained = current - state.energy.current;
  return reply(
    { ...state, inventory: taken.value, energy: { ...state.energy, current } },
    [`吃了${recipe.name}，體力 +${gained}`],
  );
}

/** 站在佈告欄前：把今天的抽取寫進狀態，然後打開委託面板（不花體力與時間）。 */
function openBulletin(state: GameState, index: ContentIndex): CommandOutcome {
  return reply({ ...state, board: currentBoard(state, index) }, [], [{ type: 'bulletinOpened' }]);
}

/** 站在信箱前按 X：取信（未讀的信都讀過），不花體力與時間。 */
function collectMailbox(state: GameState, index: ContentIndex): CommandOutcome {
  const collected = collectMail(state, index);
  return reply(collected.state, collected.messages);
}

/** 接取委託（不花體力與時間）。接取失敗時說明原因，狀態不變。 */
function acceptQuestCommand(state: GameState, questId: string, index: ContentIndex): CommandOutcome {
  const accepted = acceptQuest(state, questId, index);
  if (!accepted.ok) return reply(state, [messageFor(accepted.reason)], [refused(accepted.reason)]);
  return reply(accepted.value, [`接下了委託「${index.quest(questId).title}」`]);
}

/** 社區修復的捐獻（不花體力與時間）。失敗時說明原因，狀態不變。 */
function donateCommand(state: GameState, command: Extract<Command, { type: 'donate' }>, index: ContentIndex): CommandOutcome {
  const result = donateToRepair(state, command.repairId, command.itemId, command.count, index);
  if (!result.ok) return reply(state, [messageFor(result.reason)], [refused(result.reason)]);
  return reply(result.value.state, result.value.messages);
}

/** 交付委託（不花體力與時間）。東西不夠時說明還差多少；獎勵放不下時什麼都不改。 */
function submitQuestCommand(state: GameState, questId: string, index: ContentIndex): CommandOutcome {
  const submitted = submitQuest(state, questId, index);
  if (submitted.ok) return reply(submitted.value.state, submitted.value.messages);
  const shortfall = submitted.reason === 'NO_MATERIAL' ? shortfallOf(state, questId, index) : null;
  const message = shortfall ? `${messageFor('NO_MATERIAL')}：還差 ${shortfall}` : messageFor(submitted.reason);
  return reply(state, [message], [refused(submitted.reason)]);
}

