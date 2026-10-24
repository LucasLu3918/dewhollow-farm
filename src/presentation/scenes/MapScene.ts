import Phaser from 'phaser';
import type { ContentPack, Direction, MapDef, Point } from '../../domain/content';
import { plotKey, type PlotMap, type PlotState } from '../../domain/farm';
import { tileAt } from '../../domain/world';
import { groundLayerFor, isGroundLayer } from '../map-layers';
import { resolveAsset, type AssetManifest } from '../../infrastructure/assets/asset-manifest';
import type { GameSession } from '../../application/game-session';
import { resolveInteraction, type InteractionLabelKey } from '../../application/interaction';
import type { ContentIndex } from '../../application/content-index';
import type { ActionFeedback, Command, CommandOutcome, GameEvent } from '../../application/game-commands';
import type { CompanionDef, CompanionManifest } from '../../infrastructure/assets/companion-manifest';
import type { ToolDef, ToolManifest } from '../../infrastructure/assets/tool-manifest';
import type { RigDef, RigManifest } from '../../infrastructure/assets/rig-manifest';
import type { TerrainDef } from '../../infrastructure/content/content-schema';
import type { HeldPointerStart, Hud } from '../hud';
import type { HelpPanel } from '../help-panel';
import type { SavePanel } from '../save-panel';
import { cameraBounds, deadzoneOf, mapZoomFor } from '../camera';
import { TILE_SIZE } from '../constants';
import { nightAlpha, particleKind, particlePosition, seasonGrassTint, weatherDim } from '../atmosphere';
import type { Season } from '../../domain/calendar';
import type { TileKind } from '../../domain/content';
import { changeAt, effectiveKind } from '../../domain/world-changes';
import { ShopPanel } from '../shop-panel';
import { KitchenPanel } from '../kitchen-panel';
import { WorkshopPanel } from '../workshop-panel';
import { WorkbenchPanel } from '../workbench-panel';
import { SkillPanel } from '../skill-panel';
import { ResidentPanel } from '../resident-panel';
import { QuestPanel } from '../quest-panel';
import { HeartEventPanel } from '../heart-event-panel';
import { FestivalPanel } from '../festival-panel';
import { RepairPanel } from '../repair-panel';
import { CollectionPanel } from '../collection-panel';
import { LegacyPanel } from '../legacy-panel';
import { playFirework } from '../fireworks';
import { openFestival } from '../../domain/festival';
import { starPhase } from '../../domain/star-fishing';
import { PlaceholderResident, type ResidentView } from '../placeholder-resident';
import { residentsOn } from '../../application/residents';
import { slotsOf } from '../../domain/animals';
import { animalTextureOf } from '../animal-art';
import type { Weather } from '../../domain/weather';
import { RENDER_COMPAT_KEY } from '../apply-render-compat';
import { CharacterRig, type RigDebugInfo } from '../character-rig';
import { centerOf, standOf } from '../layout';
import { findRoute, tileOfStand } from '../resident-route';
import { PLAYER_WEARER } from '../../domain/decor';
import { decorColorOf, wearColorOf } from '../decor-style';
import { emotesForEvent, type EmoteKind } from '../emote-defs';
import { playEmote, type EmoteHandle } from '../emote';
import { footstepDust, pickupFlight, playActionEffect, shipFlight, sleepEffect, yieldLabels, type ShipIcon } from '../effects';
import { gainedItems } from '../yield-feedback';
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
import type { SettingsService } from '../../application/settings';
import { actionForKey, type ActionId } from '../../domain/keybindings';
import { SettingsPanel, type SettingsLabels } from '../settings-panel';
import { isJoystickMovementSource, TouchControls } from '../touch-controls';
import type { TouchLabels, TouchText } from '../touch-pad';
import { reducedEffects } from '../accessibility';
import type { OpenablePanel } from '../panel-dialog';
import { gateAction, type ActionGateAction } from '../action-gate';
import { cameraViewportFor } from '../responsive/layout';
import type { ResponsiveLayoutController } from '../responsive/responsive-layout';
import { ToolSeedSelector } from '../tool-seed-selector';
import { ContinuousFarmActions, farmActionTarget } from '../continuous-farm-actions';
import { calculatePixelViewportPolicy } from '../pixel-viewport/policy';
import { renderProfileFor } from '../pixel-viewport/profiles';
import { resolveCandidateArt, type CandidateCropStage, type CandidateId } from '../candidate-art';
import { candidateFrameAt, type CandidateDirection } from '../candidate-sprite-animator';
import {
  PIXEL32_ANIMATION_ATLAS_KEY,
  PIXEL32_MAP_ATLAS_KEY,
  pixel32MapFrameFor,
} from '../pixel32-candidate-runtime';
import { activeDirection, cancelUnifiedInput, createUnifiedInputState, holdDirection, releaseDirection, type UnifiedInputState } from '../unified-input-state/unified-input-state';
import { advanceMovement, cancelMovement, commitStep, createMovementScheduler, queueMovementTap, rejectStep, requestNextStep, setMovementIntent, type MovementSchedulerState } from '../movement-scheduler/movement-scheduler';

/** 鍵盤事件與虛擬按鍵共用的形狀：只需要按鍵名稱與 preventDefault。 */
type KeyLike = Pick<KeyboardEvent, 'key' | 'preventDefault'>;

interface DeferredPlayerAction {
  command: Command;
  waitForFarmAnimation: boolean;
  resolve: (outcome: CommandOutcome | null) => void;
}

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
  /** 說明頁（? 鍵）與存檔槽（L 鍵）；打開時遊戲的按鍵只用來關閉（Esc）。 */
  help: HelpPanel;
  saves: SavePanel;
  /** 玩家偏好（按鍵、字級、閃光與震動等），不進存檔。 */
  settings: SettingsService;
  responsive: ResponsiveLayoutController;
  /** 鍵盤監聽與畫面都接好後呼叫一次（見 create 結尾與 main.ts 的 markStageReady）。 */
  onReady: () => void;
  /** 操作說明的文字（設定面板的動作名稱、虛擬按鍵的文字），來自 content/controls.json。 */
  controls: {
    settingsLabels: SettingsLabels;
    touchButtons: TouchLabels;
    touchMore: TouchText;
    interactionLabels: Readonly<Record<InteractionLabelKey, string>>;
  };
}

/** 動作 → 移動方向（按鍵由偏好的按鍵表決定，見 handleKey）。 */
const MOVE_ACTIONS: Partial<Record<ActionId, Direction>> = {
  moveUp: 'up',
  moveDown: 'down',
  moveLeft: 'left',
  moveRight: 'right',
};

function isMovementAction(action: ActionId | ActionGateAction | null): boolean {
  return action === 'moveUp' || action === 'moveDown' || action === 'moveLeft' || action === 'moveRight';
}

/** 動作 → 遊戲指令。 */
const COMMAND_ACTIONS: Partial<Record<ActionId, Command>> = {
  interact: { type: 'interact' },
  cycleTool: { type: 'cycleTool' },
  cycleSeed: { type: 'cycleSeed' },
  takeAxe: { type: 'takeTool', tool: 'axe' },
  takePick: { type: 'takeTool', tool: 'pick' },
  takeRod: { type: 'takeTool', tool: 'rod' },
  takeSickle: { type: 'takeTool', tool: 'sickle' },
  manualSave: { type: 'manualSave' },
  // 小屋：擺一件裝飾（面前的空地板）、穿上衣服或帽子、脫下（收回裝飾用互動鍵）。
  placeDecor: { type: 'placeDecor' },
  wear: { type: 'wear' },
  takeOff: { type: 'takeOff' },
};

const MOVE_DURATION_MS = 110;
const CONTINUOUS_STEP_DURATION_MS = 150;

/** 揮一次工具的時間；命中的那一刻由 tool-swing.ts 的 impactAt 決定。 */
const SWING_DURATION_MS = 420;

/**
 * 命中時的鏡頭微震強度，依動作的分量分級：開墾是翻土（輕），砍樹與挖礦是撞硬物（稍重）。
 * 沒有列出的動作不震；減少動態或玩家關掉震動時整個不出現（見 effectGates）。
 */
const IMPACT_SHAKE: Partial<Record<ActionFeedback, { ms: number; intensity: number }>> = {
  till: { ms: 90, intensity: 0.003 },
  chop: { ms: 120, intensity: 0.005 },
  mine: { ms: 120, intensity: 0.005 },
};

/** 會得到物品的採集動作：命中時在格子上飄出「+數量 名稱」。收成的作物由 pickUp 處理，不在這裡。 */
const YIELD_ACTIONS = new Set<ActionFeedback>(['chop', 'mine', 'forage']);

/** 居民與夥伴被搭話時，原地做一步的時間（比走一格慢，才看得清楚）。 */
const REACT_DURATION_MS = 320;

/** 居民在地圖角色下方；玩家與跟隨寵物共用深度帶，再依腳底位置決定前後。 */
const DEPTH_RESIDENT = 5;
const DEPTH_ACTOR_BASE = 10;
const DEPTH_PLAYER_TIE_BREAK = 0.001;
const DEPTH_TREE_TIE_BREAK = 0.001;
/** 擺在地板上的裝飾：在地板之上、動物之下。 */
const DEPTH_DECOR = 3;
/** 天色與天氣的遮罩、粒子，在世界之上、HUD（DOM）之下。 */
const DEPTH_SKY = 40;
/** 收線的時限（毫秒）：魚上鉤後要在這段時間內按 x。 */
const REEL_WINDOW_MS = 1100;
/** 星星收網的計量條（畫面上方）寬度（像素）。 */
const STAR_METER_WIDTH = 160;
/** 夜市時每隔多久在廣場上空放一朵煙火。 */
const FIREWORK_INTERVAL_MS = 2400;
/** 夜色遮罩的顏色（深藍，比純黑自然）。 */
const NIGHT_COLOR = 0x0b1030;
/** 下雨時的遮罩顏色（灰藍）。 */
const WEATHER_COLOR = 0x30405a;

/** 鏡頭跟隨的平滑度：越大越貼緊玩家，1 為完全貼緊。 */
const FOLLOW_LERP = 0.15;

