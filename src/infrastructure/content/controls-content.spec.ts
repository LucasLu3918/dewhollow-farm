import { describe, expect, it } from 'vitest';
import controls from '../../../content/controls.json';
import { ACTION_IDS } from '../../domain/keybindings';
import { ContentError } from './load-content';
import { TOUCH_ACTION_IDS, parseControlsContent } from './controls-content';

type Raw = Record<string, Record<string, unknown>>;

/** 複製一份內容，讓每個測試改動自己的那一份。 */
function copy(): Raw {
  return structuredClone(controls) as Raw;
}

describe('parseControlsContent with shipped content', () => {
  it('loads every hint label, settings label and touch button', () => {
    const parsed = parseControlsContent(controls);
    for (const action of ACTION_IDS) {
      expect(parsed.hintLabels[action].trim().length).toBeGreaterThan(0);
      expect(parsed.settingsLabels[action].trim().length).toBeGreaterThan(0);
    }
    expect(Object.keys(parsed.touchButtons).sort()).toEqual([...TOUCH_ACTION_IDS].sort());
  });

  it('keeps the hint texts that the status bar shows', () => {
    const parsed = parseControlsContent(controls);
    expect(parsed.hintLabels.interact).toBe('互動');
    expect(parsed.hintLabels.placeDecor).toBe('小屋擺放');
    expect(parsed.hintText.arrowMovement).toBe('方向鍵移動');
    expect(parsed.hintText.note).toBe('（以上為目前的按鍵，可在設定中改）');
  });

  it('keeps original interaction wording separate from stable descriptor keys', () => {
    const parsed = parseControlsContent(controls);
    expect(parsed.interactionLabels.harvest).toBe('收成');
    expect(parsed.interactionLabels.nothing).toBe('沒有可互動的目標');
  });

  it('keeps the settings action names unchanged', () => {
    const parsed = parseControlsContent(controls);
    expect(parsed.settingsLabels.interact).toBe('互動、收割、與居民說話、收線');
    expect(parsed.settingsLabels.moveUp).toBe('上移');
  });
});

describe('parseControlsContent rejects broken content', () => {
  it('names the action that is missing from the hint labels', () => {
    const raw = copy();
    delete raw.hintLabels?.interact;
    expect(() => parseControlsContent(raw)).toThrow(ContentError);
    expect(() => parseControlsContent(raw)).toThrow('狀態列提示的標籤缺少動作 interact');
  });

  it('names the action that is missing from the settings labels', () => {
    const raw = copy();
    delete raw.settingsLabels?.mute;
    expect(() => parseControlsContent(raw)).toThrow('設定面板的動作名稱缺少動作 mute');
  });

  it('names a missing interaction descriptor label', () => {
    const raw = copy();
    delete raw.interactionLabels?.harvest;
    expect(() => parseControlsContent(raw)).toThrow('互動提示文字缺少動作 harvest');
  });

  it('names the touch button that is missing', () => {
    const raw = copy();
    delete raw.touchButtons?.takeOff;
    expect(() => parseControlsContent(raw)).toThrow('虛擬按鍵的文字缺少動作 takeOff');
  });

  it('rejects an empty label', () => {
    const raw = copy();
    raw.hintLabels = { ...raw.hintLabels, cycleTool: '' };
    expect(() => parseControlsContent(raw)).toThrow(ContentError);
    expect(() => parseControlsContent(raw)).toThrow('hintLabels.cycleTool：不可是空白字串');
  });

  it('rejects a label that is only spaces', () => {
    const raw = copy();
    raw.settingsLabels = { ...raw.settingsLabels, skills: '   ' };
    expect(() => parseControlsContent(raw)).toThrow('settingsLabels.skills：不可是空白字串');
  });

  it('rejects an empty touch button label or name', () => {
    const raw = copy();
    raw.touchButtons = { ...raw.touchButtons, interact: { label: '', name: '互動' } };
    expect(() => parseControlsContent(raw)).toThrow('touchButtons.interact.label：不可是空白字串');
  });

  it('rejects an action id that the game does not know', () => {
    const raw = copy();
    raw.settingsLabels = { ...raw.settingsLabels, flyAway: '飛走' };
    expect(() => parseControlsContent(raw)).toThrow('設定面板的動作名稱有不認得的動作 flyAway');
  });

  it('rejects a touch button that is not on the pad', () => {
    const raw = copy();
    raw.touchButtons = { ...raw.touchButtons, help: { label: '說明', name: '說明' } };
    expect(() => parseControlsContent(raw)).toThrow('虛擬按鍵的文字有不認得的動作 help');
  });

  it('rejects a file without the hint text section', () => {
    const raw = copy();
    delete raw.hintText;
    expect(() => parseControlsContent(raw)).toThrow(ContentError);
  });

  it('rejects content that is not an object at all', () => {
    expect(() => parseControlsContent(null)).toThrow(ContentError);
  });
});
