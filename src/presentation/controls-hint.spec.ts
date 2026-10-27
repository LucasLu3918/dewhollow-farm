import { describe, expect, it } from 'vitest';
import controls from '../../content/controls.json';
import { DEFAULT_BINDINGS, assignKey, type Bindings } from '../domain/keybindings';
import { parseControlsContent } from '../infrastructure/content/controls-content';
import { controlsHint as renderHint } from './controls-hint';

/** 文字來自 content/controls.json（與遊戲載入的是同一份）；測試的預期字串不變。 */
const content = parseControlsContent(controls);

function controlsHint(bindings: Bindings): string {
  return renderHint(bindings, content.hintLabels, content.hintText);
}

const DEFAULT_HINT =
  '方向鍵移動 · X 互動 · Z 切換工具 · N 切換種子 · A/P/R/G 拿斧頭/鎬/釣竿/鐮刀 · V/E/Q 小屋擺放/穿/脫 · K 技能與天賦 · F 居民與好感 · I 背包 · C 圖鑑 · J 委託與佈告欄 · S 存檔 · L 存檔槽 · O 設定 · B 背景音樂 · M 靜音 · ? 說明（以上為目前的按鍵，可在設定中改）';

function rebind(action: Parameters<typeof assignKey>[1], key: string) {
  const result = assignKey(DEFAULT_BINDINGS, action, key);
  if (!result.ok) throw new Error(`測試用的改鍵失敗：${result.reason}`);
  return result.bindings;
}

describe('controlsHint with default bindings', () => {
  it('lists every control in the current order, including I and V/E/Q', () => {
    expect(controlsHint(DEFAULT_BINDINGS)).toBe(DEFAULT_HINT);
  });

  it('shows the arrow keys as 方向鍵', () => {
    expect(controlsHint(DEFAULT_BINDINGS).startsWith('方向鍵移動 · ')).toBe(true);
  });

  it('includes the inventory key I, collection key C, and hut keys V/E/Q', () => {
    const text = controlsHint(DEFAULT_BINDINGS);
    expect(text).toContain('I 背包');
    expect(text).toContain('C 圖鑑');
    expect(text).toContain('V/E/Q 小屋擺放/穿/脫');
  });

  it('merges the tool-taking keys A/P/R/G into one segment', () => {
    expect(controlsHint(DEFAULT_BINDINGS)).toContain('A/P/R/G 拿斧頭/鎬/釣竿/鐮刀');
  });
});

describe('controlsHint after rebinding', () => {
  it('follows a rebound action key and drops the old letter', () => {
    const text = controlsHint(rebind('interact', 'h'));
    expect(text).toContain('H 互動');
    expect(text).not.toContain('X 互動');
  });

  it('follows the rebound collection key', () => {
    const text = controlsHint(rebind('collection', 'y'));
    expect(text).toContain('Y 圖鑑');
    expect(text).not.toContain('I 圖鑑');
  });

  it('follows the rebound inventory key', () => {
    const text = controlsHint(rebind('inventory', 'y'));
    expect(text).toContain('Y 背包');
    expect(text).not.toContain('I 背包');
  });

  it('follows rebound hut keys in the merged segment', () => {
    const text = controlsHint(rebind('placeDecor', 'y'));
    expect(text).toContain('Y/E/Q 小屋擺放/穿/脫');
  });

  it('shows a rebound movement key as its letter instead of 方向鍵', () => {
    const text = controlsHint(rebind('moveUp', 'w'));
    expect(text.startsWith('W/←/↓/→ 移動 · ')).toBe(true);
    expect(text).not.toContain('方向鍵');
  });

  it('shows a space key as the word Space', () => {
    const text = controlsHint(rebind('interact', ' '));
    expect(text).toContain('Space 互動');
  });
});

describe('controlsHint takes its words from the labels it is given', () => {
  it('shows a changed label from the table instead of a fixed word', () => {
    const labels = { ...content.hintLabels, interact: '撿起' };
    expect(renderHint(DEFAULT_BINDINGS, labels, content.hintText)).toContain('X 撿起');
  });
});

describe('controlsHint content', () => {
  it('ends with the note that the keys can be changed in settings', () => {
    expect(controlsHint(DEFAULT_BINDINGS)).toMatch(/以上為目前的按鍵，可在設定中改）$/);
  });

  it('never mentions Esc, which is reserved for closing panels', () => {
    expect(controlsHint(DEFAULT_BINDINGS)).not.toContain('Esc');
  });
});
