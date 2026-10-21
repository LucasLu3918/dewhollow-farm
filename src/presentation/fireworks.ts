import Phaser from 'phaser';
import { prefersReducedMotion } from './motion';
import { burstPoints } from './firework-layout';

/**
 * 夜市的煙火（M5c）：純演出，不影響任何規則。
 * 減少動態（prefers-reduced-motion）時不飛散，只留下一組靜態光點，過一陣子就淡掉。
 */

const SPARKS = 10;
const RADIUS = 26;
const FLIGHT_MS = 900;
const LINGER_MS = 1400;
/** 煙火在世界之上、天色遮罩之下。 */
const DEPTH_FIREWORK = 30;
const COLORS = [0xffe38a, 0xffb3d9, 0x9fe8ff, 0xc8ffb0];

/** 在 (x, y)（世界座標）放一朵煙火；顏色依序輪流。 */
export function playFirework(scene: Phaser.Scene, x: number, y: number, colorIndex: number): void {
  const color = COLORS[colorIndex % COLORS.length] ?? COLORS[0]!;
  const points = burstPoints(SPARKS, RADIUS, Math.random() * Math.PI * 2);
  if (prefersReducedMotion()) {
    // 減少動態：不飛散，畫一組靜止的光點，停一下就淡掉。
    const dots = scene.add.graphics().setDepth(DEPTH_FIREWORK);
    dots.fillStyle(color, 0.9);
    for (const p of points) dots.fillCircle(x + p.dx * 0.6, y + p.dy * 0.6, 2);
    scene.tweens.add({ targets: dots, alpha: 0, delay: LINGER_MS, duration: 600, onComplete: () => dots.destroy() });
    return;
  }
  for (const p of points) {
    const spark = scene.add.circle(x, y, 2, color, 1).setDepth(DEPTH_FIREWORK);
    scene.tweens.add({
      targets: spark,
      x: x + p.dx,
      y: y + p.dy,
      alpha: 0,
      duration: FLIGHT_MS,
      ease: 'Quad.easeOut',
      onComplete: () => spark.destroy(),
    });
  }
}
