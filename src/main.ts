import './styles.css';
import Phaser from 'phaser';
import crops from '../content/crops.json';
import mine from '../content/mine.json';
import npcs from '../content/npcs.json';
import schedules from '../content/schedules.json';
import events from '../content/events.json';
import friendship from '../content/friendship.json';
import quests from '../content/quests.json';
import letters from '../content/letters.json';
import festivals from '../content/festivals.json';
import collection from '../content/collection.json';
import achievements from '../content/achievements.json';
import merchant from '../content/traveling-merchant.json';
import decor from '../content/decor.json';
import rating from '../content/rating.json';
import legacy from '../content/legacy.json';
import mainQuest from '../content/main-quest.json';
import repairs from '../content/repairs.json';
import randomEvents from '../content/events-random.json';
import start from '../content/start.json';
import tuning from '../content/tuning.json';
import assets from '../content/assets.json';
import rigs from '../content/rigs.json';
import companions from '../content/companions.json';
import tools from '../content/tools.json';
import sounds from '../content/sounds.json';
import music from '../content/music.json';
import terrain from '../content/terrain.json';
import weather from '../content/weather.json';
import items from '../content/items.json';
import shops from '../content/shops.json';
import fish from '../content/fish.json';
import animals from '../content/animals.json';
import recipes from '../content/recipes.json';
import processing from '../content/processing.json';
import crafting from '../content/crafting.json';
import talents from '../content/talents.json';
import changelog from '../content/changelog.json';
import help from '../content/help.json';
import controlsContent from '../content/controls.json';
import forest from '../content/maps/forest.json';
import lake from '../content/maps/lake.json';
import house from '../content/maps/house.json';
import houseWing from '../content/maps/house-wing.json';
import houseFull from '../content/maps/house-full.json';
import mineEntrance from '../content/maps/mine-entrance.json';
import coop from '../content/maps/coop.json';
import pasture from '../content/maps/pasture.json';
import cowbarn from '../content/maps/cowbarn.json';
import farm from '../content/maps/farm.json';
import village from '../content/maps/village.json';
import plaza from '../content/maps/plaza.json';
import { createContentIndex } from './application/content-index';
import { inventoryDisplay } from './application/inventory-display';
import { NO_LEGACY } from './domain/legacy';
import { PLAYER_WEARER } from './domain/decor';
import { GameSession } from './application/game-session';
import type { SaveRepository } from './application/ports';
import { SaveSlotService, slotFromQuery } from './application/save-slots';
import { SettingsService } from './application/settings';
import { LocalSettingsStore } from './infrastructure/persistence/local-settings-store';
import { applySettings } from './presentation/apply-settings';
import { controlsHint } from './presentation/controls-hint';
import { loadContent } from './infrastructure/content/load-content';
import { parseControlsContent } from './infrastructure/content/controls-content';
import { parseChangelog, parseHelpContent } from './infrastructure/content/info-content';
import { MemorySaveRepository } from './infrastructure/persistence/memory-save-repository';
import { IndexedDbSaveRepository, hasIndexedDb } from './infrastructure/persistence/indexeddb-save-repository';
import { parseSaveRecord } from './infrastructure/persistence/save-schema';
import { resolveItemIcon } from './infrastructure/assets/asset-manifest';
import type { MigrationContext } from './infrastructure/persistence/save-migrations';
import { Hud } from './presentation/hud';
import { InventoryPanel } from './presentation/inventory-panel';
import { HelpPanel } from './presentation/help-panel';
import { SavePanel } from './presentation/save-panel';
import { GAME_VERSION } from './version';
import { BootScene } from './presentation/scenes/BootScene';
import { MapScene } from './presentation/scenes/MapScene';
import { applyRenderCompat } from './presentation/apply-render-compat';
import { VIEW_SIZE } from './presentation/constants';
import { SoundPlayer } from './presentation/audio/sound-player';
import { MusicPlayer } from './presentation/audio/music-player';
import { AudioOutput } from './presentation/audio/audio-output';
import { registerServiceWorker } from './presentation/service-worker';
import { parsePerfFlag } from './presentation/frame-stats';
import { startPerfOverlay } from './presentation/perf-overlay';
import { ResponsiveLayoutController } from './presentation/responsive/responsive-layout';
import type { MapDef } from './domain/content';
import {
  pixel32QualityMapProblems,
  pixel32QualityPortalProblems,
  pixel32QualitySceneAsset,
  pixel32QualitySceneCandidateRequested,
  pixel32QualitySceneManifestFor,
  PIXEL32_QUALITY_MAP_IDS,
  type Pixel32QualitySceneAsset,
} from './presentation/pixel32-quality-scene-candidate';
import { pixel32CandidateRuntimeRequested } from './presentation/pixel32-candidate-runtime';

