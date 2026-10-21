import { describe, expect, it } from 'vitest';
import palette from './palette.json';

/**
 * 共用調色盤（docs/ART_PIPELINE.md）：所有素材最後都量化到這組顏色，
 * 因此格式要固定、顏色不可重複、關鍵顏色（輪廓、標誌色）必須在裡面。
 */
describe('shared palette', () => {
  it('has exactly 48 unique lowercase hex colours', () => {
    expect(palette.size).toBe(48);
    expect(palette.colors).toHaveLength(48);
    for (const hex of palette.colors) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(new Set(palette.colors).size).toBe(48);
  });

  it('contains every named anchor colour', () => {
    for (const [name, hex] of Object.entries(palette.anchors)) {
      expect(palette.colors, `anchor ${name}`).toContain(hex);
    }
  });

  it('keeps the brand colours from CHARACTERS.md as anchors', () => {
    expect(palette.anchors.maomao).toBe('#4aa3ff');
    expect(palette.anchors.xiaohan).toBe('#ff6fa8');
  });

  it('keeps the outline anchor dark enough to read against any fill', () => {
    const hex = palette.anchors.outline.slice(1);
    const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
    const luma = 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
    expect(luma).toBeLessThan(60);
  });
});
