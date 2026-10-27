import type Phaser from 'phaser';
import type { ActionFeedback } from '../application/game-commands';
import { TILE_SIZE, UNIT } from './constants';
import { pickupPoint } from './pickup-arc';
import { lidAngle, SHIP_FLIGHT_MS, SHIP_LID_TOTAL_MS, shipIconDelay } from './ship-animation';
import { reserveSceneParticle } from './particle-budget';

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

/**
 * 依動作種類播放對應效果，位置為被作用的格子。
 * particles 為 false 時不畫粒子（木屑、水滴、水波、閃光等），但文字（出貨）仍然顯示。
 */
export function playActionEffect(scene: Phaser.Scene, action: ActionFeedback, x: number, y: number, particles = true): void {
  const { px: cx, py: cy } = tileCenter(x, y);
  switch (action) {
    case 'till':
      if (particles) puff(scene, cx, cy, 0x8a6a48, 6);
      break;
    case 'water':
      if (particles) droplets(scene, cx, cy);
      break;
    case 'plant':
      if (particles) sprout(scene, cx, cy);
      break;
    case 'harvest':
      // 作物飛到玩家頭上的過程由 pickupFlight 負責，這裡只留田裡的閃光。
      if (particles) sparkle(scene, cx, cy);
      break;
    case 'ship':
      if (particles) puff(scene, cx, cy, 0xe0b25c, 8);
      floatText(scene, cx, cy - px(8), '出貨', '#ffe08a');
      break;
    case 'chop':
      // 木屑：砍中的那一刻才飛出；樹被砍掉後那一格變成草地（見 MapScene 的 syncWorldTiles）。
      if (particles) puff(scene, cx, cy, 0x8a5a3a, 7);
      break;
    case 'forage':
      if (particles) puff(scene, cx, cy, 0x7fcf6b, 5);
      break;
    case 'mine':
      if (particles) puff(scene, cx, cy, 0x9a9aa6, 6);
      break;
    case 'fish':
      // 水波：兩圈擴散搭配小水滴，和一般採集煙塵明確區分。
      if (particles) waterRipple(scene, cx, cy);
      break;
  }
}

/** 採集產量的飄字間隔（毫秒）：多種物品依序飄出，不疊在同一個位置。 */
const YIELD_LABEL_STAGGER_MS = 160;

/**
 * 採集得到的物品（例如「+3 木材」）在被作用的格子上方依序飄出。文字不受「減少粒子」影響，與出貨的飄字相同。
 * labels 為空時什麼都不做。
 */
export function yieldLabels(scene: Phaser.Scene, x: number, y: number, labels: readonly string[]): void {
  const { px: cx, py: cy } = tileCenter(x, y);
  labels.forEach((label, index) => {
    scene.time.delayedCall(index * YIELD_LABEL_STAGGER_MS, () => floatText(scene, cx, cy - px(12), label, '#ffe08a'));
  });
}

/** 角色走路時的腳步塵土，發生在離開的格子；顏色由地面決定（見 content/terrain.json）。 */
export function footstepDust(scene: Phaser.Scene, x: number, y: number, color: string, particles = true): void {
  if (!particles) return;
  const { px: cx, py: cy } = tileCenter(x, y);
  puff(scene, cx, cy + px(10), Number.parseInt(color.slice(1), 16), 3, 0.5);
}

/** 出貨時一種物品的圖示；沒有圖的物品（例如種子、魚）用一個色點代替。 */
export interface ShipIcon {
  texture: string | null;
  scale: number;
}

const LID_COLOR = 0x8a5a3a;
const LID_EDGE_COLOR = 0x5a3a24;
const SHIP_TOKEN_COLOR = 0xe0b25c;

/**
 * 出貨：物品從 from（玩家頭上）飛進出貨箱，依序一種接一種（見 shipIconDelay），箱蓋同時開合一次（見 lidAngle）。
 * box 是箱子那一格的左上角（世界座標）。onLanded 在第一種物品落地時呼叫一次，之後的出貨效果才出現。
 * 箱蓋與圖示都是程式繪製，不需要素材。
 */
