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
import forest from '../content/maps/forest.json';
import lake from '../content/maps/lake.json';
import house from '../content/maps/house.json';
import mineEntrance from '../content/maps/mine-entrance.json';
import coop from '../content/maps/coop.json';
import pasture from '../content/maps/pasture.json';
import cowbarn from '../content/maps/cowbarn.json';
import farm from '../content/maps/farm.json';
import village from '../content/maps/village.json';
import plaza from '../content/maps/plaza.json';
import { createContentIndex } from './application/content-index';
import { GameSession } from './application/game-session';
import type { SaveRepository } from './application/ports';
import { loadContent } from './infrastructure/content/load-content';
import { MemorySaveRepository } from './infrastructure/persistence/memory-save-repository';
import { IndexedDbSaveRepository, hasIndexedDb } from './infrastructure/persistence/indexeddb-save-repository';
import { Hud } from './presentation/hud';
import { BootScene } from './presentation/scenes/BootScene';
import { MapScene } from './presentation/scenes/MapScene';
import { applyRenderCompat } from './presentation/apply-render-compat';
import { VIEW_SIZE } from './presentation/constants';
import { SoundPlayer } from './presentation/audio/sound-player';
import { MusicPlayer } from './presentation/audio/music-player';
import { AudioOutput } from './presentation/audio/audio-output';

/**
 * 組裝點（composition root）：這裡是唯一知道具體實作的地方。
 * 其他層只看見介面（port）與純資料。
 */
async function bootstrap(): Promise<void> {
  const hud = new Hud(document);
  const loaded = loadContent({ crops, npcs, schedules, events, friendship, quests, letters, festivals, mainQuest, repairs, randomEvents, maps: [farm, village, plaza, forest, lake, house, mineEntrance, coop, pasture, cowbarn], start, tuning, assets, rigs, companions, tools, sounds, music, terrain, weather, items, shops, fish, animals, recipes, processing, crafting, talents, mine });
  const index = createContentIndex(loaded.pack);
  // 音效與背景音樂共用同一個音訊出口（AudioContext 與靜音旗標）。
  const audio = new AudioOutput();

  let repository: SaveRepository;
  if (hasIndexedDb()) {
    repository = new IndexedDbSaveRepository({
      inventoryCapacity: loaded.pack.tuning.inventory.capacity,
      daysPerSeason: loaded.pack.tuning.time.daysPerSeason,
      wakeMinute: loaded.pack.tuning.time.wakeMinute,
    });
  } else {
    repository = new MemorySaveRepository();
    hud.error('這個瀏覽器無法使用 IndexedDB，存檔只會保留在本頁面，重新整理後會遺失。');
  }

  let session: GameSession;
  try {
    session = await GameSession.open(loaded.pack, index, repository, Math.floor(Math.random() * 2 ** 32));
  } catch (error) {
    hud.error(`無法讀取存檔：${error instanceof Error ? error.message : String(error)}`);
    return;
  }

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
        session,
        index,
        pack: loaded.pack,
        hud,
      }),
      new MapScene(),
    ],
  });
  // 軟體繪圖器會把旋轉的角色畫壞（見 render-compat.ts）；繪圖器建立好後偵測並套用保底。
  game.events.once(Phaser.Core.Events.READY, () => applyRenderCompat(game));
}

bootstrap().catch((error: unknown) => {
  // 啟動階段的錯誤（例如內容資料有誤）無法經由 HUD 物件顯示，直接寫入訊息列表。
  const item = document.createElement('li');
  item.className = 'error';
  item.textContent = `啟動失敗：${error instanceof Error ? error.message : String(error)}`;
  document.querySelector('#hud-log')?.append(item);
});
