import type { ContentPack } from '../domain/content';
import { createNewGame, type GameState } from '../domain/game-state';
import { executeCommand, type Command, type CommandOutcome } from './game-commands';
import type { ContentIndex } from './content-index';
import type { SaveRepository } from './ports';

export const DEFAULT_SLOT = 'slot-1';

/**
 * 一局遊戲的應用層入口：持有目前狀態、執行指令、處理存檔。
 * 畫面層只透過這裡送出指令與讀取狀態。
 */
export class GameSession {
  private current: GameState;

  constructor(
    initial: GameState,
    private readonly index: ContentIndex,
    private readonly repository: SaveRepository,
    private readonly slot: string = DEFAULT_SLOT,
    /** 是否從既有存檔還原（用於 UI 顯示「繼續」或「新遊戲」）。 */
    readonly restored: boolean = false,
  ) {
    this.current = initial;
  }

  /** 讀取既有存檔；沒有存檔時建立新遊戲。存檔損毀時直接拋出，不會覆蓋玩家資料。 */
  static async open(
    pack: ContentPack,
    index: ContentIndex,
    repository: SaveRepository,
    seed: number,
    slot: string = DEFAULT_SLOT,
  ): Promise<GameSession> {
    const existing = await repository.load(slot);
    if (existing) {
      return new GameSession(existing.state, index, repository, slot, true);
    }
    return new GameSession(createNewGame(pack, seed), index, repository, slot, false);
  }

  get state(): GameState {
    return this.current;
  }

  async dispatch(command: Command): Promise<CommandOutcome> {
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
    await this.repository.save({
      slot: this.slot,
      savedAt: new Date().toISOString(),
      state: this.current,
    });
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
