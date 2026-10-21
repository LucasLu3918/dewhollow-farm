import Phaser from 'phaser';
import type { AssetEntry, AssetManifest } from '../../infrastructure/assets/asset-manifest';
import type { Hud } from '../hud';
import type { GameSession } from '../../application/game-session';
import type { ContentIndex } from '../../application/content-index';
import type { ContentPack, Direction } from '../../domain/content';
import { MapScene, type MapSceneDeps } from './MapScene';
import { TILE_SIZE } from '../constants';


export interface BootDeps {
  assets: AssetManifest;
  session: GameSession;
  index: ContentIndex;
  pack: ContentPack;
  hud: Hud;
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
    for (const entry of this.deps.assets.assets) {
      if (this.textures.exists(entry.id)) continue;
      // 檔案存在但無法解碼（或路徑錯誤）時，Phaser 不一定發出 loaderror，
      // 因此以「有 file 卻沒有貼圖」作為失敗判斷，並明確告知玩家。
      if (entry.file) this.deps.hud.error(`素材載入失敗：${entry.id}（${entry.file}），已改用占位圖`);
      this.makePlaceholder(entry);
    }
    const sceneDeps: MapSceneDeps = {
      session: this.deps.session,
      index: this.deps.index,
      pack: this.deps.pack,
      hud: this.deps.hud,
    };
    this.scene.start('map', sceneDeps);
  }

  private makePlaceholder(entry: AssetEntry): void {
    const color = Phaser.Display.Color.HexStringToColor(entry.color ?? '#ff00ff').color;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    const size = TILE_SIZE;
    const mid = size / 2;

    switch (entry.kind) {
      case 'crop':
        graphics.fillStyle(0x3d6b3a, 1).fillRect(mid - 2, mid, 4, mid - 2);
        graphics.fillStyle(color, 1).fillCircle(mid, mid - 3, 8);
        break;
      case 'character':
        drawCharacter(graphics, color, facingOf(entry.id), size);
        break;
      case 'overlay':
        graphics.fillStyle(color, 0.85).fillRect(0, 0, size, size);
        break;
      default:
        graphics.fillStyle(color, 1).fillRect(0, 0, size, size);
        graphics.lineStyle(1, 0x000000, 0.18).strokeRect(0.5, 0.5, size - 1, size - 1);
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
 */
function drawCharacter(graphics: Phaser.GameObjects.Graphics, color: number, facing: Direction | null, size: number): void {
  const mid = size / 2;
  graphics.fillStyle(color, 1).fillRect(mid - 8, mid + 2, 16, 12);
  graphics.fillStyle(SKIN, 1).fillCircle(mid, mid - 6, 8);

  if (facing === 'up') {
    graphics.fillStyle(HAIR, 1).fillCircle(mid, mid - 7, 9);
    return;
  }

  graphics.fillStyle(HAIR, 1).fillRect(mid - 8, mid - 15, 16, 6);
  graphics.fillStyle(EYE, 1);
  if (facing === 'down' || facing === null) {
    graphics.fillCircle(mid - 3, mid - 6, 1.5).fillCircle(mid + 3, mid - 6, 1.5);
  } else if (facing === 'left') {
    graphics.fillCircle(mid - 4, mid - 6, 1.5);
  } else {
    graphics.fillCircle(mid + 4, mid - 6, 1.5);
  }
}