export function shipFlight(
  scene: Phaser.Scene,
  icons: readonly ShipIcon[],
  from: { x: number; y: number },
  box: { x: number; y: number },
  onLanded: () => void,
): void {
  const hinge = scene.add.container(box.x + TILE_SIZE * 0.1, box.y + TILE_SIZE * 0.2).setDepth(21);
  const lidWidth = TILE_SIZE * 0.8;
  const lidHeight = TILE_SIZE * 0.16;
  const lid = scene.add.graphics();
  lid.fillStyle(LID_COLOR, 1).fillRect(0, 0, lidWidth, lidHeight);
  lid.lineStyle(px(1), LID_EDGE_COLOR, 1).strokeRect(0, 0, lidWidth, lidHeight);
  hinge.add(lid);
  const lidProgress = { ms: 0 };
  scene.tweens.add({
    targets: lidProgress,
    ms: SHIP_LID_TOTAL_MS,
    duration: SHIP_LID_TOTAL_MS,
    ease: 'Linear',
    onUpdate: () => hinge.setRotation(lidAngle(lidProgress.ms)),
    onComplete: () => hinge.destroy(),
  });

  const to = { x: box.x + TILE_SIZE / 2, y: box.y + TILE_SIZE / 2 };
  icons.forEach((icon, index) => {
    scene.time.delayedCall(shipIconDelay(index), () => flyIcon(scene, icon, from, to));
  });
  scene.time.delayedCall(SHIP_FLIGHT_MS, onLanded);
}

function flyIcon(scene: Phaser.Scene, icon: ShipIcon, from: { x: number; y: number }, to: { x: number; y: number }): void {
  const scale = icon.texture ? icon.scale : 1;
  const image: Phaser.GameObjects.Image | Phaser.GameObjects.Arc = icon.texture
    ? scene.add.image(from.x, from.y, icon.texture)
    : scene.add.circle(from.x, from.y, px(4), SHIP_TOKEN_COLOR);
  image.setDepth(25).setScale(scale);
  const progress = { t: 0 };
  scene.tweens.add({
    targets: progress,
    t: 1,
    duration: SHIP_FLIGHT_MS,
    ease: 'Quad.easeIn',
    onUpdate: () => {
      const p = pickupPoint(from, to, progress.t, px(16));
      image.setPosition(p.x, p.y);
      image.setScale(scale * p.scale);
    },
    onComplete: () => image.destroy(),
  });
}

/** 拾取飛行的時間（毫秒）。 */
const PICKUP_MS = 420;

/**
 * 收成時，作物從田裡拱著飛到玩家頭上，縮小淡出，接著在那裡飄出名稱。
 * `to` 每一幀都重新計算，玩家若在飛行途中走開，作物會跟著去找他。
 */
