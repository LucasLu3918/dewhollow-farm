import { describe, expect, it } from 'vitest';
import music from '../../../content/music.json';
import { musicFileSchema } from './content-schema';
import { musicProblems } from './load-content';

function withTracks(edit: (tracks: unknown[]) => unknown[]): unknown {
  return { ...music, tracks: edit(structuredClone(music.tracks)) };
}

describe('music content', () => {
  it('ships eight tracks, one per season and period, with no problems', () => {
    const file = musicFileSchema.parse(music);
    expect(file.tracks).toHaveLength(8);
    expect(musicProblems(file)).toEqual([]);
  });

  it('says where the music comes from', () => {
    expect(music.source).toContain('程式合成');
    expect(music.source).toContain('自行作曲');
  });

  it('rejects a wave the synth does not know', () => {
    const broken = withTracks((tracks) => tracks.map((t, i) => (i === 0 ? { ...(t as object), melody: { ...(music.tracks[0]?.melody ?? {}), wave: 'organ' } } : t)));
    expect(() => musicFileSchema.parse(broken)).toThrow();
  });

  it('rejects a scale that does not start at the tonic', () => {
    const broken = { ...music, scales: { ...music.scales, major: [2, 4, 5] } };
    expect(() => musicFileSchema.parse(broken)).toThrow();
  });

  it('rejects a note that lasts no time', () => {
    const broken = withTracks((tracks) => tracks.map((t, i) => (i === 0 ? { ...(t as object), bpm: 0 } : t)));
    expect(() => musicFileSchema.parse(broken)).toThrow();
  });

  it('reports a track that names a scale which does not exist', () => {
    const file = musicFileSchema.parse(withTracks((tracks) => tracks.map((t, i) => (i === 0 ? { ...(t as object), scale: 'lydian' } : t))));
    expect(musicProblems(file)).toContain('曲目 spring.day 的音階 lydian 不存在');
  });

  it('reports a melody and bass that do not add up to the same length', () => {
    const file = musicFileSchema.parse(
      withTracks((tracks) => tracks.map((t, i) => (i === 0 ? { ...(t as object), bass: { ...(music.tracks[0]?.bass ?? {}), notes: [[0, 2]] } } : t))),
    );
    expect(musicProblems(file).some((p) => p.startsWith('曲目 spring.day 的旋律與低音拍數不同'))).toBe(true);
  });

  it('reports a season and period with no track, which would leave nothing to play', () => {
    const file = musicFileSchema.parse(withTracks((tracks) => tracks.filter((t) => (t as { id: string }).id !== 'winter.night')));
    expect(musicProblems(file)).toContain('缺少 winter night 的曲目');
  });

  it('reports two tracks for the same season and period', () => {
    const file = musicFileSchema.parse(withTracks((tracks) => [...tracks, { ...(music.tracks[0] ?? {}), id: 'spring.day.alt' }]));
    expect(musicProblems(file).some((p) => p.startsWith('spring day 有 2 首曲目'))).toBe(true);
  });
});
