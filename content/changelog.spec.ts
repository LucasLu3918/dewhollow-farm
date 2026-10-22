import { describe, expect, it } from 'vitest';
import changelogJson from './changelog.json';
import helpJson from './help.json';
import pkg from '../package.json';
import { parseChangelog, parseHelpContent } from '../src/infrastructure/content/info-content';

/**
 * 更新日誌與說明頁的內容檢查：格式正確、版本號與 package.json 對得上、說明頁的隱私段落寫得出來。
 */

describe('更新日誌（content/changelog.json）', () => {
  const entries = parseChangelog(changelogJson);

  it('格式正確，每個版本一筆，版本號不重複', () => {
    const versions = entries.map((entry) => entry.version);
    expect(new Set(versions).size).toBe(versions.length);
    for (const entry of entries) {
      expect(entry.items.length).toBeGreaterThan(0);
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('最新一筆的版本號就是 package.json 的版本號（交叉參照）', () => {
    expect(entries[0]?.version).toBe(pkg.version);
  });

  it('至少包含 0.1.0 的內容摘要', () => {
    const first = entries.find((entry) => entry.version === '0.1.0');
    expect(first).toBeDefined();
    expect(first?.items.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('格式錯誤的內容會被拒絕', () => {
    expect(() => parseChangelog([{ version: '0.1.0', date: '2026/10/22', title: 'x', items: [] }])).toThrow();
    expect(() => parseChangelog({})).toThrow();
  });
});

describe('說明頁（content/help.json）', () => {
  const help = parseHelpContent(helpJson);

  it('列出操作按鍵，包含說明頁與存檔槽自己的按鍵', () => {
    const keys = help.controls.map((control) => control.keys).join(' ');
    expect(keys).toContain('?');
    expect(keys).toContain('L');
    expect(keys).toContain('S');
  });

  it('隱私說明寫清楚：不收集個資、沒有第三方追蹤、存檔只在這個瀏覽器', () => {
    const text = help.privacy.paragraphs.join('\n');
    expect(help.privacy.paragraphs.length).toBeGreaterThanOrEqual(3);
    expect(text).toContain('不收集');
    expect(text).toContain('第三方');
    expect(text).toContain('這個瀏覽器');
  });

  it('格式錯誤的說明內容會被拒絕', () => {
    expect(() => parseHelpContent({ controls: [], privacy: { title: '隱私', paragraphs: [] } })).toThrow();
  });
});
