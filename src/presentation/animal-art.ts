import Phaser from 'phaser';

/**
 * 雞的占位圖：不產圖，用 Graphics 在啟動時畫成 32×32 的貼圖（顏色取自共用調色盤的近似色）。
 * 之後替換成正式素材時，只改這裡與 content/assets.json。
 */
export const CHICKEN_TEXTURE = 'animal.chicken';

export function registerAnimalTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(CHICKEN_TEXTURE)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xfba48b, 1).fillCircle(16, 17, 10); // 身體
  g.fillStyle(0xfdfb73, 1).fillCircle(16, 9, 6); // 頭（冠）
  g.fillStyle(0xfd8a3a, 1).fillTriangle(22, 9, 27, 11, 22, 13); // 嘴
  g.fillStyle(0x180102, 1).fillCircle(19, 8, 1.2); // 眼
  g.fillStyle(0xbbb09d, 1).fillRect(12, 24, 2, 5).fillRect(18, 24, 2, 5); // 腳
  g.generateTexture(CHICKEN_TEXTURE, 32, 32);
  g.destroy();
}
