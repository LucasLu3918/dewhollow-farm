import Phaser from 'phaser';
import type { ContentPack, Direction } from '../../domain/content';
import { tileAt } from '../../domain/world';
import type { GameSession } from '../../application/game-session';
import type { ContentIndex } from '../../application/content-index';
import type { Command, GameEvent } from '../../application/game-commands';
import type { Hud } from '../hud';
import { TILE_SIZE } from '../constants';
import { footstepDust, playActionEffect, sleepEffect, squashSprite, walkBob } from '../effects';

export interface MapSceneDeps {
  session: GameSession;
  index: ContentIndex;
  pack: ContentPack;
  hud: Hud;
}

const MOVE_KEYS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

const COMMAND_KEYS: Record<string, Command> = {
  x: { type: 'interact' },
  z: { type: 'cycleTool' },
  c: { type: 'cycleSeed' },
  s: { type: 'manualSave' },
};

const MOVE_DURATION_MS = 110;

/**
 * 地圖場景：只負責把 GameState 畫出來，並把按鍵轉成指令交給 GameSession。
 * 規則判斷留在應用層；這裡只決定怎麼呈現（方向、走路節奏、動作效果）。
 */
export class MapScene extends Phaser.Scene {
  private deps!: MapSceneDeps;
  private world!: Phaser.GameObjects.Container;
  private player!: Phaser.GameObjects.Image;
  private renderedMapId: string | null = null;
  private shownFacing: Direction = 'down';
  private onKeyDown = (event: KeyboardEvent): void => {
    void this.handleKey(event);
  };

  constructor() {
    super('map');
  }

  init(deps: MapSceneDeps): void {
    this.deps = deps;
  }

  create(): void {
    this.world = this.add.container(0, 0);
    this.player = this.add.image(0, 0, 'player.down').setOrigin(0).setDepth(10);
    window.addEventListener('keydown', this.onKeyDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', this.onKeyDown);
    });
    this.refresh();
  }

  private async handleKey(event: KeyboardEvent): Promise<void> {
    const direction = MOVE_KEYS[event.key];
    const command = direction ? ({ type: 'move', direction } as const) : COMMAND_KEYS[event.key.toLowerCase()];
    if (!command) return;
    event.preventDefault();

    const { hud, session } = this.deps;
    const before = { ...session.state.player };
    try {
      const outcome = await session.dispatch(command);
      hud.messages(outcome.messages);
      this.playEvents(outcome.events, before);
    } catch (error) {
      hud.error(`存檔失敗：${error instanceof Error ? error.message : String(error)}`);
    }
    this.refresh();
  }

  /** 把應用層的事件轉成視覺效果。效果只在這裡播放，規則不受影響。 */
  private playEvents(events: readonly GameEvent[], before: { x: number; y: number }): void {
    for (const event of events) {
      if (event.type === 'acted') {
        squashSprite(this, this.player);
        playActionEffect(this, event.action, event.x, event.y);
      } else if (event.type === 'slept') {
        sleepEffect(this, this.deps.session.state.player.x, this.deps.session.state.player.y);
      }
    }
    const after = this.deps.session.state.player;
    const moved = before.x !== after.x || before.y !== after.y;
    const sameMap = this.renderedMapId === this.deps.session.state.mapId;
    if (moved && sameMap) footstepDust(this, before.x, before.y);
  }

  /** 依目前狀態重畫。地圖切換時整張重建，其餘情況只更新田地、方向與玩家位置。 */
  private refresh(): void {
    const state = this.deps.session.state;
    const map = this.deps.index.map(state.mapId);
    this.deps.hud.update(state, this.deps.pack);

    if (this.renderedMapId !== map.id) {
      this.renderedMapId = map.id;
      this.drawMap(map.id);
      this.player.setPosition(state.player.x * TILE_SIZE, state.player.y * TILE_SIZE);
    }

    this.showFacing(state.player.facing);
    this.drawPlots();
    this.movePlayer(state.player.x, state.player.y);
  }

  /** 換成面向的那一張圖；原地轉身時只換圖，不移動。 */
  private showFacing(facing: Direction): void {
    if (facing === this.shownFacing) return;
    this.shownFacing = facing;
    this.player.setTexture(`player.${facing}`);
  }

  private drawMap(mapId: string): void {
    this.world.removeAll(true);
    const map = this.deps.index.map(mapId);

    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const tile = tileAt(map, x, y);
        if (!tile) continue;
        this.world.add(this.image(`tile.${tile.kind}`, x, y, 0));
      }
    }

    for (const placement of map.npcs) {
      const npc = this.deps.index.npc(placement.npcId);
      this.world.add(this.image(`npc.${npc.id}`, placement.x, placement.y, 5));
    }
  }

  private drawPlots(): void {
    const state = this.deps.session.state;
    const map = this.deps.index.map(state.mapId);
    this.world.getAll().forEach((child) => {
      if (child.getData('plot')) child.destroy();
    });

    for (const [key, plot] of Object.entries(state.plots)) {
      const [x, y] = key.split(',').map(Number);
      if (x === undefined || y === undefined) continue;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;

      const soil = this.image('tile.soil', x, y, 1);
      soil.setData('plot', true);
      if (plot.watered) soil.setTint(0x6fa8dc);
      this.world.add(soil);

      if (plot.crop) {
        const crop = this.deps.index.crop(plot.crop.cropId);
        const ratio = Math.min(1, plot.crop.growthDays / crop.growthDays);
        const sprite = this.image(`crop.${crop.id}`, x, y, 2);
        sprite.setScale(0.5 + 0.5 * ratio);
        sprite.setAlpha(0.5 + 0.5 * ratio);
        sprite.setData('plot', true);
        this.world.add(sprite);
      }
    }
  }

  private movePlayer(x: number, y: number): void {
    const targetX = x * TILE_SIZE;
    const targetY = y * TILE_SIZE;
    if (this.player.x === targetX && this.player.y === targetY) return;
    walkBob(this, this.player, targetX, targetY, MOVE_DURATION_MS);
  }

  private image(key: string, x: number, y: number, depth: number): Phaser.GameObjects.Image {
    return this.add
      .image(x * TILE_SIZE, y * TILE_SIZE, key)
      .setOrigin(0)
      .setDepth(depth);
  }
}
