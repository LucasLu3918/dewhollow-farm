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
import type { InventoryPanel } from '../inventory-panel';
import type { SettingsService } from '../../application/settings';
import { registerEmoteTextures } from '../emote';
import { registerAnimalTextures } from '../animal-art';
import { MapScene, type MapSceneDeps } from './MapScene';
import { TILE_SIZE, UNIT } from '../constants';
import type { ResponsiveLayoutController } from '../responsive/responsive-layout';
import {
  CANDIDATE_ATLAS_TEXTURE,
  CANDIDATE_MANIFEST_CACHE_KEY,
  candidateForProfile,
  type CandidateId,
} from '../candidate-art';
import { renderProfileFor } from '../pixel-viewport/profiles';
import {
  candidateFramesFromManifest,
  explicitlyUnapprovedCandidateFramesFromManifest,
  PIXEL32_ANIMATION_ATLAS_KEY,
  PIXEL32_ANIMATION_MANIFEST_KEY,
  PIXEL32_CROPS_ATLAS_KEY,
  PIXEL32_CROPS_MANIFEST_KEY,
  PIXEL32_INTERACTABLES_ATLAS_KEY,
  PIXEL32_INTERACTABLES_MANIFEST_KEY,
  PIXEL32_PETS_ATLAS_KEY,
  PIXEL32_PETS_MANIFEST_KEY,
  PIXEL32_MAP_ATLAS_KEY,
  PIXEL32_MAP_MANIFEST_KEY,
  pixel32CandidateReviewRequested,
  pixel32InteractablesPreviewRequested,
  pixel32CandidateRuntimeRequested,
} from '../pixel32-candidate-runtime';