/** 開發模式下供端對端測試讀取的畫面資訊；正式建置會被移除。 */
interface SpriteDebugInfo {
  key: string;
  frame: string | null;
  left: number;
  top: number;
  width: number;
  height: number;
  flipX: boolean;
  depth: number;
}

/** 開發模式下的角色資訊：站的格子、外框與姿勢。 */
interface ActorDebugInfo {
  id: string;
  kind: string;
  footX: number;
  footY: number;
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
  depth: number;
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
      pixelViewport(): {
        profile: string;
        worldTilesVisible: { width: number; height: number };
        renderResolution: { width: number; height: number };
        cssScale: number;
        devicePixelScale: number;
        actualWorldTilesVisible: { width: number; height: number };
        actualCanvasResolution: { width: number; height: number };
        cameraZoom: number;
      };
      movement(): { heldDirection: Direction | null; blockedDirection: Direction | null; moving: boolean; pending: boolean; queuedTaps: number; tile: { x: number; y: number } };
      worldGeneration(): number;
      responsiveLayout(): ReturnType<ResponsiveLayoutController['get']>;
      interaction(): ReturnType<typeof resolveInteraction>;
      interactionTargetMarker(): { visible: boolean; target: Point | null; x: number; y: number; width: number; height: number };
      continuousFarmActionsStopReason(): string;
      continuousFarmCancelSource(): string;
      cameraView(): { x: number; y: number; width: number; height: number; zoom: number; bounds: { x: number; y: number; width: number; height: number } };
      mapId(): string;
      /** 玩家與地圖上所有圖片的貼圖名稱與畫面範圍（世界座標）。 */
      sprites(): SpriteDebugInfo[];
      /** 開發用候選貼圖啟用狀態、實際覆蓋 key 與 fallback 清單。 */
      candidateArt(): {
        profile: string;
        candidate: CandidateId | null;
        candidateAssetIds: string[];
        fallbackAssetIds: string[];
        registeredFrames: string[];
      };
      /** 貼圖的原始圖片大小；占位圖與入庫圖片可以由此分辨。 */
      textureSize(key: string): { width: number; height: number } | null;
      /** DEV-only pixel32 runtime candidate load state and the visible player animation frame. */
      pixel32CandidateRuntime(): { enabled: boolean; mapFrames: string[]; animationFrames: string[]; playerFrame: string | null };
      /** 玩家目前的走路姿勢（見 walk-pose.ts）。 */
      pose(): { y: number; rotation: number; scaleX: number; scaleY: number; legA: number; legB: number; stretch: number };
      /** 玩家骨架目前的方向、腳的做法與看得見的切塊。 */
      rig(): { view: string; mode: string; visible: string[] };
      /** 直接擺出走路循環的某一刻，供逐格檢視。 */
      setPose(view: View, step: number, u: number): void;
      /** 暫停場景更新；預設將角色重設為 REST pose，也可保留目前姿勢供遮擋測試擷取。 */
      pauseScene(options?: { preservePose?: boolean }): Promise<void>;
      /** 直接讀取 WebGL 畫面（原始像素，不經瀏覽器合成）；回傳 PNG 的 data URL。供逐格視覺檢查用。 */
      snapshot(): Promise<string>;
      /** 軟體繪圖器保底的偵測與套用結果（見 render-compat.ts）。 */
      renderCompat(): RenderCompatInfo;
      /** 畫面上所有看得見的角色（玩家、居民、夥伴）：站的格子、外框與目前姿勢。 */
      actors(): ActorDebugInfo[];
      /** 藏起（或恢復）玩家以外的所有角色，讓像素量測只看玩家自己，不受旁邊的寵物遮擋影響。 */
      setOthersHidden(hidden: boolean): void;
      /** 開發用：只藏起或顯示玩家，供角色重疊像素檢查建立遮罩。 */
      setPlayerHidden(hidden: boolean): void;
      /** 目前還在畫面上的表情氣泡。 */
      emotes(): EmoteDebugInfo[];
      /** 效果發生的紀錄（揮動開始、命中時的粒子、鏡頭微震），用來驗證效果落在命中那一刻。 */
      effectLog(): { name: string; at: number }[];
      /** Whether the opt-in continuous farm gesture is active (E2E diagnostics). */
      continuousFarmActionsRunning(): boolean;
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
  private static worldGenerationCount = 0;
  private worldGeneration = 0;
  private deps!: MapSceneDeps;
  private world!: Phaser.GameObjects.Container;
  /** Non-interactive one-tile outline for the current authoritative interaction target. */
  private interactionTargetGfx: Phaser.GameObjects.Graphics | null = null;
  private interactionTargetCell: Point | null = null;
  private rig!: CharacterRig;
  private pixel32CandidateSprite: Phaser.GameObjects.Image | null = null;
  private pixel32CandidateRuntime = false;
  /** 目前地圖上的居民（依行程站位），見 syncResidents。毛毛有骨架，其他人是占位。 */
  private npcRigs = new Map<string, ResidentView>();
  /** 居民的最新行程目標與路線代次；行程變動時先走完當前一步，再重新規劃。 */
  private residentWalks = new Map<string, { goal: Point; run: number; inStep: boolean }>();
  private residentRunCount = 0;
  private companions = new Map<string, CompanionState>();
  /** 玩家上一次畫面更新時站的格子，用來算出「剛離開的格子」給跟隨的寵物。 */
  private playerTile: Point | null = null;
  /** 頭上的表情氣泡，每個角色最多一個（鍵是 'player' 或居民 id）。 */
  private activeEmotes = new Map<string, { handle: EmoteHandle; rig: ResidentView }>();
  private effectEntries: { name: string; at: number }[] = [];
  /**
   * 揮工具時，被作用的那一格先維持「動作前」的樣子，等工具命中的那一刻才更新（null 表示動作前沒有這一格）。
   * 遊戲狀態是立刻改變的，但畫面上鋤頭還在空中時，田地不該已經翻好。
   */
  private heldPlots = new Map<string, PlotState | null>();
  /** 每格的地面底層與透明物件層：地圖變化（砍樹、採野薄荷）即時更新對應圖層。 */
  private tileSprites: {
    x: number;
    y: number;
    base: TileKind;
    ground: TileKind;
    groundImage: Phaser.GameObjects.Image;
    objectImage?: Phaser.GameObjects.Image;
  }[] = [];
  private shopPanel!: ShopPanel;
  private kitchenPanel!: KitchenPanel;
  private workshopPanel!: WorkshopPanel;
  private workbenchPanel!: WorkbenchPanel;
  private skillPanel!: SkillPanel;
  private residentPanel!: ResidentPanel;
  private questPanel!: QuestPanel;
  private heartEventPanel!: HeartEventPanel;
  private festivalPanel!: FestivalPanel;
  private repairPanel!: RepairPanel;
  private collectionPanel!: CollectionPanel;
  private legacyPanel!: LegacyPanel;
  private touchControls!: TouchControls;
  private continuousFarmActions!: ContinuousFarmActions;
  private disposeMainActionHold: (() => void) | null = null;
  private lastContinuousCancelReason = 'not-cancelled';
  private unsubscribeContinuousSetting: (() => void) | null = null;
  private toolSeedSelector!: ToolSeedSelector;
  /** 夜釣星星進行中的計時器與甩竿的時刻（一圈的時限，見 star-fishing.ts）。 */
  private starTimer: Phaser.Time.TimerEvent | null = null;
  private starStartedAt = 0;
  /** 防止鍵盤與觸控在同步套用同一個指令時重複送出動作。 */
  private playerActionInProgress = false;
  private starMeter!: Phaser.GameObjects.Graphics;
  private fireworkCount = 0;
  /** 雞舍裡的動物圖片，每次重畫時重建。 */
  private animalSprites: Phaser.GameObjects.Image[] = [];
  /** 小屋擺好的裝飾（色塊）與玩家頭上的服飾小圖示（見 syncDecor、syncWearing）。 */
  private decorSprites: Phaser.GameObjects.Rectangle[] = [];
  private wearBadge: Phaser.GameObjects.Rectangle | null = null;
  /** 魚上鉤後等待收線的計時器（時限內按 x 就釣到，逾時魚跑掉）。 */
  private reelTimer: Phaser.Time.TimerEvent | null = null;
  private shownSeason: Season | null = null;
  private nightShade!: Phaser.GameObjects.Rectangle;
  private weatherShade!: Phaser.GameObjects.Rectangle;
  private weatherGfx!: Phaser.GameObjects.Graphics;
  private terrainByKind = new Map<string, TerrainDef>();
  private renderedMapId: string | null = null;
  private shownFacing: Direction = 'down';
  private unifiedMovementInput: UnifiedInputState = createUnifiedInputState();
  private movementScheduler: MovementSchedulerState | null = null;
  private readonly keyboardMovementSources = new Set<string>();
  private deferredPlayerAction: DeferredPlayerAction | null = null;
  private deferredPlayerActionRunning = false;
  private onKeyDown = (event: KeyboardEvent): void => {
    void this.handleKey(event);
  };
  private onKeyUp = (event: KeyboardEvent): void => {
    const source = `keyboard:${event.key.toLowerCase()}`;
    if (!this.keyboardMovementSources.delete(source)) return;
    this.releaseMovementInput(source);
  };
  private onWindowBlur = (): void => this.cancelMovementInput();
  /** 設定面板（改按鍵、字級、閃光與震動、觸控）。 */
  private settingsPanel!: SettingsPanel;
  /**
   * 開著時按鍵只用來離開（Esc）的面板，依群組排列：先看第一組，有開著的就整組關掉，其餘組不動（與原本的 handleKey 相同）。
   * 第一組是遊戲內的櫃檯與面板，第二組是說明頁、存檔槽與設定。心形事件面板不在這裡：它不吃 Esc，見 handleKey。
   * 新增面板時加進對應的群組即可。
   */
  private modalGroups: readonly (readonly OpenablePanel[])[] = [];

  constructor() {
    super('map');
  }

