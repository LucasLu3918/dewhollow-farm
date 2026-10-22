import { describe, expect, it } from 'vitest';
import helpJson from '../../../content/help.json';
import { parseHelpContent } from './info-content';

/** 說明頁的觸控按鍵（help.json 的 touch）：載入、驗證與內容涵蓋。 */

const KEYBOARD = [{ keys: '方向鍵', action: '移動' }];
const PRIVACY = { title: '隱私說明', paragraphs: ['不收集任何個人資料。'] };
const TOUCH = [{ keys: '方向鈕（左下）', action: '移動角色' }];

describe('說明頁的觸控按鍵（help.json 的 touch）', () => {
  it('目前的內容載入後有觸控按鍵，且涵蓋畫面下方每一組按鈕', () => {
    const help = parseHelpContent(helpJson);
    expect(help.touch.length).toBeGreaterThan(0);
    const text = help.touch.map((entry) => `${entry.keys} ${entry.action}`).join('\n');
    for (const keyword of ['方向', '互動', '工具', '種子', '技能', '居民', '圖鑑', '委託', '存檔', '斧', '鎬', '釣', '鐮', '擺放', '穿', '脫']) {
      expect(text, keyword).toContain(keyword);
    }
  });

  it('觸控按鍵寫成功能名稱，不寫單一鍵盤字母', () => {
    const help = parseHelpContent(helpJson);
    for (const entry of help.touch) {
      expect(entry.keys).not.toMatch(/^[A-Za-z]$/);
    }
  });

  it('缺少 touch 欄位會被拒絕，並指出欄位名', () => {
    expect(() => parseHelpContent({ controls: KEYBOARD, privacy: PRIVACY })).toThrow(/說明內容格式錯誤.*touch/);
  });

  it('touch 是空陣列會被拒絕', () => {
    expect(() => parseHelpContent({ controls: KEYBOARD, privacy: PRIVACY, touch: [] })).toThrow(/touch/);
  });

  it('touch 項目缺 action 會指出是第幾項的哪個欄位', () => {
    expect(() => parseHelpContent({ controls: KEYBOARD, privacy: PRIVACY, touch: [{ keys: '互動' }] })).toThrow(/touch\.0\.action/);
  });

  it('touch 項目的 keys 是空字串會被拒絕', () => {
    expect(() => parseHelpContent({ controls: KEYBOARD, privacy: PRIVACY, touch: [{ keys: '', action: '互動' }] })).toThrow(/touch\.0\.keys/);
  });

  it('格式正確的 touch 會原樣保留', () => {
    const help = parseHelpContent({ controls: KEYBOARD, privacy: PRIVACY, touch: TOUCH });
    expect(help.touch).toEqual(TOUCH);
  });
});
