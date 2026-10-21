import Phaser from 'phaser';
import type { ContentPack, Direction, MapDef } from '../../domain/content';
import { tileAt } from '../../domain/world';
import { displayScale, type AssetManifest } from '../../infrastructure/assets/asset-manifest';
import type { GameSession } from '../../application/game-session';
import type { ContentIndex } from '../../application/content-index';
import type { Command, GameEvent } from '../../application/game-commands';
import type { Hud } from '../hud';
import { cameraBounds, deadzoneOf } from '../camera';
import { TILE_SIZE } from '../constants';
import { centerOf, footOf } from '../layout';
import { footstepDust, playActionEffect, sleepEffect, squashSprite, walkBob } from '../effects';

export interface MapSceneDeps {
  session: GameSession;
  index: ContentIndex;
  pack: ContentPack;
  hud: Hud;
  /** 素材清單：用來決定每張圖的顯示縮放（density）。 */
  assets: AssetManifest;
}

const MOVE_KEYS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

const COMMAND_KEYS: Record<string, Command> = {
  x: { type: 'interact' },
  z: { type: 'cycleTool' },
  c: { type: 'cycleSeed' },
  s: { type: 'manualSave' },
};

const MOVE_DURATION_MS = 110;

/** 鏡頭跟隨的平滑度：越大越貼緊玩家，1 為完全貼緊。 */
const FOLLOW_LERP = 0.15;

/** 開發模式下供端對端測試讀取的畫面資訊；正式建置會被移除。 */
interface SpriteDebugInfo {
  key: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

declare global {
  interface Window {
    __dewhollow?: {
      cameraScroll(): { x: number; y: number };
      mapId(): string;
      /** 玩家與地圖上所有圖片的貼圖名稱與畫面範圍（世界座標）。 */
      sprites(): SpriteDebugInfo[];
      /** 貼圖的原始圖片大小；占位圖與入庫圖片可以由此分辨。 */
      textureSize(key: string): { width: number; height: number } | null;
    };
  }
}

/**
 * 地圖場景：只負責把 GameState 畫出來，並把按鍵轉成指令交給 GameSession。
 * 規則判斷留在應用層；這裡只決定怎麼呈現（方向、走路節奏、動作效果）。
 */
export class MapScene extends Phaser.Scene {
  private deps!: MapSceneDeps;
  private world!: Phaser.GameObjects.Container;
  private player!: Phaser.GameObjects.Image;
  private renderedMapId: string | null = null;
  private shownFacing: Direction = 'down';
  private scales = new Map<string, number>();
  private onKeyDown = (event: KeyboardEvent): void => {
    void this.handleKey(event);
  };

  constructor() {
    super('map');
  }

  init(deps: MapSceneDeps): void {
    this.deps = deps;
    this.scales = new Map(deps.assets.assets.map((a) => [a.id, displayScale(a)]));
  }

  create(): void {
    this.world = this.add.container(0, 0);
    // 角色圖比格子高：原點放在左下，腳底貼齊格子底部。
    this.player = this.add.image(0, 0, 'player.down').setOrigin(0, 1).setDepth(10);
    this.applyScale(this.player, 'player.down');
    this.setupCamera();
    window.addEventListener('keydown', this.onKeyDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', this.onKeyDown);
    });
    this.refresh();
  }

  /** 鏡頭跟隨玩家：中央留一塊死區，玩家走到邊緣才捲動；邊界在換地圖時重設。 */
  private setupCamera(): void {
    const camera = this.cameras.main;
    const zone = deadzoneOf({ width: camera.width, height: camera.height });
    camera.setDeadzone(zone.width, zone.height);
    // 玩家圖以左下角（腳底）為原點，位移量把跟隨點移到格子中心。
    camera.startFollow(this.player, true, FOLLOW_LERP, FOLLOW_LERP, -TILE_SIZE / 2, TILE_SIZE / 2);
    if (import.meta.env.DEV) {
      window.__dewhollow = {
        cameraScroll: () => ({ x: camera.scrollX, y: camera.scrollY }),
        mapId: () => this.deps.session.state.mapId,
        sprites: () => this.debugSprites(),
        textureSize: (key) => {
          if (!this.textures.exists(key)) return null;
          const source = this.textures.get(key).getSourceImage();
          return { width: source.width, height: source.height };
        },
      };
    }
  }

  /** 換地圖時：重設邊界並直接把鏡頭放到玩家身上，避免從上一張圖的位置慢慢滑過來。 */
  private frameCamera(map: MapDef, tile: { x: number; y: number }): void {
    const camera = this.cameras.main;
    const bounds = cameraBounds(
      { width: map.width * TILE_SIZE, height: map.height * TILE_SIZE },
      { width: camera.width, height: camera.height },
    );
    camera.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    const center = centerOf(tile.x, tile.y);
    camera.centerOn(center.x, center.y);
  }

  private async handleKey(event: KeyboardEvent): Promise<void> {
    const direction = MOVE_KEYS[event.key];
    const command = direction ? ({ type: 'move', direction } as const) : COMMAND_KEYS[event.key.toLowerCase()];
    if (!command) return;
    event.preventDefault();

    const { hud, session } = this.deps;
    const before = { ...session.state.player };
    try {
      const outcome = await session.dispatch(command);
      hud.messages(outcome.messages);
      this.playEvents(outcome.events, before);
    } catch (error) {
      hud.error(`存檔失敗：${error instanceof Error ? error.message : String(error)}`);
    }
    this.refresh();
  }

