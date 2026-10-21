import { describe, expect, it } from 'vitest';
import music from '../../../content/music.json';
import { musicFileSchema, type MusicTrackDef } from '../../infrastructure/content/content-schema';
import { midiToHz, noteEnvelope, notesInWindow, loopTimeline, periodOf, pitchOf, selectTrack } from './music-track';

const file = musicFileSchema.parse(music);

function shipped(id: string): MusicTrackDef {
  const track = file.tracks.find((t) => t.id === id);
  if (!track) throw new Error(`沒有曲目 ${id}`);
  return track;
}

/** 測試用的小曲：60 BPM，一拍一秒，循環長 4 秒。 */
function miniTrack(overrides: Partial<MusicTrackDef> = {}): MusicTrackDef {
  return {
    id: 'mini',
    season: 'spring',
    period: 'day',
    tonic: 60,
    scale: 'major',
    bpm: 60,
    melody: { wave: 'triangle', gain: 0.3, octaves: 0, notes: [[0, 1], [null, 1], [2, 2]] },
    bass: { wave: 'sine', gain: 0.3, octaves: -1, notes: [[0, 4]] },
    ...overrides,
  };
}

const scales = file.scales;

describe('periodOf', () => {
  it('is night from 18:00 until 06:00, and day in between', () => {
    expect(periodOf(17 * 60 + 59)).toBe('day');
    expect(periodOf(18 * 60)).toBe('night');
    expect(periodOf(23 * 60 + 30)).toBe('night');
    expect(periodOf(0)).toBe('night');
    expect(periodOf(5 * 60 + 59)).toBe('night');
    expect(periodOf(6 * 60)).toBe('day');
    expect(periodOf(12 * 60)).toBe('day');
  });
});

describe('selectTrack', () => {
  const base = { season: 'spring' as const, weather: 'sunny' as const, current: null, rainKeepsTrack: true };

  it('switches to the night track at 18:00', () => {
    expect(selectTrack(file.tracks, { ...base, minuteOfDay: 17 * 60 + 59 }).id).toBe('spring.day');
    expect(selectTrack(file.tracks, { ...base, minuteOfDay: 18 * 60 }).id).toBe('spring.night');
  });

  it('returns to the day track at 06:00', () => {
    expect(selectTrack(file.tracks, { ...base, minuteOfDay: 5 * 60 + 59 }).id).toBe('spring.night');
    expect(selectTrack(file.tracks, { ...base, minuteOfDay: 6 * 60 }).id).toBe('spring.day');
  });

  it('changes the track when the season changes', () => {
    const summer = selectTrack(file.tracks, { ...base, season: 'summer', minuteOfDay: 10 * 60, current: 'spring.day' });
    expect(summer.id).toBe('summer.day');
    const winterNight = selectTrack(file.tracks, { ...base, season: 'winter', minuteOfDay: 22 * 60, current: 'summer.day' });
    expect(winterNight.id).toBe('winter.night');
  });

  it('keeps the current track while it rains when rainKeepsTrack is on', () => {
    for (const weather of ['rain', 'storm'] as const) {
      const kept = selectTrack(file.tracks, { ...base, season: 'winter', minuteOfDay: 22 * 60, weather, current: 'spring.day' });
      expect(kept.id, weather).toBe('spring.day');
    }
  });

  it('switches during rain when rainKeepsTrack is off', () => {
    const switched = selectTrack(file.tracks, { ...base, season: 'winter', minuteOfDay: 22 * 60, weather: 'rain', current: 'spring.day', rainKeepsTrack: false });
    expect(switched.id).toBe('winter.night');
  });

  it('switches once the rain stops', () => {
    const after = selectTrack(file.tracks, { ...base, season: 'winter', minuteOfDay: 22 * 60, weather: 'sunny', current: 'spring.day' });
    expect(after.id).toBe('winter.night');
  });

  it('plays the desired track when rain starts with nothing playing yet', () => {
    const first = selectTrack(file.tracks, { ...base, weather: 'rain', minuteOfDay: 9 * 60, current: null });
    expect(first.id).toBe('spring.day');
  });

  it('fails loudly when a season and period has no track', () => {
    const onlyDay = file.tracks.filter((t) => t.period === 'day');
    expect(() => selectTrack(onlyDay, { ...base, minuteOfDay: 22 * 60 })).toThrow(RangeError);
  });
});

