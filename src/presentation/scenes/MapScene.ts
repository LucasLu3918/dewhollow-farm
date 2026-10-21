import Phaser from 'phaser';
import type { ContentPack, Direction, MapDef } from '../../domain/content';
import { tileAt } from '../../domain/world';
import { resolveAsset, type AssetManifest } from '../../infrastructure/assets/asset-manifest';
import type { GameSession } from '../../application/game-session';
import type { ContentIndex } from '../../application/content-index';
import type { Command, GameEvent } from '../../application/game-commands';
import type { RigManifest } from '../../infrastructure/assets/rig-manifest';
import type { Hud } from '../hud';
import { cameraBounds, deadzoneOf } from '../camera';
import { TILE_SIZE } from '../constants';
import { RENDER_COMPAT_KEY } from '../apply-render-compat';
import { CharacterRig } from '../character-rig';
import { centerOf, footOf, standOf } from '../layout';
import { footstepDust, playActionEffect, sleepEffect } from '../effects';
import type { RenderCompatInfo } from '../render-compat';
import type { View } from '../walk-pose';

export interface MapSceneDeps {
  session: GameSession;
  index: ContentIndex;
  pack: ContentPack;
  hud: Hud;
  /** 素材清單：用來決定每張圖的顯示縮放（density）。 */
  assets: AssetManifest;
  /** 角色骨架資料：玩家的走路動畫用。 */
  rigs: RigManifest;
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
  flipX: boolean;
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
      /** 玩家目前的走路姿勢（見 walk-pose.ts）。 */
      pose(): { y: number; rotation: number; scaleX: number; scaleY: number; legA: number; legB: number; stretch: number };
      /** 玩家骨架目前的方向、腳的做法與看得見的切塊。 */
      rig(): { view: string; mode: string; visible: string[] };
      /** 直接擺出走路循環的某一刻，供逐格檢視。 */
      setPose(view: View, step: number, u: number): void;
      /** 直接讀取 WebGL 畫面（原始像素，不經瀏覽器合成）；回傳 PNG 的 data URL。供逐格視覺檢查用。 */
      snapshot(): Promise<string>;
      /** 軟體繪圖器保底的偵測與套用結果（見 render-compat.ts）。 */
      renderCompat(): RenderCompatInfo;
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
  private rig!: CharacterRig;
  private renderedMapId: string | null = null;
  private shownFacing: Direction = 'down';
  private onKeyDown = (event: KeyboardEvent): void => {
    void this.handleKey(event);
  };

  constructor() {
    super('map');
  }

  init(deps: MapSceneDeps): void {
    this.deps = deps;
  }

  create(): void {
    this.world = this.add.container(0, 0);
    // 玩家骨架：腳底中心站在格子底邊中央，上半身與腳分開動作。
    const def = this.deps.rigs.rigs.find((r) => r.id === 'player');
    if (!def) throw new Error('rigs.json 缺少 player 的骨架');
    this.rig = new CharacterRig(this, def, this.deps.assets);
    this.rig.root.setDepth(10);
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
    // 跟隨骨架的軸心（腳底中心，不含身體起伏，鏡頭才不會跟著抖）；位移量把跟隨點移到格子中心。
    camera.startFollow(this.rig.root, true, FOLLOW_LERP, FOLLOW_LERP, 0, TILE_SIZE / 2);
    if (import.meta.env.DEV) {
      window.__dewhollow = {
        cameraScroll: () => ({ x: camera.scrollX, y: camera.scrollY }),
        mapId: () => this.deps.session.state.mapId,
        sprites: () => this.debugSprites(),
        pose: () => ({ ...this.rig.currentPose() }),
        rig: () => {
          const { view, mode, visible } = this.rig.debugInfo();
          return { view, mode, visible: [...visible] };
        },
        setPose: (view, step, u) => this.rig.preview(view, step, u),
        renderCompat: () => this.registry.get(RENDER_COMPAT_KEY) as RenderCompatInfo,
        snapshot: () =>
          new Promise((resolve, reject) => {
            if (!('snapshot' in this.game.renderer)) return reject(new Error('目前的繪圖器不支援 snapshot'));
            this.game.renderer.snapshot((image) => resolve((image as HTMLImageElement).src));
          }),
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
        this.rig.squash();
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
      const stand = standOf(state.player.x, state.player.y);
      this.rig.teleport(stand.x, stand.y);
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
    this.rig.setView(facing);
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
    const stand = standOf(x, y);
    this.rig.walkTo(stand.x, stand.y, MOVE_DURATION_MS);
  }

  override update(_time: number, delta: number): void {
    this.rig.update(delta);
  }

  private resolveTexture(assetId: string): string {
    return resolveAsset(this.deps.assets, assetId).textureId;
  }

  /**
   * 把素材套到圖片上：換成實際的貼圖（翻轉素材用原圖）、水平翻轉、顯示縮放（例如 2x 母版 0.5 倍），
   * 並記下基準縮放，讓壓扁伸展等效果以它為準。
   */
  private applyAsset(image: Phaser.GameObjects.Image, assetId: string): void {
    const { textureId, flipX, scale } = resolveAsset(this.deps.assets, assetId);
    image.setTexture(textureId);
    image.setFlipX(flipX);
    image.setScale(scale);
    image.setData('baseScale', scale);
  }

  /** 站立的角色（玩家以外，例如 NPC）：腳底貼齊格子底部。 */
  private character(key: string, x: number, y: number, depth: number): Phaser.GameObjects.Image {
    const foot = footOf(x, y);
    const image = this.add.image(foot.x, foot.y, this.resolveTexture(key)).setOrigin(0, 1).setDepth(depth);
    this.applyAsset(image, key);
    return image;
  }

  private debugSprites(): SpriteDebugInfo[] {
    const player = this.rig.debugInfo();
    const images = this.world.getAll().filter((c): c is Phaser.GameObjects.Image => c instanceof Phaser.GameObjects.Image);
    const others = images.map((image) => {
      const bounds = image.getBounds();
      return {
        key: image.texture.key,
        left: Math.round(bounds.x),
        top: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        flipX: image.flipX,
      };
    });
    return [
      { key: player.key, left: player.left, top: player.top, width: player.width, height: player.height, flipX: player.flipX },
      ...others,
    ];
  }

  private image(key: string, x: number, y: number, depth: number): Phaser.GameObjects.Image {
    return this.add
      .image(x * TILE_SIZE, y * TILE_SIZE, key)
      .setOrigin(0)
      .setDepth(depth);
  }
}