/** 移除開機載入提示（index.html 的 #game 內）；啟動失敗或讀不開存檔時也用它，免得一直顯示「載入中」。 */
function hideLoader(): void {
  document.querySelector('#game .loading')?.remove();
}

/**
 * 場景與鍵盤監聽都接好後呼叫（見 MapScene.create）：#game 標上 data-ready，畫布才會顯示，並移除載入提示。
 * 畫布在這之前是隱藏的，所以玩家看得到畫面時，按鍵一定會被接到。
 */
function markStageReady(): void {
  document.getElementById('game')?.setAttribute('data-ready', 'true');
  hideLoader();
}

/**
 * 組裝點（composition root）：這裡是唯一知道具體實作的地方。
 * 其他層只看見介面（port）與純資料。
 */
async function bootstrap(): Promise<void> {
  const hud = new Hud(document);
  const inventory = new InventoryPanel(document);
  const originalMaps = [farm, village, plaza, forest, lake, house, houseWing, houseFull, mineEntrance, coop, pasture, cowbarn] as unknown as MapDef[];
  const pixel32Runtime = pixel32CandidateRuntimeRequested(new URLSearchParams(window.location.search), import.meta.env.DEV);
  const qualityCandidates = pixel32QualitySceneCandidateRequested(
    new URLSearchParams(window.location.search), import.meta.env.DEV, pixel32Runtime,
  ) ? await loadPixel32QualityMapCandidates(originalMaps) : null;
  const candidateMaps = qualityCandidates
    ? originalMaps.map((original) => qualityCandidates.maps.find((candidate) => candidate.id === original.id) ?? original)
    : originalMaps;
  const loaded = loadContent({ crops, npcs, schedules, events, friendship, quests, letters, festivals, mainQuest, repairs, randomEvents, collection, achievements, merchant, decor, rating, legacy, maps: candidateMaps, start, tuning, assets, rigs, companions, tools, sounds, music, terrain, weather, items, shops, fish, animals, recipes, processing, crafting, talents, mine });
  // 操作說明的文字（狀態列提示、設定面板的動作名稱、虛擬按鍵）來自 content/controls.json，缺漏會在這裡報錯。
  const controls = parseControlsContent(controlsContent);
  const index = createContentIndex(loaded.pack);
  // 音效與背景音樂共用同一個音訊出口（AudioContext 與靜音旗標）。
  const audio = new AudioOutput();
  // 玩家偏好（按鍵、字級、色盲模式、閃光與震動、觸控）存在 localStorage，與存檔分開；讀不到就用預設值。
  const settings = new SettingsService(new LocalSettingsStore());
  const app = document.querySelector<HTMLElement>('.app');
  const gameHost = document.getElementById('game');
  if (!app || !gameHost) throw new Error('頁面缺少必要的響應式版面容器');
  const responsive = new ResponsiveLayoutController(document, app, gameHost, settings.get());
  responsive.start();
  settings.onChange((next) => responsive.updateSettings(next));
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) responsive.dispose();
  });
  const applyPreferences = (): void => {
    const current = settings.get();
    const pointers = responsive.get().pointer;
    applySettings(document, current, pointers.coarse, pointers.touchPoints);
    hud.setColorblind(current.colorblind);
  };
  applyPreferences();
  settings.onChange(applyPreferences);
  responsive.subscribe(applyPreferences);
  // 操作提示依目前的按鍵產生；開機時套用一次，改鍵後 SettingsService 會通知訂閱者，提示列跟著更新。
  const showControlsHint = (): void => hud.setControlsHint(controlsHint(settings.get().bindings, controls.hintLabels, controls.hintText));
  showControlsHint();
  settings.onChange(showControlsHint);

  hud.setVersion(GAME_VERSION);
  const migration: MigrationContext = {
    inventoryCapacity: loaded.pack.tuning.inventory.capacity,
    daysPerSeason: loaded.pack.tuning.time.daysPerSeason,
    wakeMinute: loaded.pack.tuning.time.wakeMinute,
    playerName: (loaded.pack.legacy ?? NO_LEGACY).defaultPlayerName,
  };
  const persistent = !qualityCandidates && hasIndexedDb();
  let repository: SaveRepository;
  if (persistent) {
    repository = new IndexedDbSaveRepository(migration);
  } else {
    repository = new MemorySaveRepository();
    hud.error(qualityCandidates
      ? 'Pixel32 候選預覽使用隔離的暫存存檔，重新整理後會重設。'
      : '這個瀏覽器無法使用 IndexedDB，存檔只會保留在本頁面，重新整理後會遺失。');
  }

  // 存檔槽由網址決定（?slot=slot-2），沒有或不合法就是第一格；換格就是重新載入頁面。
  const slot = slotFromQuery(window.location.search);
  let session: GameSession | null = null;
  try {
    session = await GameSession.open(loaded.pack, index, repository, Math.floor(Math.random() * 2 ** 32), slot, { gameVersion: GAME_VERSION });
  } catch (error) {
    // 存檔損毀時原檔保留（不覆寫）；玩家可以在存檔槽裡改讀其他格，或刪除、匯入這一格。
    hud.error(`無法讀取存檔：${error instanceof Error ? error.message : String(error)}`);
  }

  const ratingSource = {
    rating: index.rating,
    dexCategories: index.dexCategories,
    npcIds: index.npcs.map((n) => n.id),
    friendship: index.friendship,
  };
  // 離開目前的存檔或重新整理（更新）前先存檔；沒有進行中的遊戲（例如損毀時）就什麼也不做。
  const flushSave = async (): Promise<void> => {
    if (session) await session.save();
  };
  const saves = new SavePanel(document, {
    service: new SaveSlotService({ repository, parse: (raw) => parseSaveRecord(raw, migration), rating: ratingSource, gameVersion: GAME_VERSION }),
    currentSlot: slot,
    persistent,
    beforeLeave: flushSave,
    navigate: (target) => window.location.assign(`${window.location.pathname}?slot=${target}`),
  });
  const helpPanel = new HelpPanel(document, parseHelpContent(help), parseChangelog(changelog), GAME_VERSION);
  hud.bindDialogs(
    () => helpPanel.toggle(),
    () => void saves.open(),
  );

  if (!session) {
    // 讀不開這一格：直接打開存檔槽，讓玩家選別的格子或處理這一格（遊戲本身還沒有開始）。
    hideLoader();
    void saves.open();
    return;
  }
  const started: GameSession = session;
  inventory.setDataProvider(() => {
    const currentInventory = started.state.inventory;
    const knownItemIds = new Set(currentInventory.stacks.map((stack) => stack.itemId));
    const wornItemId = started.state.wearing[PLAYER_WEARER];
    return {
      capacity: currentInventory.capacity,
      entries: inventoryDisplay(currentInventory, index),
      resolveIcon: (itemId) => resolveItemIcon(loaded.assets, itemId, knownItemIds, import.meta.env.BASE_URL),
      wornItemId,
      wornItemName: wornItemId ? index.item(wornItemId).name : undefined,
    };
  });

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: VIEW_SIZE.width,
    height: VIEW_SIZE.height,
    backgroundColor: '#1d2a1f',
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
    scene: [
      new BootScene({
        assets: loaded.assets,
        rigs: loaded.rigs,
        companions: loaded.companions,
        tools: loaded.tools,
        sounds: new SoundPlayer(loaded.sounds, audio),
        music: new MusicPlayer(loaded.music, audio),
        terrain: loaded.terrain.terrains,
        session: started,
        index,
        pack: loaded.pack,
        hud,
        help: helpPanel,
        saves,
        inventory,
        settings,
        responsive,
        onReady: markStageReady,
        qualitySceneCandidates: qualityCandidates?.assets ?? [],
        controls: {
          settingsLabels: controls.settingsLabels,
          touchButtons: controls.touchButtons,
          touchMore: controls.touchMore,
          interactionLabels: controls.interactionLabels,
        },
      }),
      new MapScene(),
    ],
  });
  // 軟體繪圖器會把旋轉的角色畫壞（見 render-compat.ts）；繪圖器建立好後偵測並套用保底。
  game.events.once(Phaser.Core.Events.READY, () => applyRenderCompat(game));

  // 離線可玩：只在正式建置註冊 service worker（dev 模式不註冊，免得快取干擾開發）。
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    registerServiceWorker(
      { container: navigator.serviceWorker, flush: flushSave, reload: () => window.location.reload() },
      `${import.meta.env.BASE_URL}sw.js`,
      import.meta.env.BASE_URL,
      (apply) => hud.showUpdate(() => void apply()),
    ).catch((error: unknown) => {
      hud.error(`離線功能無法啟用：${error instanceof Error ? error.message : String(error)}`);
    });
  }
}