describe('pitchOf and midiToHz', () => {
  it('walks the scale by degree, wrapping into the next octave', () => {
    const major = scales.major ?? [];
    expect(pitchOf(60, major, 0, 0)).toBe(60);
    expect(pitchOf(60, major, 2, 0)).toBe(64);
    expect(pitchOf(60, major, 6, 0)).toBe(71);
    expect(pitchOf(60, major, 7, 0)).toBe(72);
  });

  it('handles negative degrees and octave shifts', () => {
    const pentatonic = scales.pentatonic ?? [];
    expect(pitchOf(60, pentatonic, -1, 0)).toBe(60 - 3);
    expect(pitchOf(60, pentatonic, 0, -1)).toBe(48);
  });

  it('converts MIDI notes to Hz with A4 = 440', () => {
    expect(midiToHz(69)).toBeCloseTo(440, 10);
    expect(midiToHz(81)).toBeCloseTo(880, 10);
    expect(midiToHz(60)).toBeCloseTo(261.6256, 3);
  });
});

describe('loopTimeline', () => {
  it('lays notes out in beats at the track tempo and skips rests', () => {
    const timeline = loopTimeline(miniTrack(), scales);
    expect(timeline.loopSec).toBe(4);
    const melody = timeline.notes.filter((n) => n.voice === 'melody');
    expect(melody.map((n) => n.at)).toEqual([0, 2]);
    expect(melody.map((n) => n.duration)).toEqual([1, 2]);
    expect(melody[0]?.hz).toBeCloseTo(midiToHz(60), 6);
    expect(melody[1]?.hz).toBeCloseTo(midiToHz(64), 6);
  });

  it('puts the bass an octave down', () => {
    const bass = loopTimeline(miniTrack(), scales).notes.filter((n) => n.voice === 'bass');
    expect(bass).toHaveLength(1);
    expect(bass[0]?.hz).toBeCloseTo(midiToHz(48), 6);
  });

  it('scales the loop length with the tempo', () => {
    const fast = loopTimeline(miniTrack({ bpm: 120 }), scales);
    expect(fast.loopSec).toBeCloseTo(2, 10);
  });

  it('agrees with the shipped tracks: each loop is as long as its beats say', () => {
    for (const track of file.tracks) {
      const timeline = loopTimeline(track, scales);
      const beats = track.melody.notes.reduce((sum, [, b]) => sum + b, 0);
      expect(timeline.loopSec, track.id).toBeCloseTo((beats * 60) / track.bpm, 9);
      for (const note of timeline.notes) {
        expect(note.at, track.id).toBeGreaterThanOrEqual(0);
        expect(note.at + note.duration, track.id).toBeLessThanOrEqual(timeline.loopSec + 1e-9);
      }
    }
  });
});

describe('notesInWindow', () => {
  const timeline = loopTimeline(miniTrack(), scales);

  it('repeats the loop as often as the window needs', () => {
    const starts = notesInWindow(timeline, 0, 9).filter((n) => n.voice === 'melody').map((n) => n.at);
    expect(starts).toEqual([0, 2, 4, 6, 8]);
  });

  it('includes a start time and excludes the end time', () => {
    expect(notesInWindow(timeline, 4, 6).filter((n) => n.voice === 'melody').map((n) => n.at)).toEqual([4]);
    expect(notesInWindow(timeline, 8, 8)).toEqual([]);
  });

  it('gives the same notes whether a span is scheduled in one piece or several', () => {
    const whole = notesInWindow(timeline, 0.3, 11.7);
    const pieces = [...notesInWindow(timeline, 0.3, 4), ...notesInWindow(timeline, 4, 7.5), ...notesInWindow(timeline, 7.5, 11.7)];
    expect(pieces.map((n) => [n.voice, n.at])).toEqual(whole.map((n) => [n.voice, n.at]));
  });

  it('returns nothing for an empty or backwards window', () => {
    expect(notesInWindow(timeline, 5, 3)).toEqual([]);
  });
});

describe('noteEnvelope', () => {
  it('ramps up to the voice gain, holds, and ends at zero', () => {
    const points = noteEnvelope(1, 0.4);
    expect(points[0]).toEqual({ time: 0, value: 0 });
    expect(Math.max(...points.map((p) => p.value))).toBeCloseTo(0.4, 10);
    expect(points[points.length - 1]).toEqual({ time: 1, value: 0 });
    for (let i = 1; i < points.length; i += 1) expect(points[i]?.time ?? 0).toBeGreaterThanOrEqual(points[i - 1]?.time ?? 0);
  });

  it('keeps the attack and release inside very short notes', () => {
    const points = noteEnvelope(0.02, 0.5);
    for (const point of points) expect(point.time).toBeLessThanOrEqual(0.02 + 1e-12);
    expect(points[points.length - 1]?.value).toBe(0);
  });
});
