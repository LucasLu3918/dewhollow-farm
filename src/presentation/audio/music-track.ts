import type { Season } from '../../domain/calendar';
import type { Weather } from '../../domain/weather';
import type { MusicTrackDef, MusicVoiceDef } from '../../infrastructure/content/content-schema';

/**
 * 背景音樂的純函式（不依賴 WebAudio）：選曲、音高、音符在循環中的時間，以及音量包絡的轉折點。
 * 播放器（music-player.ts）只負責把這些時間排進 AudioContext，這裡的結果可以用單元測試檢查。
 */

export type Period = 'day' | 'night';

/** 夜晚從 18:00 開始，到次日 06:00 結束（與夜色遮罩的時段一致）。 */
const NIGHT_START_MINUTE = 18 * 60;
const NIGHT_END_MINUTE = 6 * 60;

export function periodOf(minuteOfDay: number): Period {
  return minuteOfDay >= NIGHT_START_MINUTE || minuteOfDay < NIGHT_END_MINUTE ? 'night' : 'day';
}

export interface TrackChoice {
  season: Season;
  minuteOfDay: number;
  weather: Weather;
  /** 目前正在播的曲目 id；沒有就是 null。 */
  current: string | null;
  /** 雨天時是否保持原曲（content/music.json 的 rainKeepsTrack）。 */
  rainKeepsTrack: boolean;
}

/**
 * 依季節與時段選曲。雨天且設定為保持原曲時，若正在播放的曲目仍存在，就不換曲（等雨停再換）。
 * 找不到對應季節與時段的曲目時丟出錯誤；載入內容時已檢查，這裡不應發生。
 */
export function selectTrack(tracks: readonly MusicTrackDef[], choice: TrackChoice): MusicTrackDef {
  const period = periodOf(choice.minuteOfDay);
  const desired = tracks.find((t) => t.season === choice.season && t.period === period);
  if (!desired) throw new RangeError(`沒有 ${choice.season} ${period} 的曲目`);
  const raining = choice.weather === 'rain' || choice.weather === 'storm';
  if (choice.rainKeepsTrack && raining && choice.current !== null) {
    const held = tracks.find((t) => t.id === choice.current);
    if (held) return held;
  }
  return desired;
}

/** 音階第 degree 個音（可為負數或超過一個八度）對應的 MIDI 音高；octaves 是額外的八度移位。 */
export function pitchOf(tonic: number, intervals: readonly number[], degree: number, octaves: number): number {
  const size = intervals.length;
  const octave = Math.floor(degree / size);
  const step = degree - octave * size;
  return tonic + 12 * octave + (intervals[step] ?? 0) + 12 * octaves;
}

/** MIDI 音高轉頻率（Hz），A4（69）為 440。 */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export interface LoopNote {
  voice: 'melody' | 'bass';
  /** 從循環開頭算起的秒數。 */
  at: number;
  duration: number;
  hz: number;
}

export interface LoopTimeline {
  loopSec: number;
  /** 一個循環內所有發聲的音符（休止符不產生音符）。 */
  notes: LoopNote[];
}

/** 把一首曲目展開成一個循環內的音符時間表。 */
export function loopTimeline(track: MusicTrackDef, scales: Readonly<Record<string, readonly number[]>>): LoopTimeline {
  const intervals = scales[track.scale];
  if (!intervals) throw new RangeError(`找不到音階 ${track.scale}`);
  const beatSec = 60 / track.bpm;
  const notes: LoopNote[] = [];
  let loopBeats = 0;
  for (const [voice, def] of [
    ['melody', track.melody],
    ['bass', track.bass],
  ] as const) {
    const beats = voiceTimeline(def, track, intervals, beatSec, voice, notes);
    loopBeats = Math.max(loopBeats, beats);
  }
  notes.sort((a, b) => a.at - b.at);
  return { loopSec: loopBeats * beatSec, notes };
}

function voiceTimeline(
  def: MusicVoiceDef,
  track: MusicTrackDef,
  intervals: readonly number[],
  beatSec: number,
  voice: LoopNote['voice'],
  out: LoopNote[],
): number {
  let beat = 0;
  for (const [degree, beats] of def.notes) {
    if (degree !== null) {
      out.push({
        voice,
        at: beat * beatSec,
        duration: beats * beatSec,
        hz: midiToHz(pitchOf(track.tonic, intervals, degree, def.octaves)),
      });
    }
    beat += beats;
  }
  return beat;
}

/**
 * 在絕對時間 [fromSec, toSec) 之間會發聲的音符，循環會依需要重複。
 * 回傳的 at 是從曲目開始算起的絕對秒數；同一段時間可以分幾次排，結果與一次排完相同。
 */
export function notesInWindow(timeline: LoopTimeline, fromSec: number, toSec: number): LoopNote[] {
  if (!(toSec > fromSec) || !(timeline.loopSec > 0)) return [];
  const result: LoopNote[] = [];
  const first = Math.floor(fromSec / timeline.loopSec);
  const last = Math.floor(toSec / timeline.loopSec);
  for (let loop = first; loop <= last; loop += 1) {
    const base = loop * timeline.loopSec;
    for (const note of timeline.notes) {
      const at = base + note.at;
      if (at >= fromSec && at < toSec) result.push({ ...note, at });
    }
  }
  return result;
}

/** 音量包絡：一個音從 0 起音到 gain，中段保持，尾端釋放回 0（相對於音符開頭的秒數）。 */
export const ATTACK_SEC = 0.02;
export const RELEASE_SEC = 0.08;

export interface EnvelopePoint {
  time: number;
  value: number;
}

export function noteEnvelope(duration: number, gain: number): EnvelopePoint[] {
  const attack = Math.min(ATTACK_SEC, duration / 2);
  const release = Math.min(RELEASE_SEC, duration / 2);
  return [
    { time: 0, value: 0 },
    { time: attack, value: gain },
    { time: duration - release, value: gain },
    { time: duration, value: 0 },
  ];
}
