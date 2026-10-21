/**
 * 音訊的共用出口：音效與背景音樂共用同一個 AudioContext，也共用同一個靜音旗標（按 M）。
 * 靜音是玩家的偏好，記在本機 localStorage；讀寫失敗就當作沒有記住。
 */

/** 記住靜音的鍵（沿用既有的鍵，不另外建立衝突的開關）。 */
export const MUTE_KEY = 'dewhollow.muted';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

type MuteListener = (muted: boolean) => void;

function defaultStore(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export class AudioOutput {
  private context: AudioContext | null = null;
  private muted: boolean;
  private readonly listeners = new Set<MuteListener>();

  constructor(private readonly store: Store | null = defaultStore()) {
    this.muted = readMuted(store);
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** 切換靜音並記住選擇；回傳切換後是否靜音。 */
  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      this.store?.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // 記不住也沒關係，這次仍然生效。
    }
    for (const listener of this.listeners) listener(this.muted);
    return this.muted;
  }

  /** 靜音狀態改變時通知（音樂據此淡出或淡入）。回傳取消訂閱的函式。 */
  onMuteChange(listener: MuteListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 取得（第一次需要時建立）共用的 AudioContext；瀏覽器暫停時喚醒。
   * 沒有音訊裝置或瀏覽器不允許時會丟出錯誤，呼叫端自行略過。
   */
  ensureContext(): AudioContext {
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
    return this.context;
  }
}

function readMuted(store: Store | null): boolean {
  try {
    return store?.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
