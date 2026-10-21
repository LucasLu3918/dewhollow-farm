import Phaser from 'phaser';
import { EMOTES, EMOTE_KINDS, type EmoteKind } from './emote-defs';
import { motionFactor } from './tool-swing';

/**
 * 表情氣泡：用 Graphics 在啟動時畫成貼圖（不產圖），顏色全取自共用調色盤（見 emote-defs.ts）。
 * 貼圖是 2x 母版（56×56），遊戲內以 0.5 倍顯示成 28×28，與其他 2x 素材一致。
 */

const SIZE = 56;
/** 2x 母版以 0.5 倍顯示。 */
const BASE_SCALE = 0.5;

const textureKey = (kind: EmoteKind): string => `emote.${kind}`;

function hex(color: string): number {
  return Number.parseInt(color.slice(1), 16);
}

/** 啟動時呼叫一次：為每種表情畫出「氣泡＋符號」的貼圖。 */
export function registerEmoteTextures(scene: Phaser.Scene): void {
  for (const kind of EMOTE_KINDS) {
    if (scene.textures.exists(textureKey(kind))) continue;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    drawBubble(g, kind);
    drawIcon(g, kind);
    g.generateTexture(textureKey(kind), SIZE, SIZE);
    g.destroy();
  }
}

/** 圓角氣泡與左下的小尾巴：深棕外框、暖白底。 */
function drawBubble(g: Phaser.GameObjects.Graphics, kind: EmoteKind): void {
  const { outline, fill } = EMOTES[kind];
  g.fillStyle(hex(outline), 1);
  g.fillRoundedRect(3, 3, 50, 42, 15);
  g.fillTriangle(12, 40, 26, 40, 14, 54);
  g.fillStyle(hex(fill), 1);
  g.fillRoundedRect(6, 6, 44, 36, 12);
  g.fillTriangle(15, 38, 24, 38, 15, 49);
}

/** 符號：先以外框色畫粗一圈，再以符號色畫上去，小尺寸下才清楚。 */
function drawIcon(g: Phaser.GameObjects.Graphics, kind: EmoteKind): void {
  const { icon, outline } = EMOTES[kind];
  const cx = 28;
  const cy = 24;
  const draw = (color: string, grow: number): void => {
    g.fillStyle(hex(color), 1);
    g.lineStyle(5 + grow * 2, hex(color), 1);
    switch (kind) {
      case 'heart':
        g.fillCircle(cx - 6.5, cy - 3, 7 + grow);
        g.fillCircle(cx + 6.5, cy - 3, 7 + grow);
        g.fillTriangle(cx - 13.5 - grow, cy - 0.5, cx + 13.5 + grow, cy - 0.5, cx, cy + 14 + grow);
        break;
      case 'surprise':
        g.fillRoundedRect(cx - 3 - grow, cy - 12 - grow, 6 + grow * 2, 16 + grow * 2, 3);
        g.fillCircle(cx, cy + 10, 3.5 + grow);
        break;
      case 'question':
        g.beginPath();
        g.arc(cx, cy - 4, 7, Math.PI * 1.05, Math.PI * 2.4, false);
        g.lineTo(cx, cy + 5);
        g.strokePath();
        g.fillCircle(cx, cy + 11, 3.2 + grow);
        break;
      case 'sweat':
        g.fillCircle(cx, cy + 4, 8 + grow);
        g.fillTriangle(cx - 7 - grow, cy + 1, cx + 7 + grow, cy + 1, cx, cy - 12 - grow);
        break;
      case 'note':
        g.fillCircle(cx - 5, cy + 8, 5.5 + grow);
        g.fillRect(cx - 1 - grow, cy - 12 - grow, 4 + grow * 2, 20 + grow * 2);
        g.fillTriangle(cx + 3, cy - 12 - grow, cx + 13 + grow, cy - 6, cx + 3, cy - 1);
        break;
      case 'sleepy':
        g.beginPath();
        g.moveTo(cx - 9, cy - 9);
        g.lineTo(cx + 9, cy - 9);
        g.lineTo(cx - 9, cy + 9);
        g.lineTo(cx + 9, cy + 9);
        g.strokePath();
        break;
    }
  };
  draw(outline, 1.6);
  draw(icon, 0);
}

export interface EmoteHandle {
  readonly kind: EmoteKind;
  readonly container: Phaser.GameObjects.Container;
  /** 目前的縮放，相對於最終大小（1 為最終大小；彈出時會超過 1）。 */
  scaleNow(): number;
  destroy(): void;
}

/**
 * 在某個角色頭上彈出表情氣泡：由小彈大、停一下、往上飄並淡出，然後自己消失。
 * 氣泡掛在角色的 root 底下，所以角色移動時它會跟著走。
 * 「減少動態」時不彈跳、不飄動，只淡入淡出。
 * @param headHeight 角色顯示出來的高度（遊戲內像素），氣泡放在它上面。
 */
export function playEmote(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  kind: EmoteKind,
  headHeight: number,
  reducedMotion: boolean,
  onDone: () => void,
): EmoteHandle {
  const bubble = scene.add.image(0, 0, textureKey(kind)).setOrigin(0.18, 1).setScale(BASE_SCALE);
  const container = scene.add.container(headHeight * 0.18, -headHeight - 6, [bubble]);
  parent.add(container);

  const calm = motionFactor(reducedMotion) < 1;
  const restY = container.y;
  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    container.destroy(true);
    onDone();
  };

  if (calm) {
    container.setAlpha(0);
    scene.tweens.chain({
      targets: container,
      tweens: [
        { alpha: 1, duration: 120 },
        { alpha: 1, duration: 700 },
        { alpha: 0, duration: 200, onComplete: finish },
      ],
    });
  } else {
    container.setScale(0);
    scene.tweens.chain({
      targets: container,
      tweens: [
        { scale: 1.25, duration: 190, ease: 'Back.easeOut' },
        { scale: 1, duration: 110, ease: 'Quad.easeOut' },
        { scale: 1, duration: 650 },
        { alpha: 0, y: restY - 8, duration: 250, ease: 'Quad.easeIn', onComplete: finish },
      ],
    });
  }

  return {
    kind,
    container,
    scaleNow: () => container.scale,
    destroy: () => {
      scene.tweens.killTweensOf(container);
      finish();
    },
  };
}
