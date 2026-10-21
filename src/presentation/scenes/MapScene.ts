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
import type { Hud } from '../hud';
import { cameraBounds, deadzoneOf } from '../camera';
import { TILE_SIZE } from '../constants';
import { RENDER_COMPAT_KEY } from '../apply-render-compat';
import { CharacterRig, type RigDebugInfo } from '../character-rig';
import { centerOf, footOf, standOf } from '../layout';
import { emotesForEvent, type EmoteKind } from '../emote-defs';
import { playEmote, type EmoteHandle } from '../emote';
import { footstepDust, playActionEffect, sleepEffect } from '../effects';
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

/** 揮一次工具的時間；命中的那一刻由 tool-swing.ts 的 impactAt 決定。 */
const SWING_DURATION_MS = 420;

/** 居民與夥伴被搭話時，原地做一步的時間（比走一格慢，才看得清楚）。 */
const REACT_DURATION_MS = 320;

/** 圖層深度：居民 5、跟隨的寵物 9（在玩家後面）、玩家 10。 */
const DEPTH_RESIDENT = 5;
const DEPTH_FOLLOWER = 9;
const DEPTH_PLAYER = 10;

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
    const plotsBefore = session.state.plots;
    try {
      const outcome = await session.dispatch(command);
      hud.messages(outcome.messages);
      this.playEvents(outcome.events, before, plotsBefore);
    } catch (error) {
      hud.error(`存檔失敗：${error instanceof Error ? error.message : String(error)}`);
    }
    this.refresh();
  }

  /** 把應用層的事件轉成視覺效果。效果只在這裡播放，規則不受影響。 */
  private playEvents(events: readonly GameEvent[], before: { x: number; y: number }, plotsBefore: PlotMap): void {
    for (const event of events) {
      if (event.type === 'acted') {
        this.playAction(event, plotsBefore);
      } else if (event.type === 'slept') {
        sleepEffect(this, this.deps.session.state.player.x, this.deps.session.state.player.y);
      } else if (event.type === 'talked') {
        this.reactToTalk(event.npcId);
      }
      for (const emote of emotesForEvent(event)) {
        this.showEmote(emote.who === 'player' ? 'player' : emote.who.npc, emote.kind);
      }
    }
    const after = this.deps.session.state.player;
    const moved = before.x !== after.x || before.y !== after.y;
    const sameMap = this.renderedMapId === this.deps.session.state.mapId;
    if (moved && sameMap) footstepDust(this, before.x, before.y);
  }

  /**
   * 農務動作的回饋：有工具的動作（開墾、澆水、播種）揮工具，粒子與鏡頭微震等到「命中」那一刻才出現；
   * 沒有工具的動作（收成、出貨）維持原本的壓扁伸展，效果立刻出現。
   */
  private playAction(event: Extract<GameEvent, { type: 'acted' }>, plotsBefore: PlotMap): void {
    const reduced = prefersReducedMotion();
    const key = plotKey(event.x, event.y);
    const impact = (): void => {
      if (this.heldPlots.delete(key)) this.drawPlots(); // 命中：這一格才更新成動作後的樣子
      this.log(`effect:${event.action}`);
      playActionEffect(this, event.action, event.x, event.y);
      if (event.action === 'till' && !reduced) {
        this.cameras.main.shake(90, 0.003);
        this.log('shake');
      }
    };
    const tool = this.deps.tools.tools.find((t) => t.action === event.action);
    if (tool && this.rig.canSwing()) {
      this.rig.swing(tool, SWING_DURATION_MS, reduced, impact, () => this.log(`swing:${event.action}`));
      // swing() 可能已經補播了上一個被打斷的動作的命中，所以在它之後才凍結這一格。
      this.heldPlots.set(key, plotsBefore[key] ?? null);
      this.drawPlots();
    } else {
      this.rig.squash();
      impact();
    }
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
    this.drawPlots();
    this.movePlayer(state.player.x, state.player.y);
    this.moveFollowers(map, state.player, mapChanged);
    this.playerTile = { x: state.player.x, y: state.player.y };
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
    const map = this.deps.index.map(mapId);

    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const tile = tileAt(map, x, y);
        if (!tile) continue;
        this.world.add(this.image(`tile.${tile.kind}`, x, y, 0));
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

  override update(_time: number, delta: number): void {
    this.rig.update(delta);
    for (const rig of this.npcRigs.values()) rig.update(delta);
    for (const state of this.companions.values()) state.rig.update(delta);
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