export function pickupFlight(
  scene: Phaser.Scene,
  texture: string,
  scale: number,
  from: { x: number; y: number },
  to: () => { x: number; y: number },
  label: string,
): void {
  const image = scene.add.image(from.x, from.y, texture).setDepth(25).setScale(scale);
  const progress = { t: 0 };
  scene.tweens.add({
    targets: progress,
    t: 1,
    duration: PICKUP_MS,
    ease: 'Quad.easeIn',
    onUpdate: () => {
      const p = pickupPoint(from, to(), progress.t, px(20));
      image.setPosition(p.x, p.y);
      image.setScale(scale * p.scale);
    },
    onComplete: () => {
      const end = to();
      image.destroy();
      floatText(scene, end.x, end.y - px(10), label, '#ffe08a');
    },
  });
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

/**
 * 睡覺時在角色上方飄出 z 字，並以淡出淡入表示時間流逝。
 * screenFade 為 false 時不做全螢幕的淡出淡入（對應設定的「螢幕閃光」）。
 */
export function sleepEffect(scene: Phaser.Scene, x: number, y: number, screenFade = true): void {
  const { px: cx, py: cy } = tileCenter(x, y);
  for (let i = 0; i < 3; i += 1) {
    scene.time.delayedCall(i * 250, () => floatText(scene, cx + i * px(6), cy - px(12), 'z', '#cfe6ff', 900));
  }
  if (!screenFade) return;
  scene.cameras.main.fadeOut(250, 0, 0, 0);
  scene.time.delayedCall(450, () => scene.cameras.main.fadeIn(350, 0, 0, 0));
}

function puff(scene: Phaser.Scene, cx: number, cy: number, color: number, count: number, alpha = 0.8): void {
  for (let i = 0; i < count; i += 1) {
    const release = reserveSceneParticle(scene);
    if (!release) break;
    const angle = (Math.PI * 2 * i) / count;
    const dot = scene.add.circle(cx, cy, px(3), color, alpha).setDepth(20);
    const cleanup = particleCleanup(dot, release);
    scene.tweens.add({
      targets: dot,
      x: cx + Math.cos(angle) * px(14),
      y: cy + Math.sin(angle) * px(10) - px(4),
      alpha: 0,
      scale: 0.4,
      duration: 380,
      ease: 'Quad.easeOut',
      onComplete: cleanup,
      onStop: cleanup,
    });
  }
}

function droplets(scene: Phaser.Scene, cx: number, cy: number): void {
  for (let i = 0; i < 5; i += 1) {
    const release = reserveSceneParticle(scene);
    if (!release) break;
    const startX = cx - px(10) + i * px(5);
    const drop = scene.add.circle(startX, cy - px(14), px(2), 0x6fb6ff, 0.95).setDepth(20);
    const cleanup = particleCleanup(drop, release);
    scene.tweens.add({
      targets: drop,
      y: cy + px(6),
      alpha: 0,
      duration: 420,
      delay: i * 40,
      ease: 'Quad.easeIn',
      onComplete: cleanup,
      onStop: cleanup,
    });
  }
}

function sprout(scene: Phaser.Scene, cx: number, cy: number): void {
  const release = reserveSceneParticle(scene);
  if (!release) return;
  const leaf = scene.add.ellipse(cx, cy, px(10), px(14), 0x7fcf6b).setDepth(20).setScale(0.2);
  const cleanup = particleCleanup(leaf, release);
  scene.tweens.add({
    targets: leaf,
    scale: 1,
    duration: 260,
    ease: 'Back.easeOut',
    yoyo: true,
    hold: 200,
    onComplete: cleanup,
    onStop: cleanup,
  });
}

function sparkle(scene: Phaser.Scene, cx: number, cy: number): void {
  for (let i = 0; i < 4; i += 1) {
    const release = reserveSceneParticle(scene);
    if (!release) break;
    const angle = (Math.PI / 2) * i + Math.PI / 4;
    const star = scene.add.star(cx, cy, 4, px(2), px(5), 0xffe08a).setDepth(20);
    const cleanup = particleCleanup(star, release);
    scene.tweens.add({
      targets: star,
      x: cx + Math.cos(angle) * px(18),
      y: cy + Math.sin(angle) * px(18),
      alpha: 0,
      scale: 0.3,
      duration: 480,
      ease: 'Cubic.easeOut',
      onComplete: cleanup,
      onStop: cleanup,
    });
  }
}

function waterRipple(scene: Phaser.Scene, cx: number, cy: number): void {
  for (let ring = 0; ring < 2; ring += 1) {
    const release = reserveSceneParticle(scene);
    if (!release) return;
    const ripple = scene.add.ellipse(cx, cy, px(8), px(3), 0x6fb6ff, 0.8).setDepth(20).setScale(0.35, 0.6);
    const cleanup = particleCleanup(ripple, release);
    scene.tweens.add({
      targets: ripple,
      scaleX: 2.8,
      scaleY: 1.4,
      alpha: 0,
      duration: 420,
      delay: ring * 100,
      ease: 'Quad.easeOut',
      onComplete: cleanup,
      onStop: cleanup,
    });
  }
  for (let i = 0; i < 4; i += 1) {
    const release = reserveSceneParticle(scene);
    if (!release) return;
    const angle = (Math.PI * 2 * i) / 4;
    const drop = scene.add.circle(cx, cy, px(2), 0xb7e7ff, 0.9).setDepth(20);
    const cleanup = particleCleanup(drop, release);
    scene.tweens.add({
      targets: drop,
      x: cx + Math.cos(angle) * px(12),
      y: cy + Math.sin(angle) * px(7) - px(2),
      alpha: 0,
      scale: 0.35,
      duration: 360,
      ease: 'Quad.easeOut',
      onComplete: cleanup,
      onStop: cleanup,
    });
  }
}

function particleCleanup(particle: Phaser.GameObjects.GameObject, release: () => void): () => void {
  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    try {
      particle.destroy();
    } finally {
      release();
    }
  };
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
