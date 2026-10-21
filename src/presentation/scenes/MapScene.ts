import Phaser from 'phaser';
import type { ContentPack, Direction, MapDef, Point } from '../../domain/content';
import { plotKey, type PlotMap, type PlotState } from '../../domain/farm';
import { tileAt } from '../../domain/world';
import { resolveAsset, type AssetManifest } from '../../infrastructure/assets/asset-manifest';
import type { GameSession } from '../../application/game-session';
import type { ContentIndex } from '../../application/content-index';
import type { Command, GameEvent } from '../../application/game-commands';
import type { CompanionDef, CompanionManifest } from '../../infrastructure/assets/companion-manifest';
import type { ToolDef, ToolManifest } from '../../infrastructure/assets/tool-manifest';
import type { RigDef, RigManifest } from '../../infrastructure/assets/rig-manifest';
import type { TerrainDef } from '../../infrastructure/content/content-schema';
import type { Hud } from '../hud';
import { cameraBounds, deadzoneOf } from '../camera';
import { TILE_SIZE, VIEW_SIZE } from '../constants';
import { nightAlpha, particleKind, particlePosition, seasonGrassTint, weatherDim } from '../atmosphere';
import type { Season } from '../../domain/calendar';
import type { TileKind } from '../../domain/content';
import { changeAt, effectiveKind } from '../../domain/world-changes';
import { ShopPanel } from '../shop-panel';
import { KitchenPanel } from '../kitchen-panel';
import { WorkshopPanel } from '../workshop-panel';
import { WorkbenchPanel } from '../workbench-panel';
import { SkillPanel } from '../skill-panel';
import { slotsOf } from '../../domain/animals';
import { animalTextureOf } from '../animal-art';
import type { Weather } from '../../domain/weather';
import { RENDER_COMPAT_KEY } from '../apply-render-compat';
import { CharacterRig, type RigDebugInfo } from '../character-rig';
import { centerOf, footOf, standOf } from '../layout';
import { emotesForEvent, type EmoteKind } from '../emote-defs';
import { playEmote, type EmoteHandle } from '../emote';
import { footstepDust, pickupFlight, playActionEffect, shipFlight, sleepEffect, type ShipIcon } from '../effects';
import { footstepKind, touchesWater, type FootstepEnv } from '../footstep-surface';
import { shipIconsFor, shippedItemIds } from '../ship-animation';
import type { Inventory } from '../../domain/inventory';
import type { SoundPlayer } from '../audio/sound-player';
import type { MusicPlayer } from '../audio/music-player';
import { ACTION_SOUND } from '../audio/sound-ids';
import { prefersReducedMotion } from '../motion';
import { nextPetTile, placeBeside } from '../pet-follow';
import type { RenderCompatInfo } from '../render-compat';
import type { View } from '../walk-pose';

export interface MapSceneDeps {
  session: GameSession;
  index: ContentIndex;
  pack: ContentPack;
  hud: Hud;
  /** 素材清單：用來決定每張圖的顯示縮放（density）。 */
  assets: AssetManifest;
  /** 角色骨架資料：玩家、毛毛與寵物的動畫用。 */
  rigs: RigManifest;
  /** 夥伴（寵物）：跟隨玩家，或住在某張地圖。 */
  companions: CompanionManifest;
  /** 工具：農務動作時握在手上揮動。 */
  tools: ToolManifest;
  /** 音效播放器（程式合成，見 audio/sound-player.ts）。 */
  sounds: SoundPlayer;
  /** 背景音樂（程式合成，B 開關；M 靜音見 audio/music-player.ts）。 */
  music: MusicPlayer;
  /** 各種地形的腳步（塵土顏色與音效），來自 content/terrain.json。 */
  terrain: TerrainDef[];
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
  a: { type: 'takeTool', tool: 'axe' },
  p: { type: 'takeTool', tool: 'pick' },
  r: { type: 'takeTool', tool: 'rod' },
  g: { type: 'takeTool', tool: 'sickle' },
  s: { type: 'manualSave' },
};

const MOVE_DURATION_MS = 110;

/** 揮一次工具的時間；命中的那一刻由 tool-swing.ts 的 impactAt 決定。 */
const SWING_DURATION_MS = 420;

/** 居民與夥伴被搭話時，原地做一步的時間（比走一格慢，才看得清楚）。 */
const REACT_DURATION_MS = 320;