  /** 把應用層的事件轉成視覺效果。效果只在這裡播放，規則不受影響。 */
  private playEvents(events: readonly GameEvent[], before: { x: number; y: number }): void {
    for (const event of events) {
      if (event.type === 'acted') {
        squashSprite(this, this.player);
        playActionEffect(this, event.action, event.x, event.y);
      } else if (event.type === 'slept') {
        sleepEffect(this, this.deps.session.state.player.x, this.deps.session.state.player.y);
      }
    }
    const after = this.deps.session.state.player;
    const moved = before.x !== after.x || before.y !== after.y;
    const sameMap = this.renderedMapId === this.deps.session.state.mapId;
    if (moved && sameMap) footstepDust(this, before.x, before.y);
  }

  /** 依目前狀態重畫。地圖切換時整張重建，其餘情況只更新田地、方向與玩家位置。 */
  private refresh(): void {
    const state = this.deps.session.state;
    const map = this.deps.index.map(state.mapId);
    this.deps.hud.update(state, this.deps.pack);

    if (this.renderedMapId !== map.id) {
      this.renderedMapId = map.id;
      this.drawMap(map.id);
      const foot = footOf(state.player.x, state.player.y);
      this.player.setPosition(foot.x, foot.y);
      this.frameCamera(map, state.player);
    }

    this.showFacing(state.player.facing);
    this.drawPlots();
    this.movePlayer(state.player.x, state.player.y);
  }

  /** 換成面向的那一張圖；原地轉身時只換圖，不移動。 */
  private showFacing(facing: Direction): void {
    if (facing === this.shownFacing) return;
    this.shownFacing = facing;
    this.player.setTexture(`player.${facing}`);
    this.applyScale(this.player, `player.${facing}`);
  }

  private drawMap(mapId: string): void {
    this.world.removeAll(true);
    const map = this.deps.index.map(mapId);

    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const tile = tileAt(map, x, y);
        if (!tile) continue;
        this.world.add(this.image(`tile.${tile.kind}`, x, y, 0));
      }
    }

    for (const placement of map.npcs) {
      const npc = this.deps.index.npc(placement.npcId);
      this.world.add(this.character(`npc.${npc.id}`, placement.x, placement.y, 5));
    }
  }

  private drawPlots(): void {
    const state = this.deps.session.state;
    const map = this.deps.index.map(state.mapId);
    this.world.getAll().forEach((child) => {
      if (child.getData('plot')) child.destroy();
    });

    for (const [key, plot] of Object.entries(state.plots)) {
      const [x, y] = key.split(',').map(Number);
      if (x === undefined || y === undefined) continue;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;

      const soil = this.image('tile.soil', x, y, 1);
      soil.setData('plot', true);
      if (plot.watered) soil.setTint(0x6fa8dc);
      this.world.add(soil);

      if (plot.crop) {
        const crop = this.deps.index.crop(plot.crop.cropId);
        const ratio = Math.min(1, plot.crop.growthDays / crop.growthDays);
        const sprite = this.image(`crop.${crop.id}`, x, y, 2);
        sprite.setScale(0.5 + 0.5 * ratio);
        sprite.setAlpha(0.5 + 0.5 * ratio);
        sprite.setData('plot', true);
        this.world.add(sprite);
      }
    }
  }

  private movePlayer(x: number, y: number): void {
    const foot = footOf(x, y);
    if (this.player.x === foot.x && this.player.y === foot.y) return;
    walkBob(this, this.player, foot.x, foot.y, MOVE_DURATION_MS);
  }

  /** 設定顯示縮放（例如 2x 母版 0.5 倍），並記下基準縮放，讓壓扁伸展等效果以它為準。 */
  private applyScale(image: Phaser.GameObjects.Image, key: string): void {
    const scale = this.scales.get(key) ?? 1;
    image.setScale(scale);
    image.setData('baseScale', scale);
  }

  /** 站立的角色（玩家以外，例如 NPC）：腳底貼齊格子底部。 */
  private character(key: string, x: number, y: number, depth: number): Phaser.GameObjects.Image {
    const foot = footOf(x, y);
    const image = this.add.image(foot.x, foot.y, key).setOrigin(0, 1).setDepth(depth);
    this.applyScale(image, key);
    return image;
  }

  private debugSprites(): SpriteDebugInfo[] {
    const images = [
      this.player,
      ...this.world.getAll().filter((c): c is Phaser.GameObjects.Image => c instanceof Phaser.GameObjects.Image),
    ];
    return images.map((image) => {
      const bounds = image.getBounds();
      return {
        key: image.texture.key,
        left: Math.round(bounds.x),
        top: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    });
  }

  private image(key: string, x: number, y: number, depth: number): Phaser.GameObjects.Image {
    return this.add
      .image(x * TILE_SIZE, y * TILE_SIZE, key)
      .setOrigin(0)
      .setDepth(depth);
  }
}
