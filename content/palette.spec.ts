import { describe, expect, it } from 'vitest';
import palette from './palette.json';

/**
 * 共用調色盤（docs/ART_PIPELINE.md）：所有素材最後都量化到這組顏色，
 * 因此格式要固定、顏色不可重複、關鍵顏色（輪廓、標誌色）必須在裡面。
 */
describe('shared palette', () => {
  it('has exactly 112 unique lowercase hex colours', () => {
    expect(palette.size).toBe(112);
    expect(palette.colors).toHaveLength(112);
    for (const hex of palette.colors) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(new Set(palette.colors).size).toBe(112);
  });

  it('only ever grows: the 48 colours the first characters were quantized to are all still there', () => {
    // 角色圖（小涵、毛毛、黑貓、有袋動物）已經量化到這 48 色並入庫；調色盤只擴充、不重排，它們才不必重做。
    // 之後加入的地形與 NPC 再擴充到 112 色（見 docs/art/scene-briefs.md）；舊的 64 色同樣必須都還在。
    const original = ["#180102", "#2a0200", "#200a0b", "#2b0c07", "#350c06", "#1e1212", "#36160f", "#1f1d20", "#451f18", "#272828", "#3b2418", "#4c241b", "#412825", "#4c2b24", "#2c3345", "#4f312a", "#3c3b38", "#59382f", "#543b37", "#5c3f38", "#693f2e", "#4d493f", "#60453e", "#724c3c", "#885438", "#825c49", "#8d614b", "#696e55", "#936e5c", "#ac6c45", "#9e7660", "#a77b64", "#938571", "#ff6fa8", "#4aa3ff", "#d29980", "#bbb09d", "#fba48b", "#feb291", "#c6c4bf", "#fbc9a9", "#fad2b5", "#fad9bf", "#fde1cc", "#ffead3", "#fdfb73", "#f7f3ec", "#fffffe"];
    expect(original).toHaveLength(48);
    for (const hex of original) expect(palette.colors, hex).toContain(hex);
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
