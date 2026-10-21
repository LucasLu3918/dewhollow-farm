import Phaser from 'phaser';
import type { ActionFeedback } from '../application/game-commands';
import { TILE_SIZE, UNIT } from './constants';

/**
 * 動作效果：只負責視覺回饋（粒子、飄字、閃爍），不影響任何規則。
 * 效果物件直接加在場景上，不放進地圖容器，因此每次重畫地圖時不會被清掉。
 * 數字以 32 px 設計稿為基準，經 px() 換算成實際像素。
 */

const CENTER = TILE_SIZE / 2;

/** 把 32 px 設計稿上的長度換算成實際像素。 */
function px(designPixels: number): number {
  return designPixels * UNIT;
}

function tileCenter(x: number, y: number): { px: number; py: number } {
  return { px: x * TILE_SIZE + CENTER, py: y * TILE_SIZE + CENTER };
}

/** 依動作種類播放對應效果，位置為被作用的格子。 */
export function playActionEffect(scene: Phaser.Scene, action: ActionFeedback, x: number, y: number): void {
  const { px: cx, py: cy } = tileCenter(x, y);
  switch (action) {
    case 'till':
      puff(scene, cx, cy, 0x8a6a48, 6);
      break;
    case 'water':
      droplets(scene, cx, cy);
      break;
    case 'plant':
      sprout(scene, cx, cy);
      break;
    case 'harvest':
      sparkle(scene, cx, cy);
      floatText(scene, cx, cy - px(8), '+1', '#ffe08a');
      break;
    case 'ship':
      puff(scene, cx, cy, 0xe0b25c, 8);
      floatText(scene, cx, cy - px(8), '出貨', '#ffe08a');
      break;
  }
}

/** 角色走路時的腳步塵土，發生在離開的格子。 */
export function footstepDust(scene: Phaser.Scene, x: number, y: number): void {
  const { px: cx, py: cy } = tileCenter(x, y);
  puff(scene, cx, cy + px(10), 0xd8c9a0, 3, 0.5);
}

/** 角色動作的壓扁伸展回饋，例如開墾、澆水時的一下下壓。 */
export function squashSprite(scene: Phaser.Scene, target: Phaser.GameObjects.Image | Phaser.GameObjects.Container): void {
  // 以顯示縮放（例如 2x 母版的 0.5）為基準相對變化，不能直接寫死 1.12。
  const base = (target.getData('baseScale') as number | undefined) ?? 1;
  // 連按時上一個壓扁可能還沒結束；先回到基準縮放，避免每次都從歪掉的大小開始。
  scene.tweens.killTweensOf(target);
  target.setScale(base);
  scene.tweens.add({
    targets: target,
    scaleX: base * 1.12,
    scaleY: base * 0.88,
    duration: 90,
    yoyo: true,
    ease: 'Quad.easeOut',
  });
}

/** 睡覺時在角色上方飄出 z 字，並以淡出淡入表示時間流逝。 */
export function sleepEffect(scene: Phaser.Scene, x: number, y: number): void {
  const { px: cx, py: cy } = tileCenter(x, y);
  for (let i = 0; i < 3; i += 1) {
    scene.time.delayedCall(i * 250, () => floatText(scene, cx + i * px(6), cy - px(12), 'z', '#cfe6ff', 900));
  }
  scene.cameras.main.fadeOut(250, 0, 0, 0);
  scene.time.delayedCall(450, () => scene.cameras.main.fadeIn(350, 0, 0, 0));
}

function puff(scene: Phaser.Scene, cx: number, cy: number, color: number, count: number, alpha = 0.8): void {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    const dot = scene.add.circle(cx, cy, px(3), color, alpha).setDepth(20);
    scene.tweens.add({
      targets: dot,
      x: cx + Math.cos(angle) * px(14),
      y: cy + Math.sin(angle) * px(10) - px(4),
      alpha: 0,
      scale: 0.4,
      duration: 380,
      ease: 'Quad.easeOut',
      onComplete: () => dot.destroy(),
    });
  }
}

function droplets(scene: Phaser.Scene, cx: number, cy: number): void {
  for (let i = 0; i < 5; i += 1) {
    const startX = cx - px(10) + i * px(5);
    const drop = scene.add.circle(startX, cy - px(14), px(2), 0x6fb6ff, 0.95).setDepth(20);
    scene.tweens.add({
      targets: drop,
      y: cy + px(6),
      alpha: 0,
      duration: 420,
      delay: i * 40,
      ease: 'Quad.easeIn',
      onComplete: () => drop.destroy(),
    });
  }
}

function sprout(scene: Phaser.Scene, cx: number, cy: number): void {
  const leaf = scene.add.ellipse(cx, cy, px(10), px(14), 0x7fcf6b).setDepth(20).setScale(0.2);
  scene.tweens.add({
    targets: leaf,
    scale: 1,
    duration: 260,
    ease: 'Back.easeOut',
    yoyo: true,
    hold: 200,
    onComplete: () => leaf.destroy(),
  });
}

function sparkle(scene: Phaser.Scene, cx: number, cy: number): void {
  for (let i = 0; i < 4; i += 1) {
    const angle = (Math.PI / 2) * i + Math.PI / 4;
    const star = scene.add.star(cx, cy, 4, px(2), px(5), 0xffe08a).setDepth(20);
    scene.tweens.add({
      targets: star,
      x: cx + Math.cos(angle) * px(18),
      y: cy + Math.sin(angle) * px(18),
      alpha: 0,
      scale: 0.3,
      duration: 480,
      ease: 'Cubic.easeOut',
      onComplete: () => star.destroy(),
    });
  }
}

function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color: string, duration = 700): void {
  const label = scene.add
    .text(x, y, text, {
      fontFamily: 'sans-serif',
      fontSize: `${px(14)}px`,
      color,
      stroke: '#101810',
      strokeThickness: px(3),
    })
    .setOrigin(0.5)
    .setDepth(30);
  scene.tweens.add({
    targets: label,
    y: y - px(22),
    alpha: 0,
    duration,
    ease: 'Quad.easeOut',
    onComplete: () => label.destroy(),
  });
}