/** 圖層深度：居民 5、跟隨的寵物 9（在玩家後面）、玩家 10。 */
const DEPTH_RESIDENT = 5;
const DEPTH_FOLLOWER = 9;
const DEPTH_PLAYER = 10;
/** 天色與天氣的遮罩、粒子，在世界之上、HUD（DOM）之下。 */
const DEPTH_SKY = 40;
/** 收線的時限（毫秒）：魚上鉤後要在這段時間內按 x。 */
const REEL_WINDOW_MS = 1100;
/** 夜色遮罩的顏色（深藍，比純黑自然）。 */
const NIGHT_COLOR = 0x0b1030;
/** 下雨時的遮罩顏色（灰藍）。 */
const WEATHER_COLOR = 0x30405a;

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

/** 開發模式下的角色資訊：站的格子、外框與姿勢。 */
interface ActorDebugInfo {
  id: string;
  kind: string;
  tileX: number;
  tileY: number;
  left: number;
  top: number;
  width: number;
  height: number;
  pose: { y: number; rotation: number; scaleX: number; scaleY: number; legA: number; legB: number; stretch: number };
  /** 正在揮的工具（沒有在揮就是 null）。 */
  tool: { id: string; rotation: number; scale: number } | null;
  /** 正在走路、揮工具，或有排隊的動作。 */
  busy: boolean;
}

/** 開發模式下的表情氣泡資訊：誰、什麼表情、世界座標與目前的大小與透明度。 */
interface EmoteDebugInfo {
  who: string;
  kind: string;
  x: number;
  y: number;
  scale: number;
  alpha: number;
}

