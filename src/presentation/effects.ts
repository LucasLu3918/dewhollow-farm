import Phaser from 'phaser';
import type { ActionFeedback } from '../application/game-commands';
import { TILE_SIZE } from './constants';

/**
 * 動作效果：只負責視覺回饋（粒子、飄字、閃爍），不影響任何規則。
 * 效果物件直接加在場景上，不放進地圖容器，因此每次重畫地圖時不會被清掉。
 */

const CENTER = TILE_SIZE / 2;

function tileCenter(x: number, y: number): { px: number; py: number } {
  return { px: x * TILE_SIZE + CENTER, py: y * TILE_SIZE + CENTER };
}

/** 依動作種類播放對應效果，位置為被作用的格子。 */
export function playActionEffect(scene: Phaser.Scene, action: ActionFeedback, x: number, y: number): void {
  const { px, py } = tileCenter(x, y);
  switch (action) {
    case 'till':
      puff(scene, px, py, 0x8a6a48, 6);
      break;
    case 'water':
      droplets(scene, px, py);
      break;
    case 'plant':
      sprout(scene, px, py);
      break;
    case 'harvest':
      sparkle(scene, px, py);
      floatText(scene, px, py - 8, '+1', '#ffe08a');
      break;
    case 'ship':
      puff(scene, px, py, 0xe0b25c, 8);
      floatText(scene, px, py - 8, '出貨', '#ffe08a');
      break;
  }
}

/** 角色走路時的腳步塵土，發生在離開的格子。 */
export function footstepDust(scene: Phaser.Scene, x: number, y: number): void {
  const { px, py } = tileCenter(x, y);
  puff(scene, px, py + 10, 0xd8c9a0, 3, 0.5);
}

/** 角色動作的壓扁伸展回饋，例如開墾、澆水時的一下下壓。 */
export function squashSprite(scene: Phaser.Scene, target: Phaser.GameObjects.Image): void {
  scene.tweens.add({
    targets: target,
    scaleX: 1.12,
    scaleY: 0.88,
    duration: 90,
    yoyo: true,
    ease: 'Quad.easeOut',
  });
}

/**
 * 走路時的上下起伏。位置由一個計數器每幀計算，避免 x、y 兩組補間互相覆蓋。
 * 新的移動會取消尚未結束的舊移動，確保快速按鍵時不會留下殘影。
 */
export function walkBob(scene: Phaser.Scene, target: Phaser.GameObjects.Image, toX: number, toY: number, duration: number): void {
  const previous = target.getData('walk') as Phaser.Tweens.Tween | undefined;
  previous?.stop();

  const fromX = target.x;
  const fromY = target.y;
  const walk = scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration,
    ease: 'Linear',
    onUpdate: (tween) => {
      const t = tween.getValue() ?? 0;
      target.x = fromX + (toX - fromX) * t;
      target.y = fromY + (toY - fromY) * t - 3 * Math.sin(Math.PI * t);
    },
    onComplete: () => {
      target.setPosition(toX, toY);
      target.setData('walk', undefined);
    },
  });
  target.setData('walk', walk);
}

/** 睡覺時在角色上方飄出 z 字，並以淡出淡入表示時間流逝。 */
export function sleepEffect(scene: Phaser.Scene, x: number, y: number): void {
  const { px, py } = tileCenter(x, y);
  for (let i = 0; i < 3; i += 1) {
    scene.time.delayedCall(i * 250, () => floatText(scene, px + i * 6, py - 12, 'z', '#cfe6ff', 900));
  }
  scene.cameras.main.fadeOut(250, 0, 0, 0);
  scene.time.delayedCall(450, () => scene.cameras.main.fadeIn(350, 0, 0, 0));
}

function puff(scene: Phaser.Scene, px: number, py: number, color: number, count: number, alpha = 0.8): void {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    const dot = scene.add.circle(px, py, 3, color, alpha).setDepth(20);
    scene.tweens.add({
      targets: dot,
      x: px + Math.cos(angle) * 14,
      y: py + Math.sin(angle) * 10 - 4,
      alpha: 0,
      scale: 0.4,
      duration: 380,
      ease: 'Quad.easeOut',
      onComplete: () => dot.destroy(),
    });
  }
}

function droplets(scene: Phaser.Scene, px: number, py: number): void {
  for (let i = 0; i < 5; i += 1) {
    const startX = px - 10 + i * 5;
    const drop = scene.add.circle(startX, py - 14, 2, 0x6fb6ff, 0.95).setDepth(20);
    scene.tweens.add({
      targets: drop,
      y: py + 6,
      alpha: 0,
      duration: 420,
      delay: i * 40,
      ease: 'Quad.easeIn',
      onComplete: () => drop.destroy(),
    });
  }
}

function sprout(scene: Phaser.Scene, px: number, py: number): void {
  const leaf = scene.add.ellipse(px, py, 10, 14, 0x7fcf6b).setDepth(20).setScale(0.2);
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

function sparkle(scene: Phaser.Scene, px: number, py: number): void {
  for (let i = 0; i < 4; i += 1) {
    const angle = (Math.PI / 2) * i + Math.PI / 4;
    const star = scene.add.star(px, py, 4, 2, 5, 0xffe08a).setDepth(20);
    scene.tweens.add({
      targets: star,
      x: px + Math.cos(angle) * 18,
      y: py + Math.sin(angle) * 18,
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
    .text(x, y, text, { fontFamily: 'sans-serif', fontSize: '14px', color, stroke: '#101810', strokeThickness: 3 })
    .setOrigin(0.5)
    .setDepth(30);
  scene.tweens.add({
    targets: label,
    y: y - 22,
    alpha: 0,
    duration,
    ease: 'Quad.easeOut',
    onComplete: () => label.destroy(),
  });
}
