import type { Season } from '../../domain/calendar';
import type { Weather } from '../../domain/weather';
import type { MusicFile, MusicTrackDef } from '../../infrastructure/content/content-schema';
import { AudioOutput } from './audio-output';
import { loopTimeline, noteEnvelope, notesInWindow, selectTrack, type LoopNote, type LoopTimeline } from './music-track';

/** 排程的前瞻秒數；要比檢查的間隔長，節拍才不會因為計時器慢了一拍而斷掉。 */
const LOOKAHEAD_SEC = 0.3;
const TICK_MS = 100;
/** 開始時第一個音符比目前時間晚一點，讓它來得及排進去。 */
const START_DELAY_SEC = 0.05;
/** 總音量的變化時間常數（秒），靜音與暫停時不會爆音。 */
const BUS_TIME_CONSTANT_SEC = 0.05;

/** 一層 = 一首曲目的排程：它的增益節點、時間軸起點，以及已經排到哪裡。 */
interface Layer {
  track: MusicTrackDef;
  timeline: LoopTimeline;
  gain: GainNode;
  /** 曲目在 AudioContext 時間軸上的起點（秒）。 */
  startAt: number;
  /** 曲目時間已排到的位置（秒，從起點算起）。 */
  scheduledTo: number;
}

/**
 * 背景音樂播放器：用 WebAudio 振盪器循環播放程式合成的曲目（內容見 content/music.json）。
 * - 預設不播放；玩家按 B 才開始（瀏覽器要求由使用者手勢啟動音訊）。
 * - 靜音（按 M）與音效共用同一個旗標，作用在總音量上。
 * - 換曲時舊曲淡出、新曲淡入。
 * 排程用的時間計算都在 music-track.ts（純函式，有單元測試）。
 */
export class MusicPlayer {
  private context: AudioContext | null = null;
  private bus: GainNode | null = null;
  private playing = false;
  private track: MusicTrackDef | null = null;
  private layer: Layer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly timelines = new Map<string, LoopTimeline>();

  constructor(
    private readonly file: MusicFile,
    private readonly output: AudioOutput,
  ) {
    for (const track of file.tracks) this.timelines.set(track.id, loopTimeline(track, file.scales));
    output.onMuteChange(() => this.applyBus());
  }

  isPlaying(): boolean {
    return this.playing;
  }

  /** 目前選定的曲目 id（還沒選過時為 null）。開發模式與測試用。 */
  currentTrackId(): string | null {
    return this.track?.id ?? null;
  }

  /** 按 B：開始或暫停音樂。回傳切換後是否在播放。無法使用音訊時維持暫停。 */
  toggle(): boolean {
    if (this.playing) this.stop();
    else this.start();
    return this.playing;
  }

  /** 依季節、時段與天氣選曲；換曲時淡出舊曲、淡入新曲。沒有在播放時只記下選擇。 */
  update(season: Season, minuteOfDay: number, weather: Weather): void {
    const next = selectTrack(this.file.tracks, {
      season,
      minuteOfDay,
      weather,
      current: this.track?.id ?? null,
      rainKeepsTrack: this.file.rainKeepsTrack,
    });
    if (next.id === this.track?.id) return;
    this.track = next;
    if (this.playing) this.beginLayer(next);
  }

  private start(): void {
    try {
      this.ensureBus();
    } catch {
      // 沒有音訊裝置或瀏覽器不允許：維持暫停，遊戲照常進行。
      return;
    }
    this.playing = true;
    if (this.track) this.beginLayer(this.track);
    this.tick();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.applyBus();
  }

  private stop(): void {
    this.playing = false;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.retireLayer();
    this.applyBus();
  }

  /** 開始一首曲目：新層從靜音淡入；舊層（若有）淡出後拆掉。 */
  private beginLayer(track: MusicTrackDef): void {
    const context = this.context;
    const bus = this.bus;
    if (!context || !bus) return;
    this.retireLayer();
    const now = context.currentTime;
    const startAt = now + START_DELAY_SEC;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, startAt + this.file.fadeSeconds);
    gain.connect(bus);
    const timeline = this.timelines.get(track.id) ?? loopTimeline(track, this.file.scales);
    this.layer = { track, timeline, gain, startAt, scheduledTo: 0 };
  }

  /** 讓目前這一層淡出並在淡完後拆掉；之後不再排新音符。 */
  private retireLayer(): void {
    const old = this.layer;
    const context = this.context;
    this.layer = null;
    if (!old || !context) return;
    const now = context.currentTime;
    const fade = this.file.fadeSeconds;
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.setValueAtTime(old.gain.gain.value, now);
    old.gain.gain.linearRampToValueAtTime(0, now + fade);
    setTimeout(() => old.gain.disconnect(), (fade + 0.5) * 1000);
  }

  /** 把即將到來的音符排進 AudioContext（前瞻 LOOKAHEAD_SEC 秒）。 */
  private tick(): void {
    const context = this.context;
    const layer = this.layer;
    if (!context || !layer || !this.playing) return;
    const to = context.currentTime - layer.startAt + LOOKAHEAD_SEC;
    if (to <= layer.scheduledTo) return;
    for (const note of notesInWindow(layer.timeline, layer.scheduledTo, to)) this.playNote(context, layer, note);
    layer.scheduledTo = to;
  }

  private playNote(context: AudioContext, layer: Layer, note: LoopNote): void {
    const voice = note.voice === 'melody' ? layer.track.melody : layer.track.bass;
    const start = layer.startAt + note.at;
    const osc = context.createOscillator();
    osc.type = voice.wave;
    osc.frequency.setValueAtTime(note.hz, start);
    const env = context.createGain();
    const points = noteEnvelope(note.duration, voice.gain);
    env.gain.setValueAtTime(points[0]?.value ?? 0, start);
    for (const point of points.slice(1)) env.gain.linearRampToValueAtTime(point.value, start + point.time);
    osc.connect(env).connect(layer.gain);
    osc.start(start);
    osc.stop(start + note.duration + 0.05);
  }

  /** 總音量：播放中且沒有靜音時為內容設定的 master，其餘為 0。 */
  private applyBus(): void {
    const context = this.context;
    const bus = this.bus;
    if (!context || !bus) return;
    const target = this.playing && !this.output.isMuted() ? this.file.master : 0;
    const now = context.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setTargetAtTime(target, now, BUS_TIME_CONSTANT_SEC);
  }

  private ensureBus(): void {
    const context = this.output.ensureContext();
    if (this.context === context && this.bus) return;
    const bus = context.createGain();
    bus.gain.value = 0;
    bus.connect(context.destination);
    this.context = context;
    this.bus = bus;
  }
}
