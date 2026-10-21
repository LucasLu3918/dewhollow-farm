import type { Direction } from '../../src/domain/content';
import type { GameState, ToolId } from '../../src/domain/game-state';
import { executeCommand, type Command, type CommandOutcome } from '../../src/application/game-commands';
import type { ContentIndex } from '../../src/application/content-index';
import { neighbor } from '../../src/domain/world';
import { mineLayerOf } from '../../src/domain/mine';
import { DIRECTIONS, landingOf, lockedDoor, mapOrNull, passable, type Pos } from './world';

/**
 * 無頭機器人的基礎動作：用與遊戲相同的指令（executeCommand）走路、互動，並統計動作數與走路步數。
 * 走路用廣度優先搜尋（BFS）：狀態是（地圖、格子、面向），因為互動是面向目標才做得到。
 */

/**
 * 估計真實時間的假設（見 docs/TECH_PLAN.md「遊玩時數模擬」）：一個有效動作約 12 秒（按鍵、看畫面、判斷）；
 * 走一格約 0.2 秒（按住方向鍵約每秒 5 格）。這兩個數是假設，要用試玩校準。
 */
export const SECONDS_PER_ACTION = 12;
export const SECONDS_PER_STEP = 0.2;

/** 會計入「有效動作」的指令（走路、換工具、切換種子不計）。 */
const COUNTED = new Set<Command['type']>(['interact', 'reel', 'buy', 'upgrade', 'startProcessing', 'collectProcessing', 'cook', 'eat']);

export interface Stats {
  actions: number;
  steps: number;
  /** 被拒絕的動作原因次數，用來看哪裡卡住。 */
  refusals: Record<string, number>;
  /** 本日經由出貨箱結算進帳的金額（睡覺時的訊息）。 */
  shipped: number;
  /** 本日花掉的金幣（購買與升級）。 */
  spent: number;
  /** 到過最深的礦坑層（累計，不隨日重設）。 */
  deepest: number;
}

interface Node {
  mapId: string;
  x: number;
  y: number;
  f: Direction;
  parent: number;
  step: Direction | null;
}

export class Bot {
  state: GameState;
  readonly stats: Stats = { actions: 0, steps: 0, refusals: {}, shipped: 0, spent: 0, deepest: 0 };

  constructor(
    private readonly index: ContentIndex,
    state: GameState,
  ) {
    this.state = state;
  }

  /** 送出一個指令並更新狀態與統計。 */
  apply(command: Command): CommandOutcome {
    const before = this.state;
    const outcome = executeCommand(before, command, this.index);
    this.state = outcome.state;
    const layer = mineLayerOf(this.state.mapId);
    if (layer !== null && layer > this.stats.deepest) this.stats.deepest = layer;
    const refused = outcome.events.find((e) => e.type === 'refused');
    if (refused && refused.type === 'refused') {
      this.stats.refusals[refused.reason] = (this.stats.refusals[refused.reason] ?? 0) + 1;
    }
    const slept = outcome.events.some((e) => e.type === 'slept');
    if (!refused && COUNTED.has(command.type) && !slept) this.stats.actions += 1;
    if (command.type === 'move' && !refused && (outcome.state.player.x !== before.player.x || outcome.state.player.y !== before.player.y || outcome.state.mapId !== before.mapId)) {
      this.stats.steps += 1;
    }
    if (command.type === 'buy' || command.type === 'upgrade') this.stats.spent += Math.max(0, before.gold - outcome.state.gold);
    for (const message of outcome.messages) {
      const match = /出貨箱結算 \+(\d+) 金/.exec(message);
      if (match) this.stats.shipped += Number(match[1]);
    }
    return outcome;
  }

  /** 換到指定工具（已在手上就不做事）。 */
  useTool(tool: ToolId): void {
    if (this.state.tool !== tool) this.apply({ type: 'takeTool', tool });
  }

