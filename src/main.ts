import './styles.css';
import Phaser from 'phaser';
import crops from '../content/crops.json';
import npcs from '../content/npcs.json';
import start from '../content/start.json';
import tuning from '../content/tuning.json';
import assets from '../content/assets.json';
import farm from '../content/maps/farm.json';
import village from '../content/maps/village.json';
import { createContentIndex } from './application/content-index';
import { GameSession } from './application/game-session';
import type { SaveRepository } from './application/ports';
import { loadContent } from './infrastructure/content/load-content';
import { MemorySaveRepository } from './infrastructure/persistence/memory-save-repository';
import { IndexedDbSaveRepository, hasIndexedDb } from './infrastructure/persistence/indexeddb-save-repository';
import { Hud } from './presentation/hud';
import { BootScene } from './presentation/scenes/BootScene';
import { MapScene } from './presentation/scenes/MapScene';
import { TILE_SIZE } from './presentation/constants';

/**
 * 組裝點（composition root）：這裡是唯一知道具體實作的地方。
 * 其他層只看見介面（port）與純資料。
 */
async function bootstrap(): Promise<void> {
  const hud = new Hud(document);
  const loaded = loadContent({ crops, npcs, maps: [farm, village], start, tuning, assets });
  const index = createContentIndex(loaded.pack);

  let repository: SaveRepository;
  if (hasIndexedDb()) {
    repository = new IndexedDbSaveRepository();
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
  if (session.restored) hud.messages(['已讀取存檔，繼續遊玩。']);

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 16 * TILE_SIZE,
    height: 12 * TILE_SIZE,
    backgroundColor: '#1d2a1f',
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
    scene: [new BootScene({ assets: loaded.assets, session, index, pack: loaded.pack, hud }), new MapScene()],
  });
}

bootstrap().catch((error: unknown) => {
  // 啟動階段的錯誤（例如內容資料有誤）無法經由 HUD 物件顯示，直接寫入訊息列表。
  const item = document.createElement('li');
  item.className = 'error';
  item.textContent = `啟動失敗：${error instanceof Error ? error.message : String(error)}`;
  document.querySelector('#hud-log')?.append(item);
});
