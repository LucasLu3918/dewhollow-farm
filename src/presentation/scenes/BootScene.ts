import Phaser from 'phaser';
import type { AssetEntry, AssetManifest } from '../../infrastructure/assets/asset-manifest';
import type { CompanionManifest } from '../../infrastructure/assets/companion-manifest';
import type { ToolManifest } from '../../infrastructure/assets/tool-manifest';
import type { RigManifest } from '../../infrastructure/assets/rig-manifest';
import type { Hud } from '../hud';
import type { GameSession } from '../../application/game-session';
import type { ContentIndex } from '../../application/content-index';
import type { ContentPack, Direction } from '../../domain/content';
import type { TerrainDef } from '../../infrastructure/content/content-schema';
import type { SoundPlayer } from '../audio/sound-player';
import type { MusicPlayer } from '../audio/music-player';
import type { HelpPanel } from '../help-panel';
import type { SavePanel } from '../save-panel';
import type { SettingsService } from '../../application/settings';
import { registerEmoteTextures } from '../emote';
import { registerAnimalTextures } from '../animal-art';
import { MapScene, type MapSceneDeps } from './MapScene';
import { TILE_SIZE, UNIT } from '../constants';


export interface BootDeps {
  assets: AssetManifest;
  rigs: RigManifest;
  companions: CompanionManifest;
  tools: ToolManifest;
  sounds: SoundPlayer;
  music: MusicPlayer;
  terrain: TerrainDef[];
  session: GameSession;
  index: ContentIndex;
  pack: ContentPack;
  hud: Hud;
  help: HelpPanel;
  saves: SavePanel;
  settings: SettingsService;
}

/**
 * 載入素材並產生占位圖。有 file 的素材會從檔案載入；沒有的以 color 繪製占位圖。
 * 替換素材只需在 content/assets.json 指定 file，規則與測試不需修改。
 */
export class BootScene extends Phaser.Scene {
  constructor(private readonly deps: BootDeps) {
    super('boot');
  }

  preload(): void {
    for (const entry of this.deps.assets.assets) {
      if (entry.file) this.load.image(entry.id, entry.file);
    }
  }

  create(): void {
    // 動物的圖由程式畫（見 animal-art.ts）；先畫好，下面的占位產圖就會略過同名的素材。
    registerAnimalTextures(this);
    for (const entry of this.deps.assets.assets) {
      // 翻轉素材沒有自己的貼圖，畫面會改用原圖並翻轉（見 resolveAsset）。
      if (entry.mirrorOf) continue;
      if (this.textures.exists(entry.id)) continue;
      // 檔案存在但無法解碼（或路徑錯誤）時，Phaser 不一定發出 loaderror，
      // 因此以「有 file 卻沒有貼圖」作為失敗判斷，並明確告知玩家。
      if (entry.file) this.deps.hud.error(`素材載入失敗：${entry.id}（${entry.file}），已改用占位圖`);
      this.makePlaceholder(entry);
    }
    // 表情氣泡不產圖：用 Graphics 畫成貼圖（顏色取自共用調色盤）。
    registerEmoteTextures(this);
    // 入庫的圖片多半是縮小顯示的高解析母版；遊戲設定為像素風（最近鄰），縮小時會鋸齒，改用線性取樣。
    for (const entry of this.deps.assets.assets) {
      if (entry.file && this.textures.exists(entry.id)) {
        this.textures.get(entry.id).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    }
    const sceneDeps: MapSceneDeps = {
      session: this.deps.session,
      index: this.deps.index,
      pack: this.deps.pack,
      hud: this.deps.hud,
      assets: this.deps.assets,
      rigs: this.deps.rigs,
      companions: this.deps.companions,
      tools: this.deps.tools,
      sounds: this.deps.sounds,
      music: this.deps.music,
      terrain: this.deps.terrain,
      help: this.deps.help,
      saves: this.deps.saves,
      settings: this.deps.settings,
    };
    this.scene.start('map', sceneDeps);
  }

  private makePlaceholder(entry: AssetEntry): void {
    const color = Phaser.Display.Color.HexStringToColor(entry.color ?? '#ff00ff').color;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    const size = TILE_SIZE;
    const mid = size / 2;
    const u = UNIT;

    switch (entry.kind) {
      case 'crop':
        graphics.fillStyle(0x3d6b3a, 1).fillRect(mid - 2 * u, mid, 4 * u, mid - 2 * u);
        graphics.fillStyle(color, 1).fillCircle(mid, mid - 3 * u, 8 * u);
        break;
      case 'character':
        drawCharacter(graphics, color, facingOf(entry.id), size);
        break;
      case 'overlay':
        graphics.fillStyle(color, 0.85).fillRect(0, 0, size, size);
        break;
      default:
        graphics.fillStyle(color, 1).fillRect(0, 0, size, size);
        graphics.lineStyle(u, 0x000000, 0.18).strokeRect(u / 2, u / 2, size - u, size - u);
    }

    graphics.generateTexture(entry.id, size, size);
    graphics.destroy();
  }
}

const SKIN = 0xf2d2b0;
const HAIR = 0x3b2a20;
const EYE = 0x1d1d1f;

/** 從素材 id 取出方向，例如 `player.left` → `left`；沒有方向的角色回傳 null。 */
function facingOf(id: string): Direction | null {
  const facing = id.split('.')[1];
  return facing === 'up' || facing === 'down' || facing === 'left' || facing === 'right' ? facing : null;
}

/**
 * 占位角色：身體用指定色，頭部與五官依方向變化。
 * 朝上只看得到後腦，朝下看到兩眼，朝左右時眼睛靠向該側，讓方向在占位圖上就能分辨。
 * 數字以 32 px 設計稿為基準，乘上 UNIT 換算。
 */
function drawCharacter(graphics: Phaser.GameObjects.Graphics, color: number, facing: Direction | null, size: number): void {
  const mid = size / 2;
  const u = UNIT;
  graphics.fillStyle(color, 1).fillRect(mid - 8 * u, mid + 2 * u, 16 * u, 12 * u);
  graphics.fillStyle(SKIN, 1).fillCircle(mid, mid - 6 * u, 8 * u);

  if (facing === 'up') {
    graphics.fillStyle(HAIR, 1).fillCircle(mid, mid - 7 * u, 9 * u);
    return;
  }

  graphics.fillStyle(HAIR, 1).fillRect(mid - 8 * u, mid - 15 * u, 16 * u, 6 * u);
  graphics.fillStyle(EYE, 1);
  if (facing === 'down' || facing === null) {
    graphics.fillCircle(mid - 3 * u, mid - 6 * u, 1.5 * u).fillCircle(mid + 3 * u, mid - 6 * u, 1.5 * u);
  } else if (facing === 'left') {
    graphics.fillCircle(mid - 4 * u, mid - 6 * u, 1.5 * u);
  } else {
    graphics.fillCircle(mid + 4 * u, mid - 6 * u, 1.5 * u);
  }
}