  /**
   * 走到能面向任一目標的位置。已經面向目標時不走路。
   * 找不到路（被擋住、地圖還沒生成）時回傳 false，狀態不變。
   */
  faceAny(targets: readonly Pos[]): boolean {
    if (targets.length === 0) return false;
    const goal = new Set(targets.map((t) => key(t.mapId, t.x, t.y)));
    return this.follow((n) => {
      const ahead = neighbor(n, n.f);
      return goal.has(key(n.mapId, ahead.x, ahead.y));
    });
  }

  /** 走到任一目標格子上（例如樓梯、洞口）。 */
  standOnAny(targets: readonly Pos[]): boolean {
    if (targets.length === 0) return false;
    const goal = new Set(targets.map((t) => key(t.mapId, t.x, t.y)));
    return this.follow((n) => goal.has(key(n.mapId, n.x, n.y)));
  }

  /** 走到任一格的面向後，做一次互動（或其他指令）。 */
  actOn(targets: readonly Pos[], command: Command): CommandOutcome | null {
    if (!this.faceAny(targets)) return null;
    return this.apply(command);
  }

  /** 走到任一符合條件的位置（地圖與格子）；用來走進門、洞口與樓梯，那些格子本身不會停留。 */
  goTo(isGoal: (mapId: string, x: number, y: number) => boolean): boolean {
    return this.follow((n) => isGoal(n.mapId, n.x, n.y));
  }

  /** 走到第一個符合的位置（BFS，只找最近的一條路）。 */
  private follow(isGoal: (n: Node) => boolean): boolean {
    const start: Node = { mapId: this.state.mapId, x: this.state.player.x, y: this.state.player.y, f: this.state.player.facing, parent: -1, step: null };
    const arena: Node[] = [start];
    const seen = new Set<string>([key(start.mapId, start.x, start.y, start.f)]);
    let head = 0;
    let found = -1;
    while (head < arena.length) {
      const current = arena[head];
      if (!current) break;
      if (isGoal(current)) {
        found = head;
        break;
      }
      head += 1;
      for (const next of this.expand(current, head - 1)) {
        const k = key(next.mapId, next.x, next.y, next.f);
        if (seen.has(k)) continue;
        seen.add(k);
        arena.push(next);
      }
    }
    if (found < 0) return false;
    const steps: Direction[] = [];
    for (let i = found; i > 0; ) {
      const node = arena[i];
      if (!node) break;
      if (node.step) steps.unshift(node.step);
      i = node.parent;
    }
    return this.execute(steps, arena[found]);
  }

  /** 一步的所有可能：走進可通行的格子，或原地轉向（撞到擋路的東西就只會轉身）。 */
  private expand(current: Node, parent: number): Node[] {
    const out: Node[] = [];
    const map = mapOrNull(this.index, current.mapId);
    if (!map) return out;
    for (const d of DIRECTIONS) {
      const t = neighbor(current, d);
      if (passable(this.state, this.index, map, t.x, t.y) && !lockedDoor(this.state, this.index, map, t.x, t.y)) {
        const land = landingOf(this.state, this.index, map, t.x, t.y);
        const node = land ? { mapId: land.mapId, x: land.x, y: land.y, f: d } : { mapId: current.mapId, x: t.x, y: t.y, f: d };
        out.push({ ...node, parent, step: d });
      } else if (d !== current.f) {
        out.push({ mapId: current.mapId, x: current.x, y: current.y, f: d, parent, step: d });
      }
    }
    return out;
  }

  /** 照路線送出 move 指令；若真實結果與預期不符（例如有東西擋住）就停下。 */
  private execute(steps: Direction[], goal: Node | undefined): boolean {
    for (const direction of steps) {
      this.apply({ type: 'move', direction });
    }
    if (!goal) return false;
    return this.state.mapId === goal.mapId && this.state.player.x === goal.x && this.state.player.y === goal.y;
  }
}

function key(mapId: string, x: number, y: number, f?: Direction): string {
  return f ? `${mapId}|${x}|${y}|${f}` : `${mapId}|${x}|${y}`;
}