async function loadPixel32QualityMapCandidates(originalMaps: MapDef[]): Promise<{ maps: MapDef[]; assets: Pixel32QualitySceneAsset[] }> {
  const originalById = new Map(originalMaps.map((map) => [map.id, map]));
  const maps: MapDef[] = [];
  const assets: Pixel32QualitySceneAsset[] = [];
  for (const mapId of PIXEL32_QUALITY_MAP_IDS) {
    const original = originalById.get(mapId);
    if (!original) throw new Error(`Pixel32 候選缺少原始地圖：${mapId}`);
    const root = `${import.meta.env.BASE_URL}docs/art/candidates/pixel-movement/pixel32-quality-rebuild/maps/${mapId}`;
    const [metadataResponse, layoutResponse] = await Promise.all([
      fetch(`${root}/candidate.json`),
      fetch(`${root}/candidate-layout.json`),
    ]);
    if (!metadataResponse.ok || !layoutResponse.ok) throw new Error(`Pixel32 候選檔案載入失敗：${mapId}`);
    const [metadata, layoutValue] = await Promise.all([metadataResponse.json(), layoutResponse.json()]);
    const manifest = pixel32QualitySceneManifestFor(mapId, metadata);
    if (!manifest) throw new Error(`Pixel32 候選素材未通過候選／SHA／尺寸中繼資料檢查：${mapId}`);
    if (!layoutValue || typeof layoutValue !== 'object' || (layoutValue as { id?: unknown }).id !== mapId) {
      throw new Error(`Pixel32 候選地圖 ID 不符：${mapId}`);
    }
    const candidate = layoutValue as MapDef;
    const problems = pixel32QualityMapProblems(original, candidate);
    if (problems.length) throw new Error(`Pixel32 候選地圖驗證失敗（${mapId}）：${problems.join('；')}`);
    maps.push(candidate);
    if (manifest.renderMode === 'scene') assets.push(pixel32QualitySceneAsset(manifest, import.meta.env.BASE_URL));
  }
  const portalProblems = pixel32QualityPortalProblems(maps);
  if (portalProblems.length) throw new Error(`Pixel32 候選入口驗證失敗：${portalProblems.join('；')}`);
  return { maps, assets };
}

// 實機量測（網址加 ?perf=1）：顯示幀時間覆蓋層，見 docs/DEVICE_PERF.md。
if (parsePerfFlag(window.location.search)) startPerfOverlay(document);

bootstrap().catch((error: unknown) => {
  // 啟動階段的錯誤（例如內容資料有誤）無法經由 HUD 物件顯示，直接寫入訊息列表。
  hideLoader();
  const item = document.createElement('li');
  item.className = 'error';
  item.textContent = `啟動失敗：${error instanceof Error ? error.message : String(error)}`;
  document.querySelector('#hud-log')?.append(item);
});
