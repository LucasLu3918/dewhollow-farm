import type { SoundsFile } from '../../infrastructure/content/content-schema';
import { renderSound } from './synth';

/** 記住靜音的鍵；只是玩家的偏好，讀寫失敗時就當作沒有記住。 */
const MUTE_KEY = 'dewhollow.muted';

/** 開發模式的紀錄最多保留這麼多筆。 */
const LOG_LIMIT = 200;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStore(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * 音效播放器：第一次需要某個音效時才把配方算成緩衝區（之後重用）。
 * 沒有音訊裝置、瀏覽器拒絕播放、或被靜音時都靜默略過，不影響遊戲。
 */
export class SoundPlayer {
  private context: AudioContext | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly played: string[] = [];
  private muted: boolean;

  constructor(
    private readonly file: SoundsFile,
    private readonly store: Store | null = defaultStore(),
  ) {
    this.muted = readMuted(store);
  }

  play(id: string): void {
    if (this.muted) return;
    const recipe = this.file.sounds[id];
    if (!recipe) throw new Error(`找不到音效：${id}`);
    this.played.push(id);
    if (this.played.length > LOG_LIMIT) this.played.shift();
    try {
      const context = this.ensureContext();
      const buffer = this.buffers.get(id) ?? this.render(id, context);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start();
    } catch {
      // 沒有音訊裝置、或瀏覽器不允許播放：略過這次，遊戲照常進行。
    }
  }

  /** 切換靜音並記住選擇；回傳切換後是否靜音。 */
  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      this.store?.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // 記不住也沒關係，這次仍然生效。
    }
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** 開發模式用：最近播放過的音效（靜音時不記）。 */
  playedIds(): string[] {
    return [...this.played];
  }

  private ensureContext(): AudioContext {
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
    return this.context;
  }

  private render(id: string, context: AudioContext): AudioBuffer {
    const recipe = this.file.sounds[id];
    if (!recipe) throw new Error(`找不到音效：${id}`);
    const samples = renderSound(recipe, context.sampleRate, this.file.master);
    const buffer = context.createBuffer(1, samples.length, context.sampleRate);
    buffer.copyToChannel(samples, 0);
    this.buffers.set(id, buffer);
    return buffer;
  }
}

function readMuted(store: Store | null): boolean {
  try {
    return store?.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