/** 夥伴在場景裡的狀態。跟隨者跨地圖保留；常駐者隨地圖建立與銷毀。 */
interface CompanionState {
  def: CompanionDef;
  rig: CharacterRig;
  /** 目前站的格子；null 表示這張地圖沒有地方可站（暫時隱藏）。 */
  tile: Point | null;
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
      /** 畫面上所有看得見的角色（玩家、居民、夥伴）：站的格子、外框與目前姿勢。 */
      actors(): ActorDebugInfo[];
      /** 藏起（或恢復）玩家以外的所有角色，讓像素量測只看玩家自己，不受旁邊的寵物遮擋影響。 */
      setOthersHidden(hidden: boolean): void;
      /** 目前還在畫面上的表情氣泡。 */
      emotes(): EmoteDebugInfo[];
      /** 效果發生的紀錄（揮動開始、命中時的粒子、鏡頭微震），用來驗證效果落在命中那一刻。 */
      effectLog(): { name: string; at: number }[];
      /** 最近播放過的音效 id（靜音時不記）。 */
      soundLog(): string[];
      /** 目前是否靜音。 */
      muted(): boolean;
      /** 背景音樂是否正在播放（按 B 開始）。 */
      musicPlaying(): boolean;
      /** 目前選定的背景音樂曲目 id。 */
      musicTrack(): string | null;
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
  /** 目前地圖上有骨架的居民（例如毛毛），隨地圖重建。 */
  private npcRigs = new Map<string, CharacterRig>();
  private companions = new Map<string, CompanionState>();
  /** 玩家上一次畫面更新時站的格子，用來算出「剛離開的格子」給跟隨的寵物。 */
  private playerTile: Point | null = null;
  /** 頭上的表情氣泡，每個角色最多一個（鍵是 'player' 或居民 id）。 */
  private activeEmotes = new Map<string, { handle: EmoteHandle; rig: CharacterRig }>();
  private effectEntries: { name: string; at: number }[] = [];
  /**
   * 揮工具時，被作用的那一格先維持「動作前」的樣子，等工具命中的那一刻才更新（null 表示動作前沒有這一格）。
   * 遊戲狀態是立刻改變的，但畫面上鋤頭還在空中時，田地不該已經翻好。
   */
  private heldPlots = new Map<string, PlotState | null>();
  /** 每一格地圖的圖片與它原本的地形：玩家造成的變化（砍樹、採野薄荷）會換成草地。 */
  private tileSprites: { x: number; y: number; base: TileKind; image: Phaser.GameObjects.Image }[] = [];
  private shopPanel!: ShopPanel;
  private kitchenPanel!: KitchenPanel;
  private workshopPanel!: WorkshopPanel;
  private workbenchPanel!: WorkbenchPanel;
  private skillPanel!: SkillPanel;
  /** 雞舍裡的動物圖片，每次重畫時重建。 */
  private animalSprites: Phaser.GameObjects.Image[] = [];
  /** 魚上鉤後等待收線的計時器（時限內按 x 就釣到，逾時魚跑掉）。 */
  private reelTimer: Phaser.Time.TimerEvent | null = null;
  private shownSeason: Season | null = null;
  private nightShade!: Phaser.GameObjects.Rectangle;
  private weatherShade!: Phaser.GameObjects.Rectangle;
  private weatherGfx!: Phaser.GameObjects.Graphics;
  private terrainByKind = new Map<string, TerrainDef>();
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
    this.shopPanel = new ShopPanel(document, deps.index, (command) => void this.run(command));
    this.kitchenPanel = new KitchenPanel(document, deps.index, (command) => void this.run(command));
    this.workshopPanel = new WorkshopPanel(document, deps.index, (command) => void this.run(command));
    this.workbenchPanel = new WorkbenchPanel(document, deps.index, (command) => void this.run(command));
    this.skillPanel = new SkillPanel(document, deps.index, (command) => void this.run(command));
    deps.hud.bindSkills(() => this.skillPanel.toggle(deps.session.state));
    this.terrainByKind = new Map(deps.terrain.map((entry) => [entry.kind, entry]));
  }

  create(): void {
    this.world = this.add.container(0, 0);
    this.createSky();
    // 玩家骨架：腳底中心站在格子底邊中央，上半身與腳分開動作。
    this.rig = new CharacterRig(this, this.rigDef('player'), this.deps.assets);
    this.rig.root.setDepth(DEPTH_PLAYER);
    this.createFollowers();
    this.setupCamera();
    window.addEventListener('keydown', this.onKeyDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', this.onKeyDown);
    });
    this.refresh();
  }

  /** 天色與天氣的遮罩與粒子：固定在畫面上（不隨鏡頭移動）。 */
  private createSky(): void {
    const { width, height } = VIEW_SIZE;
    // 填色不透明度為 1，明暗只由 setAlpha 控制（填色若為 0 會把 setAlpha 乘成 0，什麼也看不見）。
    this.nightShade = this.add.rectangle(0, 0, width, height, NIGHT_COLOR, 1).setOrigin(0).setScrollFactor(0).setDepth(DEPTH_SKY);
    this.weatherShade = this.add.rectangle(0, 0, width, height, WEATHER_COLOR, 1).setOrigin(0).setScrollFactor(0).setDepth(DEPTH_SKY);
    this.weatherGfx = this.add.graphics().setScrollFactor(0).setDepth(DEPTH_SKY + 1);
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
        actors: () => this.debugActors(),
        setOthersHidden: (hidden) => this.setOthersHidden(hidden),
        emotes: () => this.debugEmotes(),
        effectLog: () => this.effectEntries.map((e) => ({ ...e })),
        soundLog: () => this.deps.sounds.playedIds(),
        muted: () => this.deps.sounds.isMuted(),
        musicPlaying: () => this.deps.music.isPlaying(),
        musicTrack: () => this.deps.music.currentTrackId(),
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
    const { hud, sounds } = this.deps;
    if (event.key.toLowerCase() === 'm') {
      // 靜音是玩家的偏好，不是遊戲指令，所以不經過應用層。
      event.preventDefault();
      const muted = sounds.toggleMute();
      hud.messages([muted ? '已靜音（按 M 開啟音效）' : '已開啟音效（按 M 靜音）']);
      return;
    }
    if (event.key.toLowerCase() === 'b') {
      // 背景音樂預設不播放，由玩家按 B 開始（瀏覽器要求使用者手勢才能出聲）。
      event.preventDefault();
      const playing = this.deps.music.toggle();
      hud.messages([playing ? '背景音樂開始播放（按 B 暫停）' : '背景音樂已暫停（按 B 播放）']);
      return;
    }
    if (this.reelTimer) {
      // 魚上鉤了：只有 x 有用（收線），其餘按鍵等時限過了再說。
      if (event.key.toLowerCase() === 'x') {
        event.preventDefault();
        this.finishReel(true);
      }
      return;
    }
    if (this.shopPanel.isOpen() || this.kitchenPanel.isOpen() || this.workshopPanel.isOpen() || this.workbenchPanel.isOpen() || this.skillPanel.isOpen()) {
      // 櫃檯或廚房開著時，按鍵只用來離開（Esc），其餘操作都在面板上用滑鼠完成。
      if (event.key === 'Escape') {
        event.preventDefault();
        this.shopPanel.close();
        this.kitchenPanel.close();
        this.workshopPanel.close();
        this.workbenchPanel.close();
        this.skillPanel.close();
      }
      return;
    }
    if (event.key.toLowerCase() === 'k') {
      // 技能與天賦面板：不花體力與時間，不經過應用層的指令。
      event.preventDefault();
      this.skillPanel.toggle(this.deps.session.state);
      return;
    }
    const direction = MOVE_KEYS[event.key];
    const command = direction ? ({ type: 'move', direction } as const) : COMMAND_KEYS[event.key.toLowerCase()];
    if (!command) return;
    event.preventDefault();
    await this.run(command);
  }

  /** 魚上鉤：頭上冒出驚嘆號，開始計時。 */
  private startReel(): void {
    this.showEmote('player', 'surprise');
    this.reelTimer = this.time.delayedCall(REEL_WINDOW_MS, () => this.finishReel(false));
  }

  /** 收線結束：按得到（hit）就釣到魚，否則魚跑掉了。 */
  private finishReel(hit: boolean): void {
    this.reelTimer?.remove(false);
    this.reelTimer = null;
    void this.run({ type: 'reel', hit });
  }

  /** 把一個指令交給應用層，顯示訊息與效果，然後重畫。鍵盤與商店面板共用這條路。 */
  private async run(command: Command): Promise<void> {
    const { hud, session, sounds } = this.deps;
    const before = { ...session.state.player };
    const plotsBefore = session.state.plots;
    const inventoryBefore = session.state.inventory;
    try {
      const outcome = await session.dispatch(command);
      hud.messages(outcome.messages);
      if (command.type === 'cycleTool' || command.type === 'cycleSeed') sounds.play('click');
      this.playEvents(outcome.events, before, plotsBefore, inventoryBefore);
    } catch (error) {
      hud.error(`存檔失敗：${error instanceof Error ? error.message : String(error)}`);
    }
    this.shopPanel.refresh(session.state);
    this.kitchenPanel.refresh(session.state);
    this.workshopPanel.refresh(session.state);
    this.workbenchPanel.refresh(session.state);
    this.skillPanel.refresh(session.state);
    this.refresh();
  }

  /** 把應用層的事件轉成視覺效果。效果只在這裡播放，規則不受影響。 */
  private playEvents(
    events: readonly GameEvent[],
    before: { x: number; y: number },
    plotsBefore: PlotMap,
    inventoryBefore: Inventory,
  ): void {
    for (const event of events) {
      if (event.type === 'acted') {
        this.playAction(event, plotsBefore, inventoryBefore);
      } else if (event.type === 'slept') {
        sleepEffect(this, this.deps.session.state.player.x, this.deps.session.state.player.y);
        this.deps.sounds.play('sleep');
        this.log('slept');
      } else if (event.type === 'talked') {
        this.reactToTalk(event.npcId);
        this.deps.sounds.play(event.gifted ? 'gift' : 'talk');
      } else if (event.type === 'refused') {
        this.deps.sounds.play('refuse');
      } else if (event.type === 'bite') {
        this.startReel();
      } else if (event.type === 'shopOpened') {
        this.shopPanel.open(event.shopId, this.deps.session.state);
      } else if (event.type === 'kitchenOpened') {
        this.kitchenPanel.open(this.deps.session.state);
      } else if (event.type === 'workshopOpened') {
        this.workshopPanel.open(this.deps.session.state);
      } else if (event.type === 'workbenchOpened') {
        this.workbenchPanel.open(this.deps.session.state);
      } else if (event.type === 'saveRequested') {
        this.deps.sounds.play('save');
      }
      for (const emote of emotesForEvent(event)) {
        this.showEmote(emote.who === 'player' ? 'player' : emote.who.npc, emote.kind);
      }
    }
    const after = this.deps.session.state.player;
    const moved = before.x !== after.x || before.y !== after.y;
    const sameMap = this.renderedMapId === this.deps.session.state.mapId;
    if (moved && sameMap) this.footstep(before.x, before.y);
  }

  /**
   * 離開一格時的腳步：依那一格的地面決定塵土顏色與聲音；戶外的水邊與雪地會蓋過地面（見 footstep-surface.ts）。
   */
  private footstep(x: number, y: number): void {
    const state = this.deps.session.state;
    const map = this.deps.index.map(state.mapId);
    const ground = tileAt(map, x, y);
    const terrain = ground ? this.terrainByKind.get(ground.kind) : undefined;
    if (!terrain) return;
    const neighbors = [
      tileAt(map, x - 1, y),
      tileAt(map, x + 1, y),
      tileAt(map, x, y - 1),
      tileAt(map, x, y + 1),
    ].map((tile) => tile?.kind);
    const env: FootstepEnv = { touchesWater: touchesWater(neighbors), weather: state.weather, season: state.calendar.season };
    const style = this.terrainByKind.get(footstepKind(terrain, env));
    if (!style) return;
    footstepDust(this, x, y, style.footstep.dust);
    this.deps.sounds.play(style.footstep.sound);
    this.log(`step:${style.kind}`);
  }

  /**
   * 農務動作的回饋：有工具的動作（開墾、澆水、播種）揮工具，粒子與鏡頭微震等到「命中」那一刻才出現；
   * 沒有工具的動作（收成、出貨）維持原本的壓扁伸展，效果立刻出現。
   */
  private playAction(event: Extract<GameEvent, { type: 'acted' }>, plotsBefore: PlotMap, inventoryBefore: Inventory): void {
    if (event.action === 'ship') {
      this.playShip(event, inventoryBefore);
      return;
    }
    const reduced = prefersReducedMotion();
    const key = plotKey(event.x, event.y);
    const impact = (): void => {
      if (this.heldPlots.delete(key)) this.drawPlots(); // 命中：這一格才更新成動作後的樣子
      this.log(`effect:${event.action}`);
      this.deps.sounds.play(ACTION_SOUND[event.action]);
      if (event.action === 'harvest') this.pickUp(event.x, event.y, plotsBefore);
      playActionEffect(this, event.action, event.x, event.y);
      if (event.action === 'till' && !reduced) {
        this.cameras.main.shake(90, 0.003);
        this.log('shake');
      }
    };
    const tool = this.deps.tools.tools.find((t) => t.action === event.action);
    if (tool && this.rig.canSwing()) {
      this.rig.swing(tool, SWING_DURATION_MS, reduced, impact, () => {
        this.log(`swing:${event.action}`);
        this.deps.sounds.play('swing');
      });
      // swing() 可能已經補播了上一個被打斷的動作的命中，所以在它之後才凍結這一格。
      this.heldPlots.set(key, plotsBefore[key] ?? null);
      this.drawPlots();
    } else {
      this.rig.squash();
      impact();
    }
  }

  /**
   * 出貨：被取走的物品飛進出貨箱，箱蓋開合一次；物品落地時才出現原本的出貨效果。
   * 減少動態時不飛、不開蓋，效果立刻出現。
   */
  private playShip(event: Extract<GameEvent, { type: 'acted' }>, inventoryBefore: Inventory): void {
    const impact = (): void => {
      this.log(`effect:${event.action}`);
      this.deps.sounds.play(ACTION_SOUND[event.action]);
      playActionEffect(this, event.action, event.x, event.y);
    };
    this.rig.squash();
    if (prefersReducedMotion()) {
      impact();
      return;
    }
    const shipped = shippedItemIds(inventoryBefore.stacks, this.deps.session.state.inventory.stacks);
    const box = { x: event.x * TILE_SIZE, y: event.y * TILE_SIZE };
    this.log('ship:fly');
    shipFlight(this, this.shipIcons(shipped), this.headOf(this.rig), box, impact);
  }

  /** 出貨圖示：有素材的物品用素材（作物的物品 id 與素材 id 相同），其餘用色點。 */
  private shipIcons(itemIds: readonly string[]): ShipIcon[] {
    return shipIconsFor(itemIds).map((itemId): ShipIcon => {
      if (!this.deps.assets.assets.some((asset) => asset.id === itemId)) return { texture: null, scale: 1 };
      const asset = resolveAsset(this.deps.assets, itemId);
      return { texture: asset.textureId, scale: asset.scale };
    });
  }

  /** 收成：作物從田裡飛到玩家頭上，再飄出名稱（見 effects.ts 的 pickupFlight）。 */
  private pickUp(x: number, y: number, plotsBefore: PlotMap): void {
    const cropId = plotsBefore[plotKey(x, y)]?.crop?.cropId;
    if (!cropId) return;
    const crop = this.deps.index.crop(cropId);
    const asset = resolveAsset(this.deps.assets, `crop.${cropId}`);
    const from = { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 };
    pickupFlight(this, asset.textureId, asset.scale, from, () => this.headOf(this.rig), `+${crop.name}`);
    this.log(`pickup:${cropId}`);
  }

  /** 角色頭頂附近（飄字與拾取的終點）。 */
  private headOf(rig: CharacterRig): { x: number; y: number } {
    return { x: rig.root.x, y: rig.root.y - rig.displayHeight() * 0.8 };
  }

  /** 在某個角色頭上彈出表情氣泡；同一個角色已有氣泡時先換掉。找不到那個角色（沒有骨架的居民）就略過。 */
  private showEmote(key: string, kind: EmoteKind): void {
    const rig = key === 'player' ? this.rig : this.npcRigs.get(key);
    if (!rig) return;
    this.activeEmotes.get(key)?.handle.destroy();
    const entry = {
      rig,
      handle: playEmote(this, rig.root, kind, rig.displayHeight(), prefersReducedMotion(), () => {
        if (this.activeEmotes.get(key) === entry) this.activeEmotes.delete(key);
      }),
    };
    this.activeEmotes.set(key, entry);
  }

  private log(name: string): void {
    this.effectEntries.push({ name, at: performance.now() });
    if (this.effectEntries.length > 200) this.effectEntries.shift();
  }

  private debugEmotes(): EmoteDebugInfo[] {
    return [...this.activeEmotes.entries()].map(([who, { handle, rig }]) => ({
      who,
      kind: handle.kind,
      x: rig.root.x + handle.container.x,
      y: rig.root.y + handle.container.y,
      scale: handle.scaleNow(),
      alpha: handle.container.alpha,
    }));
  }

  /** 依目前狀態重畫。地圖切換時整張重建，其餘情況只更新田地、方向與玩家位置。 */
  private refresh(): void {
    const state = this.deps.session.state;
    const map = this.deps.index.map(state.mapId);
    this.deps.hud.update(state, this.deps.pack);

    const mapChanged = this.renderedMapId !== map.id;
    if (mapChanged) {
      this.renderedMapId = map.id;
      this.drawMap(map.id);
      const stand = standOf(state.player.x, state.player.y);
      this.rig.teleport(stand.x, stand.y);
      this.frameCamera(map, state.player);
    }

    this.showFacing(state.player.facing);
    this.applySeason(state.calendar.season);
    this.deps.music.update(state.calendar.season, state.calendar.minuteOfDay, state.weather);
    this.syncWorldTiles();
    this.syncAnimals(state.mapId);
    this.drawPlots();
    this.movePlayer(state.player.x, state.player.y);
    this.moveFollowers(map, state.player, mapChanged);
    this.playerTile = { x: state.player.x, y: state.player.y };
  }

  /** 換季時重新染色草地（只在季節變了的時候動作）。 */
  private applySeason(season: Season): void {
    if (this.shownSeason === season) return;
    this.shownSeason = season;
    const tint = seasonGrassTint(season);
    for (const sprite of this.tileSprites) {
      if (sprite.image.texture.key === 'tile.grass') sprite.image.setTint(tint);
    }
  }

  /** 雞舍的雞、牛舍的牛：每隻坐在對應的座位上（座位順序見 slotsOf；住哪一群看地圖的 flock）。 */
  private syncAnimals(mapId: string): void {
    for (const sprite of this.animalSprites) sprite.destroy();
    this.animalSprites = [];
    const state = this.deps.session.state;
    const map = this.deps.index.map(mapId);
    if (!map.flock) return;
    const herd = map.flock === 'cows' ? state.cows : state.animals;
    const seats = slotsOf(map);
    seats.forEach((seat, i) => {
      const animal = herd[i];
      if (!animal) return;
      const sprite = this.add
        .image(seat.x * TILE_SIZE + TILE_SIZE / 2, seat.y * TILE_SIZE + TILE_SIZE / 2, animalTextureOf(animal.kind))
        .setDepth(6);
      this.animalSprites.push(sprite);
    });
  }

  /** 玩家造成的地圖變化（砍樹、採野薄荷、隔日恢復）即時反映到每一格的圖片上。 */
  private syncWorldTiles(): void {
    const state = this.deps.session.state;
    for (const sprite of this.tileSprites) {
      const kind = effectiveKind(sprite.base, changeAt(state.worldChanges, state.mapId, sprite.x, sprite.y));
      const key = `tile.${kind}`;
      if (sprite.image.texture.key === key) continue;
      sprite.image.setTexture(key);
      if (kind === 'grass' && this.shownSeason) sprite.image.setTint(seasonGrassTint(this.shownSeason));
      else sprite.image.clearTint();
    }
  }

  /** 換成面向的那一張圖；原地轉身時只換圖，不移動。 */
  private showFacing(facing: Direction): void {
    if (facing === this.shownFacing) return;
    this.shownFacing = facing;
    this.rig.setView(facing);
  }

  private drawMap(mapId: string): void {
    this.world.removeAll(true);
    this.heldPlots.clear();
    this.tileSprites = [];
    const map = this.deps.index.map(mapId);

    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const tile = tileAt(map, x, y);
        if (!tile) continue;
        const image = this.image(`tile.${tile.kind}`, x, y, 0);
        this.tileSprites.push({ x, y, base: tile.kind, image });
        this.world.add(image);
      }
    }

    this.clearActors();
    for (const placement of map.npcs) {
      const npc = this.deps.index.npc(placement.npcId);
      const def = this.deps.rigs.rigs.find((r) => r.id === npc.id);
      if (def) {
        // 有骨架的居民（毛毛）：腳底中心站在格子底邊中央，能搖擺。
        const rig = new CharacterRig(this, def, this.deps.assets);
        const stand = standOf(placement.x, placement.y);
        rig.root.setDepth(DEPTH_RESIDENT);
        rig.teleport(stand.x, stand.y);
        this.npcRigs.set(npc.id, rig);
      } else {
        this.world.add(this.character(`npc.${npc.id}`, placement.x, placement.y, DEPTH_RESIDENT));
      }
    }
    this.createResidents(map);
  }

  private rigDef(id: string): RigDef {
    const def = this.deps.rigs.rigs.find((r) => r.id === id);
    if (!def) throw new Error(`rigs.json 缺少 ${id} 的骨架`);
    return def;
  }

  /** 換地圖前清掉上一張圖的居民骨架與常駐夥伴（跟隨的寵物保留）。 */
  private clearActors(): void {
    for (const [key, entry] of this.activeEmotes) if (key !== 'player') entry.handle.destroy();
    for (const rig of this.npcRigs.values()) rig.destroy();
    this.npcRigs.clear();
    for (const [id, state] of this.companions) {
      if (!state.def.home) continue;
      state.rig.destroy();
      this.companions.delete(id);
    }
  }

  /** 跟隨玩家的寵物：整個遊戲只建立一次；位置在每次畫面更新時決定。 */
  private createFollowers(): void {
    for (const def of this.deps.companions.companions) {
      if (!def.follows) continue;
      const rig = new CharacterRig(this, this.rigDef(def.rig), this.deps.assets);
      rig.root.setDepth(DEPTH_FOLLOWER).setVisible(false);
      this.companions.set(def.id, { def, rig, tile: null });
    }
  }

  /** 住在這張地圖的夥伴（例如毛毛旁邊的有袋動物）。 */
  private createResidents(map: MapDef): void {
    for (const def of this.deps.companions.companions) {
      if (!def.home || def.home.mapId !== map.id) continue;
      const rig = new CharacterRig(this, this.rigDef(def.rig), this.deps.assets);
      const stand = standOf(def.home.x, def.home.y);
      rig.root.setDepth(DEPTH_RESIDENT);
      rig.teleport(stand.x, stand.y);
      this.companions.set(def.id, { def, rig, tile: { x: def.home.x, y: def.home.y } });
    }
  }

  /**
   * 跟隨的寵物：換地圖時站到玩家旁邊；玩家走一步，牠就走到玩家剛離開的那一格。
   * 寵物只存在於畫面上，不擋路、不進存檔。
   */
  private moveFollowers(map: MapDef, player: { x: number; y: number; facing: Direction }, mapChanged: boolean): void {
    const taken = new Set<string>();
    for (const state of this.companions.values()) {
      if (state.def.home && state.tile) taken.add(`${state.tile.x},${state.tile.y}`);
    }
    for (const state of this.companions.values()) {
      if (!state.def.follows) continue;
      if (mapChanged || state.tile === null) {
        const spot = placeBeside(map, player, player.facing, taken);
        state.tile = spot;
        state.rig.root.setVisible(spot !== null);
        if (spot) {
          const stand = standOf(spot.x, spot.y);
          state.rig.teleport(stand.x, stand.y);
        }
      } else if (this.playerTile) {
        const next = nextPetTile(this.playerTile, player, state.tile);
        if (next.x !== state.tile.x || next.y !== state.tile.y) {
          state.tile = next;
          const stand = standOf(next.x, next.y);
          state.rig.walkTo(stand.x, stand.y, MOVE_DURATION_MS);
        }
      }
    }
  }

  /** 玩家跟居民說話：居民原地搖一下，把他當朋友的夥伴也跳一下。 */
  private reactToTalk(npcId: string): void {
    this.npcRigs.get(npcId)?.stepInPlace(REACT_DURATION_MS);
    for (const state of this.companions.values()) {
      if (state.def.reactsTo === npcId) state.rig.stepInPlace(REACT_DURATION_MS);
    }
  }

  private drawPlots(): void {
    const state = this.deps.session.state;
    const map = this.deps.index.map(state.mapId);
    this.world.getAll().forEach((child) => {
      if (child.getData('plot')) child.destroy();
    });

    // 工具還沒命中的格子維持動作前的樣子（見 heldPlots）。
    const shown: PlotMap = { ...state.plots };
    for (const [key, held] of this.heldPlots) {
      if (held) shown[key] = held;
      else delete shown[key];
    }

    for (const [key, plot] of Object.entries(shown)) {
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

  override update(time: number, delta: number): void {
    this.updateSky(time);
    this.rig.update(delta);
    for (const rig of this.npcRigs.values()) rig.update(delta);
    for (const state of this.companions.values()) state.rig.update(delta);
  }

  /** 每一畫面更新：夜色依時間、變暗依天氣、粒子依天氣與時間。 */
  private updateSky(time: number): void {
    const state = this.deps.session.state;
    this.nightShade.setAlpha(nightAlpha(state.calendar.minuteOfDay));
    this.weatherShade.setAlpha(weatherDim(state.weather));
    this.drawWeather(state.weather, time);
  }

  /** 雨、雪、落葉；減少動態時只畫四分之一的粒子。 */
  private drawWeather(weather: Weather, time: number): void {
    this.weatherGfx.clear();
    const kind = particleKind(weather);
    if (!kind) return;
    const base = weather === 'storm' ? 70 : kind === 'streak' ? 46 : 30;
    const count = prefersReducedMotion() ? Math.ceil(base / 4) : base;
    for (let i = 0; i < count; i += 1) {
      const p = particlePosition(i, time, VIEW_SIZE.width, VIEW_SIZE.height, kind);
      if (kind === 'streak') {
        this.weatherGfx.lineStyle(1, 0xcfe6ff, 0.55).lineBetween(p.x, p.y, p.x - 3, p.y + 8);
      } else if (kind === 'flake') {
        this.weatherGfx.fillStyle(0xffffff, 0.9).fillCircle(p.x, p.y, 1.6);
      } else {
        this.weatherGfx.fillStyle(0x7fae6b, 0.9).fillCircle(p.x, p.y, 2.4);
      }
    }
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
    const asSprite = (info: RigDebugInfo): SpriteDebugInfo => ({
      key: info.key,
      left: info.left,
      top: info.top,
      width: info.width,
      height: info.height,
      flipX: info.flipX,
    });
    const actors = this.visibleRigs().map(({ rig }) => asSprite(rig.debugInfo()));
    return [asSprite(player), ...actors, ...others];
  }

  /** 開發用：藏起或恢復玩家以外的角色。恢復時，沒有地方可站的跟隨寵物仍然保持隱藏。 */
  private setOthersHidden(hidden: boolean): void {
    for (const rig of this.npcRigs.values()) rig.root.setVisible(!hidden);
    for (const state of this.companions.values()) state.rig.root.setVisible(!hidden && state.tile !== null);
  }

  /** 看得見的居民與夥伴骨架（不含玩家）。 */
  private visibleRigs(): { id: string; rig: CharacterRig }[] {
    const list: { id: string; rig: CharacterRig }[] = [];
    for (const [id, rig] of this.npcRigs) list.push({ id, rig });
    for (const [id, state] of this.companions) if (state.rig.root.visible) list.push({ id, rig: state.rig });
    return list;
  }

  private debugActors(): ActorDebugInfo[] {
    const describe = (id: string, rig: CharacterRig): ActorDebugInfo => {
      const info = rig.debugInfo();
      const foot = rig.footPosition();
      return {
        id,
        kind: info.kind,
        tileX: Math.floor(foot.x / TILE_SIZE),
        tileY: Math.round(foot.y / TILE_SIZE) - 1,
        left: info.left,
        top: info.top,
        width: info.width,
        height: info.height,
        pose: { ...rig.currentPose() },
        tool: rig.currentTool(),
        busy: rig.isBusy(),
      };
    };
    return [describe('player', this.rig), ...this.visibleRigs().map(({ id, rig }) => describe(id, rig))];
  }

  private image(key: string, x: number, y: number, depth: number): Phaser.GameObjects.Image {
    return this.add
      .image(x * TILE_SIZE, y * TILE_SIZE, key)
      .setOrigin(0)
      .setDepth(depth);
  }
}