interface CandidateManifest {
  status: string;
  approved: boolean;
  candidates: Array<{
    id: CandidateId;
    status: string;
    approved: boolean;
    atlas: string;
    frames: Record<string, { x: number; y: number; width: number; height: number }>;
  }>;
}


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
  inventory: InventoryPanel;
  settings: SettingsService;
  responsive: ResponsiveLayoutController;
  /** 地圖場景的鍵盤與畫面都接好時呼叫一次（移除開機載入提示，見 main.ts）。 */
  onReady: () => void;
  controls: MapSceneDeps['controls'];
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
    const candidate = this.devCandidateForProfile();
    if (candidate) {
      const root = '/docs/art/candidates/pixel-movement/gate1-assets';
      const atlas = candidate === '8bit' ? '8bit.png' : '16bit.png';
      this.load.json(CANDIDATE_MANIFEST_CACHE_KEY, `${root}/manifest.json`);
      this.load.image(CANDIDATE_ATLAS_TEXTURE, `${root}/${atlas}`);
    }
    if (this.pixel32RuntimeRequested()) {
      const root = '/docs/art/candidates/pixel-movement/gate1-assets';
      this.load.json(PIXEL32_MAP_MANIFEST_KEY, `${root}/pixel32-map/manifest.json`);
      this.load.image(PIXEL32_MAP_ATLAS_KEY, `${root}/pixel32-map/map-atlas.png`);
      this.load.json(PIXEL32_ANIMATION_MANIFEST_KEY, `${root}/pixel32-animation/manifest.json`);
      this.load.image(PIXEL32_ANIMATION_ATLAS_KEY, `${root}/pixel32-animation/player-4dir.png`);
    }
    if (this.pixel32CandidateReviewRequested()) {
      const root = '/docs/art/candidates/pixel-movement';
      this.load.json(PIXEL32_CROPS_MANIFEST_KEY, `${root}/gate1-assets/pixel32-crops/manifest.json`);
      this.load.image(PIXEL32_CROPS_ATLAS_KEY, `${root}/gate1-assets/pixel32-crops/sweet-radish-stages.png`);
      this.load.json(PIXEL32_INTERACTABLES_MANIFEST_KEY, `${root}/gate1-assets/pixel32-interactables/manifest.json`);
      this.load.image(PIXEL32_INTERACTABLES_ATLAS_KEY, `${root}/gate1-assets/pixel32-interactables/interactables-atlas.png`);
      this.load.json(PIXEL32_PETS_MANIFEST_KEY, `${root}/gate1-pets-pixel32/manifest.json`);
      this.load.image(PIXEL32_PETS_ATLAS_KEY, `${root}/gate1-pets-pixel32/pets-pixel32.png`);
    } else if (this.pixel32InteractablesPreviewRequested()) {
      const root = '/docs/art/candidates/pixel-movement/gate1-assets/pixel32-interactables';
      this.load.json(PIXEL32_INTERACTABLES_MANIFEST_KEY, `${root}/manifest.json`);
      this.load.image(PIXEL32_INTERACTABLES_ATLAS_KEY, `${root}/interactables-atlas.png`);
    }
  }

  create(): void {
    const candidateId = this.registerCandidateAtlas();
    const pixel32CandidateRuntime = this.registerPixel32CandidateAtlases();
    const pixel32CandidateAssets = this.registerPixel32CandidateReviewAtlases();
    const pixel32InteractablesPreview = this.registerPixel32InteractablesPreviewAtlas();
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
    // 32-bit 像素圖使用最近鄰取樣，保留原始像素格與硬邊輪廓。
    for (const entry of this.deps.assets.assets) {
      if (entry.file && this.textures.exists(entry.id)) {
        this.textures.get(entry.id).setFilter(Phaser.Textures.FilterMode.NEAREST);
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
      inventory: this.deps.inventory,
      settings: this.deps.settings,
      responsive: this.deps.responsive,
      onReady: this.deps.onReady,
      controls: this.deps.controls,
    };
    this.registry.set('gate1-candidate-id', candidateId);
    this.registry.set('gate1-pixel32-candidate-runtime', pixel32CandidateRuntime);
    this.registry.set('gate1-pixel32-candidate-assets', pixel32CandidateAssets);
    this.registry.set('gate1-pixel32-interactables-preview', pixel32InteractablesPreview);
    this.scene.start('map', sceneDeps);
  }

  private pixel32RuntimeRequested(): boolean {
    return pixel32CandidateRuntimeRequested(new URLSearchParams(window.location.search), import.meta.env.DEV);
  }

  private pixel32CandidateReviewRequested(): boolean {
    return pixel32CandidateReviewRequested(
      new URLSearchParams(window.location.search),
      import.meta.env.DEV,
      this.pixel32RuntimeRequested(),
    );
  }

  private pixel32InteractablesPreviewRequested(): boolean {
    return pixel32InteractablesPreviewRequested(
      new URLSearchParams(window.location.search),
      import.meta.env.DEV,
      this.pixel32RuntimeRequested(),
    );
  }

  private registerPixel32CandidateAtlases(): boolean {
    if (!this.pixel32RuntimeRequested()
      || !this.textures.exists(PIXEL32_MAP_ATLAS_KEY)
      || !this.textures.exists(PIXEL32_ANIMATION_ATLAS_KEY)) return false;

    const mapFrames = candidateFramesFromManifest(this.cache.json.get(PIXEL32_MAP_MANIFEST_KEY), 'map-atlas.png');
    const animationFrames = candidateFramesFromManifest(this.cache.json.get(PIXEL32_ANIMATION_MANIFEST_KEY), 'player-4dir.png');
    if (!mapFrames || !animationFrames) return false;

    this.registerFrames(PIXEL32_MAP_ATLAS_KEY, mapFrames);
    this.registerFrames(PIXEL32_ANIMATION_ATLAS_KEY, animationFrames);
    return true;
  }

  private registerPixel32CandidateReviewAtlases(): boolean {
    if (!this.pixel32CandidateReviewRequested()) return false;
    const entries = [
      { key: PIXEL32_CROPS_ATLAS_KEY, manifestKey: PIXEL32_CROPS_MANIFEST_KEY, file: 'sweet-radish-stages.png' },
      { key: PIXEL32_INTERACTABLES_ATLAS_KEY, manifestKey: PIXEL32_INTERACTABLES_MANIFEST_KEY, file: 'interactables-atlas.png' },
      { key: PIXEL32_PETS_ATLAS_KEY, manifestKey: PIXEL32_PETS_MANIFEST_KEY, file: 'pets-pixel32.png' },
    ];
    const frames = entries.map((entry) => ({
      ...entry,
      frames: candidateFramesFromManifest(this.cache.json.get(entry.manifestKey), entry.file),
    }));
    if (frames.some(({ key, frames: candidateFrames }) => !this.textures.exists(key) || !candidateFrames)) return false;
    for (const entry of frames) this.registerFrames(entry.key, entry.frames!);
    return true;
  }

  private registerPixel32InteractablesPreviewAtlas(): boolean {
    if (!this.pixel32InteractablesPreviewRequested() || !this.textures.exists(PIXEL32_INTERACTABLES_ATLAS_KEY)) return false;
    const frames = explicitlyUnapprovedCandidateFramesFromManifest(
      this.cache.json.get(PIXEL32_INTERACTABLES_MANIFEST_KEY),
      'interactables-atlas.png',
    );
    const requiredFrames = ['door-closed', 'door-open', 'shipbox-closed', 'shipbox-open'];
    if (!frames || requiredFrames.some((frame) => !frames[frame])) return false;
    this.registerFrames(PIXEL32_INTERACTABLES_ATLAS_KEY, frames);
    return true;
  }

  private registerFrames(textureKey: string, frames: Record<string, { x: number; y: number; width: number; height: number }>): void {
    const texture = this.textures.get(textureKey);
    for (const [key, rect] of Object.entries(frames)) {
      if (!texture.has(key)) texture.add(key, 0, rect.x, rect.y, rect.width, rect.height);
    }
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  private devCandidateForProfile(): CandidateId | null {
    if (!import.meta.env.DEV) return null;
    if (this.pixel32RuntimeRequested()) return null;
    const profile = renderProfileFor(new URLSearchParams(window.location.search).get('renderProfile'), true);
    return candidateForProfile(profile.id);
  }

  private registerCandidateAtlas(): CandidateId | null {
    const candidateId = this.devCandidateForProfile();
    if (!candidateId || !this.textures.exists(CANDIDATE_ATLAS_TEXTURE)) return null;
    const manifest = this.cache.json.get(CANDIDATE_MANIFEST_CACHE_KEY) as CandidateManifest | undefined;
    const candidate = manifest?.candidates.find((entry) => entry.id === candidateId);
    if (!manifest || manifest.status !== 'candidate' || manifest.approved || !candidate
      || candidate.status !== 'candidate' || candidate.approved) return null;

    const texture = this.textures.get(CANDIDATE_ATLAS_TEXTURE);
    for (const [key, rect] of Object.entries(candidate.frames)) {
      texture.add(key, 0, rect.x, rect.y, rect.width, rect.height);
    }
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    return candidateId;
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
