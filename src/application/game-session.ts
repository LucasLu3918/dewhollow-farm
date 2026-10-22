import { mineLayerOf } from '../domain/mine';
import type { ContentPack } from '../domain/content';
import { createNewGame, type GameState } from '../domain/game-state';
import { executeCommand, type Command, type CommandOutcome } from './game-commands';
import type { ContentIndex } from './content-index';
import type { SaveRepository } from './ports';

export const DEFAULT_SLOT = 'slot-1';

/** 兩次指令相隔超過這麼久，視為玩家離開座位，這段時間不計入遊玩時數。 */
const IDLE_LIMIT_MS = 60_000;

export interface SessionOptions {
  slot?: string;
  /** 是否從既有存檔還原（用於 UI 顯示「繼續」或「新遊戲」）。 */
  restored?: boolean;
  /** 時鐘，單位毫秒；測試時可注入假時鐘。 */
  now?: () => number;
  /** 遊戲版本號，每次存檔都會寫進紀錄（見 SaveRecord.gameVersion）。 */
  gameVersion?: string;
}

/**
 * 一局遊戲的應用層入口：持有目前狀態、執行指令、處理存檔。
 * 畫面層只透過這裡送出指令與讀取狀態。
 */
export class GameSession {
  private current: GameState;
  private readonly slot: string;
  private readonly now: () => number;
  private readonly gameVersion: string | undefined;
  readonly restored: boolean;

  /** 本次開啟前已累計的遊玩秒數，與 activeMs 相加後寫入存檔。 */
  private readonly baseSeconds: number;
  private activeMs = 0;
  private lastActivityAt: number;

  constructor(
    initial: GameState,
    private readonly index: ContentIndex,
    private readonly repository: SaveRepository,
    options: SessionOptions = {},
  ) {
    this.current = initial;
    const layer = mineLayerOf(initial.mapId);
    if (layer !== null) index.ensureMine(layer, initial.mineSeed);
    this.slot = options.slot ?? DEFAULT_SLOT;
    this.restored = options.restored ?? false;
    this.now = options.now ?? Date.now;
    this.gameVersion = options.gameVersion;
    this.baseSeconds = initial.playtimeSeconds;
    this.lastActivityAt = this.now();
  }

  /** 讀取既有存檔；沒有存檔時建立新遊戲。存檔損毀時直接拋出，不會覆蓋玩家資料。 */
  static async open(
    pack: ContentPack,
    index: ContentIndex,
    repository: SaveRepository,
    seed: number,
    slot: string = DEFAULT_SLOT,
    options: Omit<SessionOptions, 'slot' | 'restored'> = {},
  ): Promise<GameSession> {
    const existing = await repository.load(slot);
    if (existing) {
      return new GameSession(existing.state, index, repository, { ...options, slot, restored: true });
    }
    return new GameSession(createNewGame(pack, seed), index, repository, { ...options, slot, restored: false });
  }

  get state(): GameState {
    return this.current;
  }

  async dispatch(command: Command): Promise<CommandOutcome> {
    this.trackActivity();
    const outcome = executeCommand(this.current, command, this.index);
    this.current = outcome.state;

    const messages = [...outcome.messages];
    if (outcome.events.some((e) => e.type === 'slept')) {
      try {
        await this.save();
      } catch (error) {
        messages.push(`自動存檔失敗：${describe(error)}`);
      }
    }
    if (outcome.events.some((e) => e.type === 'saveRequested')) {
      await this.save();
      messages.push('已存檔');
    }
    return { ...outcome, messages };
  }

  async save(): Promise<void> {
    this.current = { ...this.current, playtimeSeconds: this.baseSeconds + Math.floor(this.activeMs / 1000) };
    await this.repository.save({
      slot: this.slot,
      savedAt: new Date(this.now()).toISOString(),
      state: this.current,
      ...(this.gameVersion !== undefined ? { gameVersion: this.gameVersion } : {}),
    });
  }

  private trackActivity(): void {
    const at = this.now();
    const gap = at - this.lastActivityAt;
    if (gap > 0 && gap <= IDLE_LIMIT_MS) this.activeMs += gap;
    this.lastActivityAt = at;
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