  init(deps: MapSceneDeps): void {
    this.deps = deps;
    this.settingsPanel = new SettingsPanel(document, deps.settings, deps.controls.settingsLabels);
    this.continuousFarmActions = new ContinuousFarmActions({
      enabled: () => deps.settings.get().mobile.continuousActions,
      context: () => `${deps.session.state.tool}\u0000${deps.session.state.selectedSeed}`,
      candidate: () => {
        const descriptor = resolveInteraction(deps.session.state, deps.index);
        // A move can finish an in-flight swing early while the rig is walking; swing() queues
        // the next farm action until that walk completes, so walking must not invalidate the target.
        if (this.playerActionInProgress) return null;
        return farmActionTarget(descriptor.labelKey, descriptor.plotKey);
      },
      execute: async (target) => {
        const outcome = await this.handleAction('interact', undefined, undefined, true);
        const acted = outcome?.events.find((event) => event.type === 'acted' && event.action === target.action && plotKey(event.x, event.y) === target.key);
        return { ...target, success: Boolean(acted) };
      },
    });
    this.unsubscribeContinuousSetting = deps.settings.onChange((settings) => {
      if (!settings.mobile.continuousActions) this.continuousFarmActions.stop('settings-disabled');
    });
    this.disposeMainActionHold = deps.hud.bindMainActionHold(
      () => { this.continuousFarmActions.start(); return this.continuousFarmActions.isRunning; },
      () => this.continuousFarmActions.stop('hud-hold-ended'),
    );
    deps.hud.bindSettings(() => {
      this.touchControls.cancelAll();
      this.settingsPanel.open();
    });
    deps.hud.bindMainAction(() => this.pressAction('interact'));
    // 虛擬按鍵（觸控）：按鈕本身掛在 DOM 上，顯示與否由 apply-settings.ts 決定。
    this.touchControls = new TouchControls(document, (action) => this.pressAction(action), deps.controls.touchButtons, deps.controls.touchMore, deps.settings, (reason) => {
      this.lastContinuousCancelReason = reason;
      this.continuousFarmActions.stop(`touch-controls:${reason}`);
      this.cancelMovementInput();
    }, (source, direction) => this.setMovementInput(source, direction));
    this.toolSeedSelector = new ToolSeedSelector(document, deps.index, (command) => {
      // Direct selectors use distinct gate actions and preserve the selected ID in the command.
      void this.handleAction(command.type === 'selectSeed' ? 'selectSeed' : 'selectTool', undefined, command);
    });
    deps.hud.bindToolSeedSelectors(
      (wheel, pointer) => this.openToolSeedSelector('tool', wheel, pointer),
      (wheel, pointer) => this.openToolSeedSelector('seed', wheel, pointer),
      () => this.toolSeedSelector.cancelActiveGesture(),
    );
    this.shopPanel = new ShopPanel(document, deps.index, (command) => void this.run(command));
    this.kitchenPanel = new KitchenPanel(document, deps.index, (command) => void this.run(command));
    this.workshopPanel = new WorkshopPanel(document, deps.index, (command) => void this.run(command));
    this.workbenchPanel = new WorkbenchPanel(document, deps.index, (command) => void this.run(command));
    this.skillPanel = new SkillPanel(document, deps.index, (command) => void this.run(command));
    this.residentPanel = new ResidentPanel(document, deps.index, (command) => void this.run(command));
    this.questPanel = new QuestPanel(document, deps.index, (command) => void this.run(command));
    this.heartEventPanel = new HeartEventPanel(document, deps.index, (command) => void this.run(command));
    this.festivalPanel = new FestivalPanel(document, deps.index, (command) => void this.run(command));
    this.repairPanel = new RepairPanel(document, deps.index, (command) => void this.run(command));
    this.collectionPanel = new CollectionPanel(document, deps.index);
    this.legacyPanel = new LegacyPanel(document, deps.index, (command) => void this.run(command));
    deps.hud.bindSkills(() => {
      this.touchControls.cancelAll();
      this.skillPanel.toggle(deps.session.state);
    });
    this.modalGroups = [
      [
        this.shopPanel,
        this.kitchenPanel,
        this.workshopPanel,
        this.workbenchPanel,
        this.skillPanel,
        this.residentPanel,
        this.questPanel,
        this.festivalPanel,
        this.repairPanel,
        this.collectionPanel,
        this.legacyPanel,
      ],
      [deps.help, deps.saves, this.settingsPanel, this.toolSeedSelector],
    ];
    this.terrainByKind = new Map(deps.terrain.map((entry) => [entry.kind, entry]));
  }

