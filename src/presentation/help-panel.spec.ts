import { describe, expect, it } from 'vitest';
import helpJson from '../../content/help.json';
import { parseHelpContent } from '../infrastructure/content/info-content';
import { keySections } from './help-panel';

/** 說明頁的按鍵區塊：觸控裝置先顯示畫面下方的按鍵，一般裝置先顯示鍵盤按鍵；兩者都要看得到。 */

const help = parseHelpContent(helpJson);

describe('說明頁的按鍵區塊', () => {
  it('觸控裝置：畫面下方的按鍵在前，鍵盤按鍵在後，兩組都有', () => {
    const sections = keySections(help, true);
    expect(sections.map((section) => section.title)).toEqual(['畫面下方的按鍵', '鍵盤按鍵']);
    expect(sections[0]?.entries).toBe(help.touch);
    expect(sections[1]?.entries).toBe(help.controls);
  });

  it('一般裝置：鍵盤按鍵在前，畫面下方的按鍵仍然列出', () => {
    const sections = keySections(help, false);
    expect(sections.map((section) => section.title)).toEqual(['鍵盤按鍵', '畫面下方的按鍵']);
    expect(sections[0]?.entries).toBe(help.controls);
    expect(sections[1]?.entries).toBe(help.touch);
  });

  it('觸控裝置的提示改為右上角的 ×，不再提 Esc', () => {
    const keyboard = keySections(help, true).find((section) => section.title === '鍵盤按鍵');
    expect(keyboard?.note).toContain('右上角的 ×');
    expect(keyboard?.note).not.toContain('Esc');
  });

  it('一般裝置的提示維持 Esc 關閉面板', () => {
    const keyboard = keySections(help, false).find((section) => section.title === '鍵盤按鍵');
    expect(keyboard?.note).toContain('Esc 永遠用來關閉面板');
  });
});
