import Phaser from 'phaser';
import { resolveAsset, type AssetManifest } from '../infrastructure/assets/asset-manifest';
import type { RigDef } from '../infrastructure/assets/rig-manifest';
import { squashSprite } from './effects';
import { rigLayout, type RigLayout } from './rig-layout';
import { DEFAULT_WALK_PARAMS, REST_POSE, idlePose, walkPose, type View, type WalkParams, type WalkPose } from './walk-pose';

/**
 * 角色骨架：把一張角色圖切成「上半身＋腳」幾塊 Phaser 圖片，套用 walkPose 算出的姿勢。
 * 切法與動畫做法見 docs/ANIMATION_DESIGN.md；切塊座標由純函式 rigLayout 決定（有單元測試）。
 *
 * 結構：root（站在格子底邊中央，鏡頭跟隨它，位置補間也在這裡）
 *       └ body（姿勢：起伏、傾斜、縮放，以腳底中心為軸）
 *           └ legA、legB、feet、upper（圖片切塊；腳先畫、上半身蓋在最上面）
 *
 * 座標：切塊的位置以「腳底中心」為原點，單位是原始圖片像素；body 的縮放把它變成遊戲內大小。
 */

type Piece = 'legA' | 'legB' | 'feet' | 'upper';
const DRAW_ORDER: readonly Piece[] = ['legA', 'legB', 'feet', 'upper'];

export interface RigDebugInfo {
  key: string;
  flipX: boolean;
  view: View;
  mode: string;
  visible: Piece[];
  left: number;
  top: number;
  width: number;
  height: number;
}

export class CharacterRig {
  /** 站在格子底邊中央的軸心；鏡頭跟隨它。 */
  readonly root: Phaser.GameObjects.Container;
  /** 套用姿勢的那一層；壓扁伸展等動作效果也作用在它身上。 */
  readonly body: Phaser.GameObjects.Container;