  create(): void {
    this.worldGeneration = ++MapScene.worldGenerationCount;
    this.world = this.add.container(0, 0);
    this.createSky();
    this.starMeter = this.add.graphics().setScrollFactor(0).setDepth(DEPTH_SKY + 2);
    // 夜市的煙火：每隔一陣子看看要不要放（只有節慶的夜晚、在廣場才放，見 maybeFirework）。
    this.time.addEvent({ delay: FIREWORK_INTERVAL_MS, loop: true, callback: () => this.maybeFirework() });
    // 玩家骨架：腳底中心站在格子底邊中央，上半身與腳分開動作。
    this.rig = new CharacterRig(this, this.rigDef('player'), this.deps.assets);
    this.rig.root.setDepth(this.actorDepth(this.rig.footPosition().y, true));
    this.pixel32CandidateRuntime = this.registry.get('gate1-pixel32-candidate-runtime') === true;
    if (this.pixel32CandidateRuntime && this.textures.exists(PIXEL32_ANIMATION_ATLAS_KEY)
      && this.textures.get(PIXEL32_ANIMATION_ATLAS_KEY).has('down-idle')) {
      // Keep the rig root as the authoritative movement/camera/depth anchor while swapping only its visible body.
      this.rig.body.setVisible(false);
      this.pixel32CandidateSprite = this.add
        .image(0, 0, PIXEL32_ANIMATION_ATLAS_KEY, 'down-idle')
        .setOrigin(0.5, 47 / 48)
        .setScale(2);
      this.rig.root.add(this.pixel32CandidateSprite);
    } else {
      this.pixel32CandidateRuntime = false;
    }
    const initialPlayer = this.deps.session.state.player;
    this.movementScheduler = createMovementScheduler({ x: initialPlayer.x, y: initialPlayer.y }, {
      initialFacing: initialPlayer.facing,
      stepDurationMs: CONTINUOUS_STEP_DURATION_MS,
      gaitCycleMs: CONTINUOUS_STEP_DURATION_MS * 2,
    });
    this.createFollowers();
    this.setupCamera();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      window.removeEventListener('blur', this.onWindowBlur);
      this.cancelMovementInput();
      this.continuousFarmActions.stop('scene-shutdown');
      // Phaser may already have removed the DisplayList; settle animation promises without drawing shutdown impacts.
      this.rig.shutdown();
      this.pixel32CandidateSprite?.destroy();
      this.pixel32CandidateSprite = null;
      for (const rig of this.npcRigs.values()) if (rig instanceof CharacterRig) rig.shutdown();
      this.residentWalks.clear();
      for (const state of this.companions.values()) state.rig.shutdown();
      this.npcRigs.clear();
      this.companions.clear();
      this.disposeMainActionHold?.();
      this.disposeMainActionHold = null;
      this.unsubscribeContinuousSetting?.();
      this.unsubscribeContinuousSetting = null;
      this.touchControls.dispose();
      this.interactionTargetGfx?.destroy();
      this.interactionTargetGfx = null;
      this.interactionTargetCell = null;
    });
    // 讀取存檔的提示等到鍵盤已經接上才顯示：提示出現時，按鍵一定會被接到（載入素材的期間按的鍵不算）。
    // 新遊戲則提示玩家可以按 ? 看操作說明（訊息列在新遊戲開場是空的）。
    if (this.deps.session.restored) this.deps.hud.messages(['已讀取存檔，繼續遊玩。']);
    else this.deps.hud.messages(['按 ? 看操作說明']);
    this.refresh();
    // 鍵盤監聽已掛上、畫面也已更新：通知開機流程顯示畫布（畫布在這之前是隱藏的，見 main.ts）。
    this.deps.onReady();
  }

  /** 天色與天氣的遮罩與粒子：固定在畫面上（不隨鏡頭移動）。 */
  private createSky(): void {
    const { width, height } = this.scale.gameSize;
    // 填色不透明度為 1，明暗只由 setAlpha 控制（填色若為 0 會把 setAlpha 乘成 0，什麼也看不見）。
    this.nightShade = this.add.rectangle(0, 0, width, height, NIGHT_COLOR, 1).setOrigin(0).setScrollFactor(0).setDepth(DEPTH_SKY);
    this.weatherShade = this.add.rectangle(0, 0, width, height, WEATHER_COLOR, 1).setOrigin(0).setScrollFactor(0).setDepth(DEPTH_SKY);
    this.weatherGfx = this.add.graphics().setScrollFactor(0).setDepth(DEPTH_SKY + 1);
  }

  /** 鏡頭跟隨玩家：中央留一塊死區，玩家走到邊緣才捲動；邊界在換地圖時重設。 */
  private setupCamera(): void {
    const camera = this.cameras.main;
    const applyLayout = (layout: ReturnType<ResponsiveLayoutController['get']>): void => {
      const profile = renderProfileFor(new URLSearchParams(window.location.search).get('renderProfile'), import.meta.env.DEV);
      const pixelViewport = calculatePixelViewportPolicy({
        container: layout.worldRect,
        safeArea: layout.safeRect,
        dpr: window.devicePixelRatio || 1,
        orientation: layout.orientation,
        profile: profile.id,
        input: layout.pointer.coarse ? 'touch' : 'pointer',
      });
      const canvasHost = this.game.canvas.parentElement;
      if (canvasHost) {
        if (profile.id === 'legacy' && !layout.pointer.coarse) delete canvasHost.dataset.pixelProfile;
        else canvasHost.dataset.pixelProfile = profile.id;
      }
      if (this.scale.gameSize.width !== pixelViewport.renderResolution.width
        || this.scale.gameSize.height !== pixelViewport.renderResolution.height) {
        this.scale.setGameSize(pixelViewport.renderResolution.width, pixelViewport.renderResolution.height);
      }
      const designSize = pixelViewport.renderResolution;
      const viewport = cameraViewportFor(layout, designSize);
      camera.setViewport(viewport.x, viewport.y, viewport.width, viewport.height);
      this.nightShade?.setSize(designSize.width, designSize.height);
      this.weatherShade?.setSize(designSize.width, designSize.height);
      const zoom = profile.id === 'legacy'
        ? mapZoomFor({ cameraWidth: camera.width, coarse: layout.pointer.coarse, portrait: layout.orientation === 'portrait' })
        : camera.width / (pixelViewport.worldTilesVisible.width * TILE_SIZE);
      camera.setZoom(zoom);
      const zone = deadzoneOf({ width: camera.width / camera.zoom, height: camera.height / camera.zoom });
      camera.setDeadzone(zone.width, zone.height);
      const state = this.deps.session.state;
      this.frameCamera(this.deps.index.map(state.mapId), state.player);
    };
    const unsubscribeLayout = this.deps.responsive.subscribe(applyLayout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribeLayout);
    // 跟隨骨架的軸心（腳底中心，不含身體起伏，鏡頭才不會跟著抖）；位移量把跟隨點移到格子中心。
    camera.startFollow(this.rig.root, true, FOLLOW_LERP, FOLLOW_LERP, 0, TILE_SIZE / 2);
    if (import.meta.env.DEV) {
      window.__dewhollow = {
        cameraScroll: () => ({ x: camera.scrollX, y: camera.scrollY }),
        pixelViewport: () => this.pixelViewportDebugInfo(),
        movement: () => ({
          heldDirection: this.movementScheduler?.heldDirection ?? null,
          blockedDirection: this.movementScheduler?.blockedDirection ?? null,
          moving: Boolean(this.movementScheduler?.step),
          pending: Boolean(this.movementScheduler?.pendingRequest),
          queuedTaps: this.movementScheduler?.queuedTaps.length ?? 0,
          tile: { ...this.deps.session.state.player },
        }),
        worldGeneration: () => this.worldGeneration,
        responsiveLayout: () => this.deps.responsive.get(),
        interaction: () => resolveInteraction(this.deps.session.state, this.deps.index),
        interactionTargetMarker: () => ({
          visible: this.interactionTargetGfx?.visible ?? false,
          target: this.interactionTargetCell ? { ...this.interactionTargetCell } : null,
          x: this.interactionTargetGfx?.x ?? 0,
          y: this.interactionTargetGfx?.y ?? 0,
          width: TILE_SIZE,
          height: TILE_SIZE,
        }),
        cameraView: () => ({ x: camera.x, y: camera.y, width: camera.width / camera.zoom, height: camera.height / camera.zoom, zoom: camera.zoom, bounds: { ...camera.getBounds() } }),
        mapId: () => this.deps.session.state.mapId,
        sprites: () => this.debugSprites(),
        candidateArt: () => this.candidateArtDebugInfo(),
        pose: () => ({ ...this.rig.currentPose() }),
        rig: () => {
          const { view, mode, visible } = this.rig.debugInfo();
          return { view, mode, visible: [...visible] };
        },
        setPose: (view, step, u) => this.rig.preview(view, step, u),
        pauseScene: (options) => new Promise<void>((resolve) => {
          this.events.once(Phaser.Scenes.Events.PAUSE, () => {
            if (!options?.preservePose) {
              const freezePose = (rig: CharacterRig): void => {
                rig.preview(rig.debugInfo().view, 0, 0);
              };
              freezePose(this.rig);
              for (const { rig } of this.visibleRigs()) freezePose(rig);
            }
            // Stable test captures need a deterministic weather particle phase as well as frozen actors.
            this.updateSky(0);
            resolve();
          });
          // Preserve the exact in-flight actor overlap requested by depth snapshots.
          // Scene pause is processed on the game loop; stop tween advancement first
          // so the actors cannot finish their crossing before the PAUSE event.
          if (options?.preservePose) this.tweens.pauseAll();
          this.scene.pause();
        }),
        renderCompat: () => this.registry.get(RENDER_COMPAT_KEY) as RenderCompatInfo,
        actors: () => this.debugActors(),
        setOthersHidden: (hidden) => this.setOthersHidden(hidden),
        setPlayerHidden: (hidden) => this.rig.root.setVisible(!hidden),
        emotes: () => this.debugEmotes(),
        effectLog: () => this.effectEntries.map((e) => ({ ...e })),
        continuousFarmActionsRunning: () => this.continuousFarmActions.isRunning,
        continuousFarmActionsStopReason: () => this.continuousFarmActions.lastStopReason,
        continuousFarmCancelSource: () => this.lastContinuousCancelReason,
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
        pixel32CandidateRuntime: () => ({
          enabled: this.pixel32CandidateRuntime,
          mapFrames: this.pixel32CandidateRuntime && this.textures.exists(PIXEL32_MAP_ATLAS_KEY)
            ? this.textures.get(PIXEL32_MAP_ATLAS_KEY).getFrameNames()
            : [],
          animationFrames: this.pixel32CandidateRuntime && this.textures.exists(PIXEL32_ANIMATION_ATLAS_KEY)
            ? this.textures.get(PIXEL32_ANIMATION_ATLAS_KEY).getFrameNames()
            : [],
          playerFrame: this.pixel32CandidateSprite?.frame.name ?? null,
        }),
      };
    }
  }

  /** 換地圖時：重設邊界並直接把鏡頭放到玩家身上，避免從上一張圖的位置慢慢滑過來。 */
  private frameCamera(map: MapDef, tile: { x: number; y: number }): void {
    const camera = this.cameras.main;
    const bounds = cameraBounds(
      { width: map.width * TILE_SIZE, height: map.height * TILE_SIZE },
      { width: camera.width / camera.zoom, height: camera.height / camera.zoom },
    );
    camera.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    const center = centerOf(tile.x, tile.y);
    camera.centerOn(center.x, center.y);
  }

  private pixelViewportDebugInfo() {
    const camera = this.cameras.main;
    const layout = this.deps.responsive.get();
    const profile = renderProfileFor(new URLSearchParams(window.location.search).get('renderProfile'), import.meta.env.DEV);
    const pixelViewport = calculatePixelViewportPolicy({
      container: layout.worldRect,
      safeArea: layout.safeRect,
      dpr: window.devicePixelRatio || 1,
      orientation: layout.orientation,
      profile: profile.id,
      input: layout.pointer.coarse ? 'touch' : 'pointer',
    });
    return {
      profile: profile.id,
      worldTilesVisible: { ...pixelViewport.worldTilesVisible },
      renderResolution: { ...pixelViewport.renderResolution },
      cssScale: pixelViewport.cssScale,
      devicePixelScale: pixelViewport.devicePixelScale,
      actualWorldTilesVisible: { width: camera.width / camera.zoom / TILE_SIZE, height: camera.height / camera.zoom / TILE_SIZE },
      actualCanvasResolution: { width: this.game.canvas.width, height: this.game.canvas.height },
      cameraZoom: camera.zoom,
    };
  }

  private currentRenderProfile() {
    return renderProfileFor(new URLSearchParams(window.location.search).get('renderProfile'), import.meta.env.DEV);
  }

  private resolveCandidateFrame(assetId: string, cropStage?: CandidateCropStage) {
    const candidate = resolveCandidateArt(this.currentRenderProfile().id, assetId, cropStage);
    const activeCandidate = this.registry.get('gate1-candidate-id') as CandidateId | null | undefined;
    if (!candidate || candidate.candidate !== activeCandidate || !this.textures.exists(candidate.atlas)) return null;
    return this.textures.get(candidate.atlas).has(candidate.frame) ? candidate : null;
  }

  private candidateArtDebugInfo() {
    const profile = this.currentRenderProfile().id;
    const activeCandidate = this.registry.get('gate1-candidate-id') as CandidateId | null | undefined ?? null;
    const candidateAssetIds = this.deps.assets.assets
      .filter((entry) => this.resolveCandidateFrame(entry.id) !== null)
      .map((entry) => entry.id);
    const fallbackAssetIds = this.deps.assets.assets
      .filter((entry) => this.resolveCandidateFrame(entry.id) === null)
      .map((entry) => entry.id);
    const texture = this.textures.exists('gate1-candidate-atlas')
      ? this.textures.get('gate1-candidate-atlas')
      : null;
    return {
      profile,
      candidate: activeCandidate,
      candidateAssetIds,
      fallbackAssetIds,
      registeredFrames: texture ? Object.keys(texture.frames).filter((key) => key !== '__BASE') : [],
    };
  }

  /** 虛擬按鍵直接送出語意動作；按鍵重綁只影響鍵盤 adapter。 */
  private pressAction(action: ActionId): void {
    if (!isMovementAction(action)) this.continuousFarmActions.stop('non-movement-touch-action');
    void this.handleAction(action);
  }

  private openToolSeedSelector(mode: 'tool' | 'seed', wheel: boolean, pointer?: HeldPointerStart): void {
    if (this.hasTouchInputBlocker()) return;
    this.touchControls.cancelAll();
    this.toolSeedSelector.open(mode, wheel, this.deps.session.state, pointer);
  }

  /** Resolve the latest held keyboard/touch direction into one presentation scheduler. */
  private setMovementInput(source: string, direction: Direction | null): void {
    const alreadyHeld = this.unifiedMovementInput.heldDirections.some((held) => held.source === source);
    if (direction === null) this.unifiedMovementInput = releaseDirection(this.unifiedMovementInput, source);
    else this.unifiedMovementInput = holdDirection(this.unifiedMovementInput, source, direction);
    if (this.movementScheduler) {
      this.movementScheduler = setMovementIntent(this.movementScheduler, activeDirection(this.unifiedMovementInput));
      if (direction !== null && !alreadyHeld && !isJoystickMovementSource(source)
        && (this.movementScheduler.step || this.movementScheduler.pendingRequest)) {
        this.movementScheduler = queueMovementTap(this.movementScheduler, direction);
      }
    }
    if (direction !== null) this.requestMovementStep();
  }

  private releaseMovementInput(source: string): void {
    this.unifiedMovementInput = releaseDirection(this.unifiedMovementInput, source);
    if (this.movementScheduler) {
      this.movementScheduler = setMovementIntent(this.movementScheduler, activeDirection(this.unifiedMovementInput));
    }
  }

  /** Clear every source and settle on the authoritative domain tile after focus loss or a blocker. */
  private cancelMovementInput(): void {
    this.unifiedMovementInput = cancelUnifiedInput(this.unifiedMovementInput);
    this.keyboardMovementSources.clear();
    this.deferredPlayerAction?.resolve(null);
    this.deferredPlayerAction = null;
    if (!this.movementScheduler) return;
    this.movementScheduler = cancelMovement(this.movementScheduler);
    const player = this.deps.session.state.player;
    this.movementScheduler = {
      ...this.movementScheduler,
      committedTile: { x: player.x, y: player.y },
      visualPosition: { x: player.x, y: player.y },
      facing: player.facing,
    };
    const stand = standOf(player.x, player.y);
    this.rig?.root.setPosition(stand.x, stand.y);
    this.rig?.preview(player.facing, 0, 0);
  }

  private requestMovementStep(): void {
    const current = this.movementScheduler;
    if (!current || this.hasTouchInputBlocker()) return;
    const proposal = requestNextStep(current);
    if (!proposal) return;
    this.movementScheduler = proposal.state;
    const mapId = this.deps.session.state.mapId;
    void this.run({ type: 'move', direction: proposal.request.direction }).then((outcome) => {
      const current = this.movementScheduler;
      if (!current || current.pendingRequest?.id !== proposal.request.id) return;
      const state = this.deps.session.state;
      const player = state.player;
      const sameMap = state.mapId === mapId;
      const reachedStep = sameMap && player.x === proposal.request.to.x && player.y === proposal.request.to.y;
      const teleportedWithinMap = sameMap && (player.x !== proposal.request.from.x || player.y !== proposal.request.from.y)
        && !reachedStep;
      if (outcome && reachedStep) {
        this.movementScheduler = commitStep(current, proposal.request.id);
      } else if (outcome && teleportedWithinMap) {
        // A door can change coordinates while keeping the same map ID (the greenhouse is a farm area).
        this.movementScheduler = createMovementScheduler({ x: player.x, y: player.y }, {
          initialFacing: player.facing,
          stepDurationMs: CONTINUOUS_STEP_DURATION_MS,
          gaitCycleMs: CONTINUOUS_STEP_DURATION_MS * 2,
        });
        const stand = standOf(player.x, player.y);
        this.rig.root.setPosition(stand.x, stand.y);
        this.rig.preview(player.facing, 0, 0);
        this.frameCamera(this.deps.index.map(state.mapId), player);
      } else {
        this.movementScheduler = rejectStep(current, proposal.request.id);
      }
    });
  }

  private movementIsActive(): boolean {
    return Boolean(
      this.movementScheduler?.step
      || this.movementScheduler?.pendingRequest
      || this.movementScheduler?.queuedTaps.length
      || this.movementScheduler?.heldDirection,
    );
  }

  private runDeferredPlayerAction(): void {
    if (this.deferredPlayerActionRunning || this.movementIsActive()) return;
    const action = this.deferredPlayerAction;
    if (!action) return;
    this.deferredPlayerAction = null;
    this.deferredPlayerActionRunning = true;
    void this.run(action.command, action.waitForFarmAnimation).then(action.resolve).finally(() => {
      this.deferredPlayerActionRunning = false;
    });
  }

  /** 目前的效果開關：系統「減少動態」或玩家關掉的效果都不出現（見 accessibility.ts）。 */
  private effectGates() {
    return reducedEffects(prefersReducedMotion(), this.deps.settings.get().effects);
  }

  private async handleKey(event: KeyLike): Promise<void> {
    if (this.settingsPanel.isCapturing()) {
      // 正在改鍵：這一下按下的就是新按鍵（Esc 取消，修飾鍵忽略），不觸發任何遊戲動作。
      event?.preventDefault();
      this.settingsPanel.captureKey(event.key);
      return;
    }
    // 按鍵只查偏好的按鍵表（見 domain/keybindings.ts），不寫死字元。
    const action = actionForKey(this.deps.settings.get().bindings, event.key);
    const direction = action && action in MOVE_ACTIONS ? MOVE_ACTIONS[action as ActionId] : undefined;
    if (direction) {
      if (this.hasTouchInputBlocker()) {
        event.preventDefault();
        this.cancelMovementInput();
        return;
      }
      const source = `keyboard:${event.key.toLowerCase()}`;
      this.keyboardMovementSources.add(source);
      this.setMovementInput(source, direction);
      event.preventDefault();
      return;
    }
    await this.handleAction(action, event);
  }

  /** 鍵盤與觸控共用語意動作入口；鍵盤 adapter 保留自訂按鍵與 Esc 語意。 */
  private async handleAction(action: ActionGateAction | null, event?: KeyLike, commandOverride?: Command, waitForFarmAnimation = false): Promise<CommandOutcome | null> {
    const { hud, sounds } = this.deps;
    if (action !== 'interact' && !isMovementAction(action)) this.continuousFarmActions.stop('non-farm-action');
    if (this.settingsPanel.isCapturing()) return null;
    if (action === 'mute') {
      // 靜音是玩家的偏好，不是遊戲指令，所以不經過應用層。
      event?.preventDefault();
      const muted = sounds.toggleMute();
      hud.messages([muted ? '已靜音（按 M 開啟音效）' : '已開啟音效（按 M 靜音）']);
      return null;
    }
    if (action === 'music') {
      // 背景音樂預設不播放，由玩家按 B 開始（瀏覽器要求使用者手勢才能出聲）。
      event?.preventDefault();
      const playing = this.deps.music.toggle();
      hud.messages([playing ? '背景音樂開始播放（按 B 暫停）' : '背景音樂已暫停（按 B 播放）']);
      return null;
    }
    const openGroup = this.modalGroups.find((group) => group.some((panel) => panel.isOpen()));
    if (!action) {
      // Escape 不一定綁定成遊戲動作；保留鍵盤的原生面板關閉行為。
      if (openGroup && event?.key === 'Escape') {
        event.preventDefault();
        this.touchControls.cancelAll();
        for (const panel of openGroup) panel.close();
      }
      return null;
    }
    const decision = gateAction(action, {
      sceneActive: this.scene.isActive(),
      settingsCapturing: this.settingsPanel.isCapturing(),
      heartEventOpen: this.heartEventPanel.isOpen(),
      reelPending: this.reelTimer !== null,
      starPending: this.starTimer !== null,
      modalOpen: openGroup !== undefined,
      actionInProgress: this.playerActionInProgress,
    }, event?.key === 'Escape');
    if (openGroup || this.heartEventPanel.isOpen() || this.reelTimer !== null || this.starTimer !== null || !this.scene.isActive()) {
      this.touchControls.cancelAll();
    }
    if (decision === 'ignore') return null;
    if (decision === 'close-modal') {
      event?.preventDefault();
      for (const panel of openGroup ?? []) panel.close();
      return null;
    }
    if (decision === 'finish-reel') {
      event?.preventDefault();
      this.finishReel(true);
      return null;
    }
    if (decision === 'finish-star') {
      event?.preventDefault();
      this.finishStar(performance.now() - this.starStartedAt);
      return null;
    }
    if (action === 'help') {
      // 說明頁：操作按鍵、版本號、更新日誌與隱私說明；不花體力與時間。
      event?.preventDefault();
      this.touchControls.cancelAll();
      this.deps.help.open();
      return null;
    }
    if (action === 'saves') {
      // 存檔槽：讀取、新遊戲、刪除、匯出與匯入；不花體力與時間。
      event?.preventDefault();
      this.touchControls.cancelAll();
      void this.deps.saves.open();
      return null;
    }
    if (action === 'settings') {
      // 設定：改按鍵、字級、色盲模式、閃光與震動、觸控；不花體力與時間。
      event?.preventDefault();
      this.touchControls.cancelAll();
      this.settingsPanel.open();
      return null;
    }
    if (action === 'skills') {
      // 技能與天賦面板：不花體力與時間，不經過應用層的指令。
      event?.preventDefault();
      this.touchControls.cancelAll();
      this.skillPanel.toggle(this.deps.session.state);
      return null;
    }
    if (action === 'residents') {
      // 居民與好感面板：不花體力與時間，不經過應用層的指令。
      event?.preventDefault();
      this.touchControls.cancelAll();
      this.residentPanel.toggle(this.deps.session.state);
      return null;
    }
    if (action === 'collection') {
      // 圖鑑與成就面板：不花體力與時間，不經過應用層的指令。
      event?.preventDefault();
      this.touchControls.cancelAll();
      this.collectionPanel.open(this.deps.session.state);
      return null;
    }
    if (action === 'quests') {
      // 委託與佈告欄面板：不花體力與時間，不經過應用層的指令。
      event?.preventDefault();
      this.touchControls.cancelAll();
      this.questPanel.toggle(this.deps.session.state);
      return null;
    }
    const direction = action && action in MOVE_ACTIONS ? MOVE_ACTIONS[action as ActionId] : undefined;
    const mappedCommand = action && action in COMMAND_ACTIONS ? COMMAND_ACTIONS[action as ActionId] : undefined;
    const command: Command | undefined = commandOverride ?? (direction ? { type: 'move', direction } : mappedCommand);
    if (!command) return null;
    event?.preventDefault();
    if (this.movementIsActive()) {
      return new Promise((resolve) => {
        if (this.deferredPlayerAction) {
          resolve(null);
          return;
        }
        this.deferredPlayerAction = { command, waitForFarmAnimation, resolve };
      });
    }
    let run: Promise<CommandOutcome | null>;
    try {
      // run() applies the command synchronously before its first await; keep the gate closed only
      // across that state transition, not while an automatic save finishes in the background.
      this.playerActionInProgress = true;
      run = this.run(command, waitForFarmAnimation);
    } finally {
      this.playerActionInProgress = false;
    }
    return run;
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

  /** 夜釣星星甩竿成功：頭上冒出驚嘆號，畫面上方出現計量條，一圈之內按 x 收網。 */
  private startStarGame(): void {
    const rules = this.deps.index.festivals.find((f) => f.stars)?.stars;
    if (!rules) return;
    this.showEmote('player', 'surprise');
    this.starStartedAt = performance.now();
    this.starTimer = this.time.delayedCall(rules.cycleMs, () => this.finishStar(null));
  }

  /** 收網：elapsedMs 為按下的時刻（null 表示時限內沒按）；由應用層判斷有沒有接到。 */
  private finishStar(elapsedMs: number | null): void {
    this.starTimer?.remove(false);
    this.starTimer = null;
    this.starMeter.clear();
    void this.run({ type: 'catchStar', elapsedMs });
  }

  /** 計量條：時機區間用亮色標出，星星的位置是一條白線，每一畫面更新。 */
  private drawStarMeter(): void {
    this.starMeter.clear();
    const rules = this.deps.index.festivals.find((f) => f.stars)?.stars;
    if (!this.starTimer || !rules) return;
    const elapsed = performance.now() - this.starStartedAt;
    const x = (this.scale.gameSize.width - STAR_METER_WIDTH) / 2;
    const y = 40;
    this.starMeter.fillStyle(0x000000, 0.5).fillRect(x - 4, y - 4, STAR_METER_WIDTH + 8, 16);
    const zone = rules.zone;
    this.starMeter.fillStyle(0xffe38a, 0.9).fillRect(x + STAR_METER_WIDTH * zone.from, y, STAR_METER_WIDTH * (zone.to - zone.from), 8);
    this.starMeter.fillStyle(0xffffff, 1).fillRect(x + STAR_METER_WIDTH * starPhase(elapsed, rules.cycleMs) - 1, y - 3, 3, 14);
  }

  /** 夜市的晚上在廣場上空放煙火（只是演出；位置隨機，減少動態時由 fireworks.ts 改成靜態光點）。 */
  private maybeFirework(): void {
    const { session, index } = this.deps;
    const state = session.state;
    const open = openFestival(index.festivals, state.calendar);
    if (!open?.stars || state.mapId !== open.mapId) return;
    if (!this.effectGates().particles) return;
    this.fireworkCount += 1;
    const x = (2 + Math.random() * 12) * TILE_SIZE;
    const y = (1 + Math.random() * 3) * TILE_SIZE;
    playFirework(this, x, y, this.fireworkCount);
  }

  /** 把一個指令交給應用層，顯示訊息與效果，然後重畫。鍵盤與商店面板共用這條路。 */
  private async run(command: Command, waitForFarmAnimation = false): Promise<CommandOutcome | null> {
    const { hud, session, sounds } = this.deps;
    const previousMapId = session.state.mapId;
    const before = { ...session.state.player };
    const plotsBefore = session.state.plots;
    const inventoryBefore = session.state.inventory;
    let commandOutcome: CommandOutcome | null = null;
    try {
      const outcome = await session.dispatch(command);
      commandOutcome = outcome;
      hud.messages(outcome.messages);
      // 買或升級的結果也送到商店面板的結果行：面板開著時，底部的訊息列在手機上可能看不到。
      if (command.type === 'buy' || command.type === 'upgrade') {
        this.shopPanel.showMessage(outcome.messages.join('　'), outcome.events.some((event) => event.type === 'refused'));
      }
      if (command.type === 'cycleTool' || command.type === 'cycleSeed') sounds.play('click');
      const animations = this.playEvents(outcome.events, before, plotsBefore, inventoryBefore);
      if (waitForFarmAnimation) await animations;
    } catch (error) {
      hud.error(`存檔失敗：${error instanceof Error ? error.message : String(error)}`);
    }
    this.shopPanel.refresh(session.state);
    this.kitchenPanel.refresh(session.state);
    this.workshopPanel.refresh(session.state);
    this.workbenchPanel.refresh(session.state);
    this.skillPanel.refresh(session.state);
    this.questPanel.refresh(session.state);
    this.festivalPanel.refresh(session.state);
    this.repairPanel.refresh(session.state);
    this.collectionPanel.refresh(session.state);
    this.legacyPanel.refresh(session.state);
    this.refresh();
    if (session.state.mapId !== previousMapId || this.hasTouchInputBlocker()) this.touchControls.cancelAll();
    return commandOutcome;
  }

  private hasTouchInputBlocker(): boolean {
    return this.modalGroups.some((group) => group.some((panel) => panel.isOpen()))
      || this.heartEventPanel.isOpen()
      || this.reelTimer !== null
      || this.starTimer !== null
      || !this.scene.isActive();
  }

  /** 把應用層的事件轉成視覺效果。效果只在這裡播放，規則不受影響。 */
  private playEvents(
    events: readonly GameEvent[],
    before: { x: number; y: number },
    plotsBefore: PlotMap,
    inventoryBefore: Inventory,
  ): Promise<void> {
    const animations: Promise<void>[] = [];
    for (const event of events) {
      if (event.type === 'acted') {
        animations.push(this.playAction(event, plotsBefore, inventoryBefore));
      } else if (event.type === 'slept') {
        sleepEffect(this, this.deps.session.state.player.x, this.deps.session.state.player.y, this.effectGates().flash);
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
      } else if (event.type === 'bulletinOpened') {
        this.questPanel.open(this.deps.session.state);
      } else if (event.type === 'festivalOpened') {
        this.festivalPanel.open(this.deps.session.state);
      } else if (event.type === 'repairOpened') {
        this.repairPanel.open(this.deps.session.state);
      } else if (event.type === 'legacyOpened') {
        this.legacyPanel.open(this.deps.session.state);
      } else if (event.type === 'starLine') {
        this.startStarGame();
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
    return Promise.all(animations).then(() => undefined);
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
    footstepDust(this, x, y, style.footstep.dust, this.effectGates().particles);
    this.deps.sounds.play(style.footstep.sound);
    this.log(`step:${style.kind}`);
  }

  /**
   * 農務動作的回饋：有工具的動作（開墾、澆水、播種）揮工具，粒子與鏡頭微震等到「命中」那一刻才出現；
   * 沒有工具的動作（收成、出貨）維持原本的壓扁伸展，效果立刻出現。
   */
  private playAction(event: Extract<GameEvent, { type: 'acted' }>, plotsBefore: PlotMap, inventoryBefore: Inventory): Promise<void> {
    if (event.action === 'ship') {
      this.playShip(event, inventoryBefore);
      return Promise.resolve();
    }
    const reduced = prefersReducedMotion();
    const gates = this.effectGates();
    const key = plotKey(event.x, event.y);
    // 產量在事件發生當下就算好：命中可能晚於下一個動作（揮動被補播），那時背包已經包含後面動作的物品。
    const gains = YIELD_ACTIONS.has(event.action) ? gainedItems(inventoryBefore.stacks, this.deps.session.state.inventory.stacks) : [];
    const impact = (): void => {
      if (this.heldPlots.delete(key)) this.drawPlots(); // 命中：這一格才更新成動作後的樣子
      this.log(`effect:${event.action}`);
      this.deps.sounds.play(ACTION_SOUND[event.action]);
      if (event.action === 'harvest') this.pickUp(event.x, event.y, plotsBefore);
      playActionEffect(this, event.action, event.x, event.y, gates.particles);
      const shake = IMPACT_SHAKE[event.action];
      if (shake && gates.shake) {
        this.cameras.main.shake(shake.ms, shake.intensity);
        this.log('shake');
      }
      if (gains.length > 0) {
        yieldLabels(
          this,
          event.x,
          event.y,
          gains.map((gain) => `+${gain.count} ${this.deps.index.item(gain.itemId).name}`),
        );
      }
    };
    const tool = this.deps.tools.tools.find((t) => t.action === event.action);
    if (tool && this.rig.canSwing()) {
      const animation = this.rig.swing(tool, SWING_DURATION_MS, reduced, impact, () => {
        this.log(`swing:${event.action}`);
        this.deps.sounds.play('swing');
      });
      // swing() 可能已經補播了上一個被打斷的動作的命中，所以在它之後才凍結這一格。
      this.heldPlots.set(key, plotsBefore[key] ?? null);
      this.drawPlots();
      return animation;
    } else {
      this.rig.squash();
      impact();
      return Promise.resolve();
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
      playActionEffect(this, event.action, event.x, event.y, this.effectGates().particles);
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
    const interaction = resolveInteraction(state, this.deps.index);
    this.updateInteractionTargetMarker(interaction.target);
    this.deps.hud.setMainAction(
      this.deps.controls.interactionLabels[interaction.labelKey],
      interaction.action !== 'nothing',
    );

    const mapChanged = this.renderedMapId !== map.id;
    if (mapChanged) {
      this.cancelMovementInput();
      this.movementScheduler = createMovementScheduler({ x: state.player.x, y: state.player.y }, {
        initialFacing: state.player.facing,
        stepDurationMs: CONTINUOUS_STEP_DURATION_MS,
        gaitCycleMs: CONTINUOUS_STEP_DURATION_MS * 2,
      });
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
    this.syncDecor(state.mapId);
    this.syncWearing();
    this.syncResidents();
    this.drawPlots();
    this.movePlayer(state.player.x, state.player.y);
    this.moveFollowers(map, state.player, mapChanged);
    this.playerTile = { x: state.player.x, y: state.player.y };
    this.residentPanel.refresh(state);
    this.questPanel.refresh(state);
    this.heartEventPanel.sync(state);
  }

  /** Render the existing descriptor target without adding pointer input or changing interaction semantics. */
  private updateInteractionTargetMarker(target: Point | null): void {
    if (!this.interactionTargetGfx || !this.interactionTargetGfx.active) {
      this.interactionTargetGfx = this.add.graphics().setDepth(DEPTH_SKY - 1);
    }
    const marker = this.interactionTargetGfx;
    marker.clear();
    this.interactionTargetCell = target ? { ...target } : null;
    if (!target) {
      marker.setVisible(false);
      return;
    }

    marker.setPosition(target.x * TILE_SIZE, target.y * TILE_SIZE).setVisible(true);
    // Warm double outline remains readable over grass, soil and structures while leaving the tile visible.
    marker.lineStyle(3, 0xffe38a, 0.95).strokeRect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4);
    marker.lineStyle(1, 0xffffff, 0.8).strokeRect(6, 6, TILE_SIZE - 12, TILE_SIZE - 12);
  }

  /**
   * 居民依目前的行程站位（時段與天氣決定，見 application/residents.ts）。第一次出現時直接站上去；
   * 位置變了就走過去，所以村子看得到人在動；不在這張地圖或這個時段沒有行程的居民，從畫面上移開。
   */
  private syncResidents(): void {
    const state = this.deps.session.state;
    const map = this.deps.index.map(state.mapId);
    const present = new Set<string>();
    for (const placement of residentsOn(state, this.deps.index)) {
      present.add(placement.npcId);
      const stand = standOf(placement.x, placement.y);
      const view = this.npcRigs.get(placement.npcId);
      if (!view) {
        const created = this.createResidentView(placement.npcId);
        created.root.setDepth(DEPTH_RESIDENT);
        created.teleport(stand.x, stand.y);
        this.npcRigs.set(placement.npcId, created);
        continue;
      }
      if (view.root.x === stand.x && view.root.y === stand.y && !this.residentWalks.has(placement.npcId)) continue;
      this.walkResident(placement.npcId, view, map, { x: placement.x, y: placement.y });
    }
    for (const [id, view] of [...this.npcRigs]) {
      if (present.has(id)) continue;
      this.activeEmotes.get(id)?.handle.destroy();
      this.activeEmotes.delete(id);
      this.residentWalks.delete(id);
      view.destroy();
      this.npcRigs.delete(id);
    }
  }

  /** 居民沿可走格子逐格移動；無法抵達時沿用舊行為，直接到達行程站位。 */
  private walkResident(npcId: string, view: ResidentView, map: MapDef, goal: Point): void {
    const previous = this.residentWalks.get(npcId);
    if (previous?.goal.x === goal.x && previous.goal.y === goal.y) return;

    const run = ++this.residentRunCount;
    const current = { goal, run, inStep: previous?.inStep ?? false };
    this.residentWalks.set(npcId, current);
    // Tween 中的座標不是格心；等目前這一步走完再從確切格子重新找路，避免斜切障礙物。
    if (current.inStep) return;
    this.planResidentRoute(npcId, view, map, goal, run);
  }

  private planResidentRoute(npcId: string, view: ResidentView, map: MapDef, goal: Point, run: number): void {
    const route = findRoute(map, tileOfStand(view.root.x, view.root.y), goal);
    if (!route) {
      this.residentWalks.delete(npcId);
      const stand = standOf(goal.x, goal.y);
      view.teleport(stand.x, stand.y);
      return;
    }
    if (route.length === 0) {
      this.residentWalks.delete(npcId);
      return;
    }

    const stepTo = (index: number): void => {
      const active = this.residentWalks.get(npcId);
      if (!active || active.run !== run) return;
      const next = route[index];
      if (!next) {
        this.residentWalks.delete(npcId);
        return;
      }
      const stand = standOf(next.x, next.y);
      active.inStep = true;
      view.walkTo(stand.x, stand.y, MOVE_DURATION_MS, () => {
        const latest = this.residentWalks.get(npcId);
        if (!latest) return;
        latest.inStep = false;
        if (latest.run !== run) {
          this.planResidentRoute(npcId, view, map, latest.goal, latest.run);
          return;
        }
        stepTo(index + 1);
      });
    };
    stepTo(0);
  }

  /** 有骨架的居民（目前是毛毛）用骨架；其餘是占位色塊。 */
  private createResidentView(npcId: string): ResidentView {
    const def = this.deps.rigs.rigs.find((r) => r.id === npcId);
    if (def) return new CharacterRig(this, def, this.deps.assets);
    return new PlaceholderResident(this, `npc.${npcId}`, this.deps.assets);
  }

  /** 換季時重新染色草地（只在季節變了的時候動作）。 */
  private applySeason(season: Season): void {
    if (this.shownSeason === season) return;
    this.shownSeason = season;
    const tint = seasonGrassTint(season);
    for (const sprite of this.tileSprites) {
      if (sprite.groundImage.texture.key === 'tile.grass') sprite.groundImage.setTint(tint);
      else if (this.pixel32CandidateRuntime && sprite.groundImage.texture.key === PIXEL32_MAP_ATLAS_KEY) {
        this.applyAsset(sprite.groundImage, `tile.${sprite.ground}`);
      }
    }
  }

  /** 雞舍的雞、牛舍的牛、羊圈的羊：每隻坐在對應的座位上（座位順序見 slotsOf；住哪一群看地圖的 flock）。 */
  private syncAnimals(mapId: string): void {
    for (const sprite of this.animalSprites) sprite.destroy();
    this.animalSprites = [];
    const state = this.deps.session.state;
    const map = this.deps.index.map(mapId);
    if (!map.flock) return;
    const herd = map.flock === 'cows' ? state.cows : map.flock === 'sheep' ? state.sheep : state.animals;
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

  /** 小屋裡擺好的裝飾：每件一個色塊（占位，顏色見 decor-style.ts）；每次重畫時重建，件數很少。 */
  private syncDecor(mapId: string): void {
    for (const sprite of this.decorSprites) sprite.destroy();
    this.decorSprites = [];
    for (const piece of this.deps.session.state.decor[mapId] ?? []) {
      const center = centerOf(piece.x, piece.y);
      const block = this.add
        .rectangle(center.x, center.y, TILE_SIZE * 0.7, TILE_SIZE * 0.7, decorColorOf(piece.itemId))
        .setStrokeStyle(2, 0x3a2a1a)
        .setDepth(DEPTH_DECOR);
      this.decorSprites.push(block);
    }
  }

  /** 玩家身上穿的衣服或帽子：頭上一個小色塊（占位），跟著角色走（見 update）。穿戴不影響規則。 */
  private syncWearing(): void {
    const worn = this.deps.session.state.wearing[PLAYER_WEARER];
    if (!worn) {
      this.wearBadge?.destroy();
      this.wearBadge = null;
      return;
    }
    if (!this.wearBadge) {
      this.wearBadge = this.add.rectangle(0, 0, TILE_SIZE * 0.35, TILE_SIZE * 0.2, wearColorOf(worn)).setDepth(this.actorDepth(this.rig.footPosition().y, true) + 1);
    }
    this.wearBadge.setFillStyle(wearColorOf(worn));
    this.wearBadge.setDepth(this.actorDepth(this.rig.footPosition().y, true) + 1);
    this.moveWearBadge();
  }

  private moveWearBadge(): void {
    if (!this.wearBadge) return;
    const head = this.headOf(this.rig);
    this.wearBadge.setPosition(head.x, head.y - TILE_SIZE * 0.4);
    this.wearBadge.setDepth(this.actorDepth(this.rig.footPosition().y, true) + 1);
  }

  /** 玩家造成的地圖變化（砍樹、採野薄荷、隔日恢復）即時反映到地板與透明物件層。 */
  private syncWorldTiles(): void {
    const state = this.deps.session.state;
    for (const sprite of this.tileSprites) {
      const kind = effectiveKind(sprite.base, changeAt(state.worldChanges, state.mapId, sprite.x, sprite.y));
      const ground = isGroundLayer(kind) ? kind : sprite.ground;
      const groundKey = `tile.${ground}`;
      if (sprite.groundImage.texture.key !== groundKey) this.applyAsset(sprite.groundImage, groundKey);
      if (ground === 'grass' && this.shownSeason && sprite.groundImage.texture.key !== PIXEL32_MAP_ATLAS_KEY) {
        sprite.groundImage.setTint(seasonGrassTint(this.shownSeason));
      }
      else sprite.groundImage.clearTint();

      if (isGroundLayer(kind)) {
        sprite.objectImage?.setVisible(false);
      } else {
        const objectKey = `tile.${kind}`;
        if (!sprite.objectImage) {
          sprite.objectImage = this.image(objectKey, sprite.x, sprite.y, 1);
        } else {
          this.applyAsset(sprite.objectImage, objectKey);
        }
        this.placeObjectImage(sprite.objectImage, kind, sprite.y);
        sprite.objectImage.setVisible(true);
      }
    }
  }

  /** 換成面向的那一張圖；原地轉身時只換圖，不移動。 */
  private showFacing(facing: Direction): void {
    if (facing === this.shownFacing) return;
    this.shownFacing = facing;
    this.rig.setView(facing);
  }

  private drawMap(mapId: string): void {
    // Tree overlays live on the scene display list so their foot depth can sort
    // against actor roots. Destroy those roots explicitly before clearing the tile container.
    for (const sprite of this.tileSprites) {
      if (sprite.objectImage && sprite.objectImage.parentContainer !== this.world) sprite.objectImage.destroy();
    }
    this.world.removeAll(true);
    this.heldPlots.clear();
    this.tileSprites = [];
    const map = this.deps.index.map(mapId);

    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const tile = tileAt(map, x, y);
        if (!tile) continue;
        const ground = groundLayerFor(map, x, y);
        const groundImage = this.image(`tile.${ground}`, x, y, 0);
        const objectImage = isGroundLayer(tile.kind) ? undefined : this.image(`tile.${tile.kind}`, x, y, 1);
        this.tileSprites.push({ x, y, base: tile.kind, ground, groundImage, objectImage });
        this.world.add(groundImage);
        if (objectImage) this.placeObjectImage(objectImage, tile.kind, y);
      }
    }

    this.clearActors();
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
    this.residentWalks.clear();
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
      rig.root.setDepth(this.actorDepth(rig.footPosition().y, false)).setVisible(false);
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
    // 居民站的格子（依行程）與住在這裡的夥伴的格子，寵物都不能站。
    for (const placement of residentsOn(this.deps.session.state, this.deps.index)) taken.add(`${placement.x},${placement.y}`);
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
        const stage: CandidateCropStage = ratio < 0.25 ? 'seed' : ratio < 0.7 ? 'sprout' : 'mature';
        const sprite = this.image(`crop.${crop.id}`, x, y, 2, stage);
        const growthScale = 0.5 + 0.5 * ratio;
        const displayScale = sprite.texture.key === 'gate1-candidate-atlas'
          ? sprite.scaleX * growthScale
          : growthScale;
        sprite.setScale(displayScale);
        sprite.setAlpha(0.5 + 0.5 * ratio);
        sprite.setData('plot', true);
        this.world.add(sprite);
      }
    }
  }

  private movePlayer(x: number, y: number): void {
    if (this.movementScheduler) return;
    const stand = standOf(x, y);
    this.rig.walkTo(stand.x, stand.y, MOVE_DURATION_MS);
  }

  override update(time: number, delta: number): void {
    if (this.hasTouchInputBlocker()) {
      this.cancelMovementInput();
      this.touchControls.cancelAll();
    }
    this.updateSky(time);
    this.rig.update(delta);
    if (this.movementScheduler) {
      const wasMoving = this.movementScheduler.step !== null;
      this.movementScheduler = advanceMovement(this.movementScheduler, delta);
      const { x, y } = this.movementScheduler.visualPosition;
      const stand = standOf(x, y);
      this.rig.root.setPosition(stand.x, stand.y);
      if (this.movementScheduler.step) {
        const phase = this.movementScheduler.gaitPhase * 2;
        if (!this.rig.isBusy()) this.rig.preview(this.movementScheduler.step.direction, Math.floor(phase), phase % 1);
      } else if (wasMoving && !this.movementIsActive() && !this.rig.isBusy()) {
        this.rig.preview(this.movementScheduler.facing, 0, 0);
      }
      if (!this.movementScheduler.step && !this.movementScheduler.pendingRequest) this.requestMovementStep();
      this.runDeferredPlayerAction();
    }
    if (this.pixel32CandidateSprite) {
      const direction = (this.movementScheduler?.step?.direction ?? this.movementScheduler?.facing ?? this.shownFacing) as CandidateDirection;
      const motion = this.movementScheduler?.step ? 'walk' : 'idle';
      const frame = candidateFrameAt(direction, motion, time).frame;
      if (this.pixel32CandidateSprite.frame.name !== frame) this.pixel32CandidateSprite.setFrame(frame);
    }
    this.moveWearBadge();
    for (const rig of this.npcRigs.values()) rig.update(delta);
    for (const state of this.companions.values()) state.rig.update(delta);
    this.updateFollowerDepths();
    this.drawStarMeter();
  }

  /** 玩家與跟隨寵物依腳底 Y 排序；腳底較低者畫在前面，同腳底時玩家優先。 */
  private updateFollowerDepths(): void {
    this.rig.root.setDepth(this.actorDepth(this.rig.footPosition().y, true));
    for (const state of this.companions.values()) {
      if (!state.def.follows) continue;
      state.rig.root.setDepth(this.actorDepth(state.rig.footPosition().y, false));
    }
  }

  private actorDepth(footY: number, player: boolean): number {
    return DEPTH_ACTOR_BASE + footY / TILE_SIZE + (player ? DEPTH_PLAYER_TIE_BREAK : 0);
  }

  /** Tree overlays share the scene display list with actor roots, using the image bottom as their foot anchor. */
  private placeObjectImage(image: Phaser.GameObjects.Image, kind: TileKind, tileY: number): void {
    if (kind !== 'tree') {
      if (image.parentContainer !== this.world) this.world.add(image);
      image.setDepth(1);
      return;
    }

    if (image.parentContainer === this.world) this.world.remove(image);
    // A tree at the same foot Y renders just ahead of the player; lower actors
    // still win naturally because their per-tile depth step is much larger.
    const footY = image.getBounds().bottom || (tileY + 1) * TILE_SIZE;
    image.setDepth(this.actorDepth(footY, true) + DEPTH_TREE_TIE_BREAK);
    this.children.bringToTop(image);
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
    if (!kind || !this.effectGates().particles) return;
    const base = weather === 'storm' ? 70 : kind === 'streak' ? 46 : 30;
    const count = prefersReducedMotion() ? Math.ceil(base / 4) : base;
    for (let i = 0; i < count; i += 1) {
      const p = particlePosition(i, time, this.scale.gameSize.width, this.scale.gameSize.height, kind);
      if (kind === 'streak') {
        this.weatherGfx.lineStyle(1, 0xcfe6ff, 0.55).lineBetween(p.x, p.y, p.x - 3, p.y + 8);
      } else if (kind === 'flake') {
        this.weatherGfx.fillStyle(0xffffff, 0.9).fillCircle(p.x, p.y, 1.6);
      } else {
        this.weatherGfx.fillStyle(0x7fae6b, 0.9).fillCircle(p.x, p.y, 2.4);
      }
    }
  }

  /**
   * 把素材套到圖片上：換成實際的貼圖（翻轉素材用原圖）、水平翻轉、顯示縮放（例如 2x 母版 0.5 倍），
   * 並記下基準縮放，讓壓扁伸展等效果以它為準。
   */
  private applyAsset(image: Phaser.GameObjects.Image, assetId: string): void {
    const pixel32Frame = this.pixel32MapFrame(assetId, image.x, image.y);
    if (pixel32Frame) {
      image.setTexture(PIXEL32_MAP_ATLAS_KEY, pixel32Frame);
      image.setFlipX(false);
      image.setScale(2);
      image.setData('baseScale', 2);
      return;
    }
    const candidate = this.resolveCandidateFrame(assetId);
    if (candidate) {
      image.setTexture(candidate.atlas, candidate.frame);
      image.setFlipX(false);
      image.setScale(candidate.scale);
      image.setData('baseScale', candidate.scale);
      return;
    }
    const { textureId, flipX, scale } = resolveAsset(this.deps.assets, assetId);
    image.setTexture(textureId);
    image.setFlipX(flipX);
    image.setScale(scale);
    image.setData('baseScale', scale);
  }

  private debugSprites(): SpriteDebugInfo[] {
    const player = this.rig.debugInfo();
    const tileRootImages = this.tileSprites
      .map((sprite) => sprite.objectImage)
      .filter((image): image is Phaser.GameObjects.Image => image !== undefined && image.parentContainer === null);
    const images = [
      ...this.world.getAll().filter((c): c is Phaser.GameObjects.Image => c instanceof Phaser.GameObjects.Image),
      ...tileRootImages,
    ];
    const others = images.map((image) => {
      const bounds = image.getBounds();
      return {
        key: image.texture.key,
        frame: image.frame?.name ?? null,
        left: Math.round(bounds.x),
        top: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        flipX: image.flipX,
        depth: image.depth,
      };
    });
    const asSprite = (info: RigDebugInfo, depth: number): SpriteDebugInfo => ({
      key: info.key,
      frame: null,
      left: info.left,
      top: info.top,
      width: info.width,
      height: info.height,
      flipX: info.flipX,
      depth,
    });
    const actors = this.visibleRigs().map(({ rig }) => asSprite(rig.debugInfo(), rig.root.depth));
    return [asSprite(player, this.rig.root.depth), ...actors, ...others];
  }

  /** 開發用：藏起或恢復玩家以外的角色。恢復時，沒有地方可站的跟隨寵物仍然保持隱藏。 */
  private setOthersHidden(hidden: boolean): void {
    for (const rig of this.npcRigs.values()) rig.root.setVisible(!hidden);
    for (const state of this.companions.values()) state.rig.root.setVisible(!hidden && state.tile !== null);
  }

  /** 看得見的居民與夥伴骨架（不含玩家）。 */
  private visibleRigs(): { id: string; rig: CharacterRig }[] {
    const list: { id: string; rig: CharacterRig }[] = [];
    for (const [id, rig] of this.npcRigs) if (rig instanceof CharacterRig) list.push({ id, rig });
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
        footX: foot.x,
        footY: foot.y,
        tileX: Math.floor(foot.x / TILE_SIZE),
        tileY: Math.round(foot.y / TILE_SIZE) - 1,
        left: info.left,
        top: info.top,
        width: info.width,
        height: info.height,
        pose: { ...rig.currentPose() },
        tool: rig.currentTool(),
        busy: rig.isBusy() || (id === 'player' && Boolean(
          this.movementScheduler?.step
          || this.movementScheduler?.pendingRequest
          || this.movementScheduler?.queuedTaps.length
          || this.movementScheduler?.heldDirection,
        )),
        depth: rig.root.depth,
      };
    };
    return [describe('player', this.rig), ...this.visibleRigs().map(({ id, rig }) => describe(id, rig))];
  }

  /** 格子的圖：2x 母版以 0.5 倍顯示，仍是 64 px 的格子（占位圖的縮放是 1）。 */
  private image(key: string, x: number, y: number, depth: number, cropStage?: CandidateCropStage): Phaser.GameObjects.Image {
    const pixel32Frame = this.pixel32MapFrame(key, x * TILE_SIZE, y * TILE_SIZE);
    if (pixel32Frame) {
      return this.add
        .image(x * TILE_SIZE, y * TILE_SIZE, PIXEL32_MAP_ATLAS_KEY, pixel32Frame)
        .setOrigin(0)
        .setScale(2)
        .setDepth(depth);
    }
    const candidate = this.resolveCandidateFrame(key, cropStage);
    if (candidate) {
      return this.add
        .image(x * TILE_SIZE, y * TILE_SIZE, candidate.atlas, candidate.frame)
        .setOrigin(0)
        .setScale(candidate.scale)
        .setDepth(depth);
    }
    const { textureId, scale } = resolveAsset(this.deps.assets, key);
    return this.add
      .image(x * TILE_SIZE, y * TILE_SIZE, textureId)
      .setOrigin(0)
      .setScale(scale)
      .setDepth(depth);
  }

  private pixel32MapFrame(assetId: string, worldX: number, worldY: number): string | null {
    if (!this.pixel32CandidateRuntime || !this.textures.exists(PIXEL32_MAP_ATLAS_KEY)) return null;
    const map = this.deps.index.map(this.deps.session.state.mapId);
    const frame = pixel32MapFrameFor(
      assetId,
      this.deps.session.state.calendar.season,
      map,
      Math.round(worldX / TILE_SIZE),
      Math.round(worldY / TILE_SIZE),
      (tileX, tileY) => {
        const tile = tileAt(map, tileX, tileY);
        return tile ? effectiveKind(tile.kind, changeAt(this.deps.session.state.worldChanges, map.id, tileX, tileY)) : null;
      },
    );
    return frame && this.textures.get(PIXEL32_MAP_ATLAS_KEY).has(frame) ? frame : null;
  }
}
