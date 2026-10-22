import Phaser from 'phaser';

/**
 * 雞、牛與羊的占位圖：不產圖，用 Graphics 在啟動時畫成 32×32 的貼圖（顏色取自共用調色盤的近似色）。
 * 之後替換成正式素材時，只改這裡與 content/assets.json。
 * 注意：BootScene 會先呼叫這裡，之後才為 assets.json 的占位素材產圖，所以這裡畫過的 id 不會被覆蓋。
 */
export const CHICKEN_TEXTURE = 'animal.chicken';
export const COW_TEXTURE = 'animal.cow';
export const SHEEP_TEXTURE = 'animal.sheep';

/** 動物的貼圖 id（與 content 的動物 id 相同，例如 animal.cow）。 */
export function animalTextureOf(kind: string): string {
  return `animal.${kind}`;
}

export function registerAnimalTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(CHICKEN_TEXTURE)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xfba48b, 1).fillCircle(16, 17, 10); // 身體
    g.fillStyle(0xfdfb73, 1).fillCircle(16, 9, 6); // 頭（冠）
    g.fillStyle(0xfd8a3a, 1).fillTriangle(22, 9, 27, 11, 22, 13); // 嘴
    g.fillStyle(0x180102, 1).fillCircle(19, 8, 1.2); // 眼
    g.fillStyle(0xbbb09d, 1).fillRect(12, 24, 2, 5).fillRect(18, 24, 2, 5); // 腳
    g.generateTexture(CHICKEN_TEXTURE, 32, 32);
    g.destroy();
  }
  if (!scene.textures.exists(COW_TEXTURE)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xf2eee4, 1).fillEllipse(15, 17, 24, 16); // 身體（白）
    g.fillStyle(0x2a2a2a, 1).fillCircle(11, 15, 3).fillCircle(20, 20, 2.5); // 花紋
    g.fillStyle(0xf2eee4, 1).fillCircle(26, 10, 5.5); // 頭
    g.fillStyle(0xf2a7a7, 1).fillEllipse(29, 13, 5, 3.5); // 鼻
    g.fillStyle(0x180102, 1).fillCircle(27, 9, 1); // 眼
    g.fillStyle(0x9a8f7e, 1).fillRect(9, 24, 3, 6).fillRect(19, 24, 3, 6); // 腿
    g.generateTexture(COW_TEXTURE, 32, 32);
    g.destroy();
  }
  if (!scene.textures.exists(SHEEP_TEXTURE)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xfbfaf4, 1).fillCircle(15, 16, 11); // 毛（白、蓬鬆）
    g.fillStyle(0xe6e1d3, 1).fillCircle(10, 12, 4).fillCircle(20, 12, 4); // 毛的紋理
    g.fillStyle(0x4a4236, 1).fillCircle(26, 10, 4); // 頭（深色）
    g.fillStyle(0x180102, 1).fillCircle(27, 9, 1); // 眼
    g.fillStyle(0x4a4236, 1).fillRect(10, 24, 2, 6).fillRect(18, 24, 2, 6); // 腿
    g.generateTexture(SHEEP_TEXTURE, 32, 32);
    g.destroy();
  }
}
