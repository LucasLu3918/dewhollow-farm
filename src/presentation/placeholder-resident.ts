import Phaser from 'phaser';
import type { AssetManifest } from '../infrastructure/assets/asset-manifest';
import { resolveAsset } from '../infrastructure/assets/asset-manifest';

/**
 * 占位的居民（沒有骨架、只有色塊的素材）：一個容器裝一張圖，腳底中心在容器的原點。
 * 介面與 CharacterRig 相同（teleport、walkTo、stepInPlace、displayHeight…），所以 MapScene 可以一視同仁。
 * 位置的變化由 tween 完成：居民走過去，而不是瞬間出現在新的格子上。
 */
export interface ResidentView {
  readonly root: Phaser.GameObjects.Container;
  teleport(x: number, y: number): void;
  walkTo(x: number, y: number, durationMs: number, onArrive?: () => void): void;
  stepInPlace(durationMs: number): void;
  displayHeight(): number;
  update(deltaMs: number): void;
  destroy(): void;
}

export class PlaceholderResident implements ResidentView {
  readonly root: Phaser.GameObjects.Container;
  private readonly image: Phaser.GameObjects.Image;

  constructor(
    private readonly scene: Phaser.Scene,
    assetId: string,
    assets: AssetManifest,
  ) {
    const { textureId, flipX, scale } = resolveAsset(assets, assetId);
    this.image = scene.add.image(0, 0, textureId).setOrigin(0.5, 1).setScale(scale).setFlipX(flipX);
    this.root = scene.add.container(0, 0, [this.image]);
  }

  teleport(x: number, y: number): void {
    this.scene.tweens.killTweensOf(this.root);
    this.root.setPosition(x, y);
  }

  walkTo(x: number, y: number, durationMs: number, onArrive?: () => void): void {
    this.scene.tweens.killTweensOf(this.root);
    this.scene.tweens.add({ targets: this.root, x, y, duration: durationMs, ease: 'Linear', onComplete: () => onArrive?.() });
  }

  /** 被搭話時原地跳一下（和毛毛的原地搖擺是同一種回饋）。 */
  stepInPlace(durationMs: number): void {
    const home = this.root.y;
    this.scene.tweens.killTweensOf(this.root);
    this.scene.tweens.add({ targets: this.root, y: home - 3, duration: durationMs / 2, yoyo: true, ease: 'Sine.easeInOut' });
  }

  displayHeight(): number {
    return this.image.displayHeight;
  }

  update(): void {
    // 占位沒有每一幀的動作；位置與跳動都交給 tween。
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.root);
    this.root.destroy(true);
  }
}
