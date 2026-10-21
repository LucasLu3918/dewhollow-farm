import type { SoundsFile } from '../../infrastructure/content/content-schema';
import { AudioOutput } from './audio-output';
import { renderSound } from './synth';

/** 開發模式的紀錄最多保留這麼多筆。 */
const LOG_LIMIT = 200;

/**
 * 音效播放器：第一次需要某個音效時才把配方算成緩衝區（之後重用）。
 * 沒有音訊裝置、瀏覽器拒絕播放、或被靜音時都靜默略過，不影響遊戲。
 * 靜音旗標與 AudioContext 由 AudioOutput 提供，與背景音樂共用。
 */
export class SoundPlayer {
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly played: string[] = [];

  constructor(
    private readonly file: SoundsFile,
    private readonly output: AudioOutput = new AudioOutput(),
  ) {}

  play(id: string): void {
    if (this.output.isMuted()) return;
    const recipe = this.file.sounds[id];
    if (!recipe) throw new Error(`找不到音效：${id}`);
    this.played.push(id);
    if (this.played.length > LOG_LIMIT) this.played.shift();
    try {
      const context = this.output.ensureContext();
      const buffer = this.buffers.get(id) ?? this.render(id, context);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start();
    } catch {
      // 沒有音訊裝置、或瀏覽器不允許播放：略過這次，遊戲照常進行。
    }
  }

  /** 切換靜音（音效與音樂一起）並記住選擇；回傳切換後是否靜音。 */
  toggleMute(): boolean {
    return this.output.toggleMute();
  }

  isMuted(): boolean {
    return this.output.isMuted();
  }

  /** 開發模式用：最近播放過的音效（靜音時不記）。 */
  playedIds(): string[] {
    return [...this.played];
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
