import type { SoundRecipe } from '../../infrastructure/content/content-schema';

/**
 * 音效合成（純函式，不依賴瀏覽器）：把一組音軌算成一段取樣值，播放時再交給 Web Audio。
 * 同一份配方每次算出的結果完全相同（雜訊的亂數也是固定的），所以可以用單元測試檢查。
 * 配方的格式與範圍見 content/sounds.json 與 content-schema.ts。
 */

type Voice = SoundRecipe['voices'][number];

/** 取樣數取整時容忍的浮點誤差（0.4 秒 × 8000 取樣不應變成 3201 個）。 */
const EPSILON = 1e-6;

/** 第 local 秒時的音高（Hz）。音高以等比例（對數）滑動，聽起來才是等距的音程。 */
export function frequencyAt(voice: Pick<Voice, 'from' | 'to' | 'duration'>, local: number): number {
  const to = voice.to ?? voice.from;
  if (to === voice.from) return voice.from;
  return voice.from * Math.pow(to / voice.from, local / voice.duration);
}

/** 第 local 秒時的音量：先線性升到 gain（attack 時間），之後線性降到 0。 */
export function envelopeAt(voice: Pick<Voice, 'gain' | 'attack' | 'duration'>, local: number): number {
  if (local < 0 || local >= voice.duration) return 0;
  const attack = Math.min(voice.attack, voice.duration);
  if (attack > 0 && local < attack) return voice.gain * (local / attack);
  const rest = voice.duration - attack;
  return voice.gain * (rest > 0 ? 1 - (local - attack) / rest : 0);
}

/** 一個週期中、位置 frac（0 到 1）的波形值，範圍 -1 到 1。 */
function waveAt(wave: Voice['wave'], frac: number): number {
  switch (wave) {
    case 'sine':
      return Math.sin(2 * Math.PI * frac);
    case 'triangle':
      return 4 * Math.abs(frac - 0.5) - 1;
    case 'square':
      return frac < 0.5 ? 1 : -1;
    case 'sawtooth':
      return 2 * frac - 1;
    case 'noise':
      return 0; // 雜訊由 renderSound 另外產生
  }
}

/** 把配方算成單聲道取樣值（-1 到 1）。master 是整體音量。 */
export function renderSound(recipe: SoundRecipe, sampleRate: number, master = 1): Float32Array<ArrayBuffer> {
  const end = Math.max(...recipe.voices.map((voice) => voice.start + voice.duration));
  const out = new Float32Array(Math.ceil(end * sampleRate - EPSILON));
  // xorshift32，固定種子：同一份配方每次的雜訊都一樣。
  let state = 0x9e3779b9 | 0;
  const noise = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 2147483648 - 1;
  };

  for (const voice of recipe.voices) {
    const first = Math.ceil(voice.start * sampleRate - EPSILON);
    const last = Math.min(out.length, Math.ceil((voice.start + voice.duration) * sampleRate - EPSILON));
    let phase = 0; // 以週期計的相位，音高滑動時連續
    for (let i = first; i < last; i += 1) {
      const local = i / sampleRate - voice.start;
      const level = envelopeAt(voice, local);
      let sample: number;
      if (voice.wave === 'noise') {
        sample = noise();
      } else {
        phase += frequencyAt(voice, local) / sampleRate;
        sample = waveAt(voice.wave, phase - Math.floor(phase));
      }
      out[i] = (out[i] ?? 0) + sample * level;
    }
  }

  for (let i = 0; i < out.length; i += 1) {
    out[i] = Math.max(-1, Math.min(1, (out[i] ?? 0) * master));
  }
  return out;
}