  private readonly pieces: Record<Piece, Phaser.GameObjects.Image>;
  private readonly params: WalkParams;
  private view: View = 'down';
  private layout: RigLayout;
  private textureKey = '';
  private baseScale = 1;
  private pose: WalkPose = REST_POSE;
  private step = 0;
  private stillMs = 0;
  private walk?: Phaser.Tweens.Tween;
  private target?: { x: number; y: number };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rig: RigDef,
    private readonly assets: AssetManifest,
  ) {
    this.params = { ...DEFAULT_WALK_PARAMS, ...rig.params };
    this.verifyTextures();
    this.registerFrames();

    const firstTexture = resolveAsset(assets, rig.views.down).textureId;
    const make = () => scene.add.image(0, 0, firstTexture).setOrigin(0, 0);
    this.pieces = { legA: make(), legB: make(), feet: make(), upper: make() };
    this.body = scene.add.container(0, 0, DRAW_ORDER.map((name) => this.pieces[name]));
    this.root = scene.add.container(0, 0, [this.body]);
    this.layout = rigLayout(rig, 'down');
    this.setView('down');
  }

  /** 換方向：換貼圖、切塊與腳的做法。 */
  setView(view: View): void {
    this.view = view;
    this.layout = rigLayout(this.rig, view);
    const { textureId, scale } = resolveAsset(this.assets, this.rig.views[view]);
    this.textureKey = textureId;
    this.baseScale = scale;
    this.body.setData('baseScale', scale);

    for (const name of DRAW_ORDER) {
      this.pieces[name].setTexture(textureId, this.frameName(view, name)).setFlipX(this.layout.flipX);
    }
    const split = this.layout.mode === 'split-legs';
    this.pieces.legA.setVisible(split);
    this.pieces.legB.setVisible(split);
    this.pieces.feet.setVisible(!split);
    this.wake();
  }

  /** 立刻放到某個位置，停止進行中的走路。 */
  teleport(x: number, y: number): void {
    this.stopWalk();
    this.root.setPosition(x, y);
    this.applyPose(REST_POSE);
  }

  /**
   * 走向某個位置，一步一格；每呼叫一次算一步，左右腳交替。
   * 已經在往同一處走、或已經站在那裡時不重來，避免按其他鍵時中斷走路並讓腳步順序錯亂。
   */
  walkTo(x: number, y: number, durationMs: number): void {
    if (this.walk && this.target?.x === x && this.target.y === y) return;
    if (!this.walk && this.root.x === x && this.root.y === y) return;

    this.stopWalk();
    this.scene.tweens.killTweensOf(this.body);
    this.stillMs = 0;
    this.target = { x, y };
    const step = this.step;
    this.step += 1;
    const fromX = this.root.x;
    const fromY = this.root.y;

    this.walk = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: durationMs,
      ease: 'Linear',
      onUpdate: (tween) => {
        const u = Math.min(1, Math.max(0, tween.getValue() ?? 0));
        this.root.setPosition(fromX + (x - fromX) * u, fromY + (y - fromY) * u);
        this.applyPose(walkPose(step, u, this.view, this.params));
      },
      onComplete: () => {
        this.root.setPosition(x, y);
        this.applyPose(REST_POSE);
        this.walk = undefined;
        this.target = undefined;
      },
    });
  }

  /** 動作回饋（開墾、澆水…）的壓扁伸展，以顯示縮放為基準。 */
  squash(): void {
    this.wake();
    squashSprite(this.scene, this.body);
  }

  /** 每個畫面更新呼叫一次：站定一陣子後開始呼吸。走路與動作效果進行時不介入。 */
  update(deltaMs: number): void {
    if (this.walk) return;
    this.stillMs += deltaMs;
    if (this.stillMs > this.params.breatheDelayMs) this.applyPose(idlePose(this.stillMs, this.params));
  }

  /** 直接擺出走路循環中的某一刻（開發用，供逐格檢視各個相位）。 */
  preview(view: View, step: number, u: number): void {
    this.stopWalk();
    this.setView(view);
    this.applyPose(walkPose(step, u, view, this.params));
  }

  currentPose(): WalkPose {
    return this.pose;
  }

  debugInfo(): RigDebugInfo {
    const visible = DRAW_ORDER.filter((name) => this.pieces[name].visible);
    // 只合併看得見的切塊（隱藏的那組不該影響外框）。
    const bounds = visible
      .map((name) => this.pieces[name].getBounds())
      .reduce((all, next) => Phaser.Geom.Rectangle.Union(all, next, all));
    return {
      key: this.textureKey,
      flipX: this.layout.flipX,
      view: this.view,
      mode: this.layout.mode,
      visible,
      left: Math.round(bounds.x),
      top: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
    };
  }

  /** 把姿勢擺到各切塊與 body 上。 */
  private applyPose(pose: WalkPose): void {
    this.pose = pose;
    const { width, height } = this.rig.textureSize;
    const left = -width / 2;
    const top = -height;
    const { at, split } = this.layout;

    this.pieces.upper.setPosition(left + at.upper.x, top + at.upper.y);
    this.pieces.legA.setPosition(left + at.legA.x, top + at.legA.y + pose.legA);
    this.pieces.legB.setPosition(left + at.legB.x, top + at.legB.y + pose.legB);
    // 側面的整塊腳以分界為軸水平伸縮：左緣從 left 變成 left − split·stretch，分界處不動。
    this.pieces.feet.setPosition(left - split * pose.stretch, top + at.feet.y + pose.legA).setScale(1 + pose.stretch, 1);

    this.body.setPosition(0, pose.y * this.baseScale);
    this.body.setRotation(pose.rotation);
    this.body.setScale(this.baseScale * pose.scaleX, this.baseScale * pose.scaleY);
  }

  private wake(): void {
    this.stillMs = 0;
    if (!this.walk) this.applyPose(REST_POSE);
  }

  private stopWalk(): void {
    this.walk?.stop();
    this.walk = undefined;
    this.target = undefined;
  }

  private frameName(view: View, piece: Piece): string {
    return `${this.rig.id}/${view}/${piece}`;
  }

  /** rigs.json 宣告的圖片大小必須與實際貼圖一致，否則切線與分界都會切錯地方。 */
  private verifyTextures(): void {
    const { width, height } = this.rig.textureSize;
    for (const view of ['down', 'up', 'left', 'right'] as const) {
      const { textureId } = resolveAsset(this.assets, this.rig.views[view]);
      if (!this.scene.textures.exists(textureId)) {
        throw new Error(`rig ${this.rig.id} 的 ${view}：貼圖 ${textureId} 不存在（素材可能載入失敗）`);
      }
      const source = this.scene.textures.get(textureId).getSourceImage();
      if (source.width !== width || source.height !== height) {
        throw new Error(
          `rig ${this.rig.id} 的 ${view}：貼圖 ${textureId} 是 ${source.width}×${source.height}，rigs.json 宣告的是 ${width}×${height}`,
        );
      }
    }
  }

  /** 在貼圖上為每個方向的每一塊註冊影格（同一張貼圖多個影格，不產生額外檔案）。 */
  private registerFrames(): void {
    for (const view of ['down', 'up', 'left', 'right'] as const) {
      const layout = rigLayout(this.rig, view);
      const { textureId } = resolveAsset(this.assets, this.rig.views[view]);
      const texture = this.scene.textures.get(textureId);
      for (const piece of DRAW_ORDER) {
        const name = this.frameName(view, piece);
        if (texture.has(name)) continue;
        const region = layout[piece];
        texture.add(name, 0, region.x, region.y, region.width, region.height);
      }
    }
  }
}
