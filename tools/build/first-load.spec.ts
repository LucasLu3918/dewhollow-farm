import { describe, expect, it } from 'vitest';
import { FIRST_LOAD_BUDGET_BYTES, entryPaths, gzipLength, overBudget, staticChunkImports, summarize } from './first-load.mjs';

describe('staticChunkImports', () => {
  it('找出靜態匯入的同目錄 chunk（不含動態 import）', () => {
    const js = 'import{a as b}from"./phaser-abc.js";import"./zod-def.js";const x=import("./lazy-ghi.js");export{b};';
    expect(staticChunkImports(js)).toEqual(['./phaser-abc.js', './zod-def.js']);
  });

  it('忽略不是相對路徑的套件匯入', () => {
    expect(staticChunkImports('import{x}from"phaser";import"./a.js"')).toEqual(['./a.js']);
  });
});

describe('entryPaths', () => {
  const html = [
    '<script type="module" crossorigin src="/assets/index-a.js"></script>',
    '<link rel="stylesheet" crossorigin href="/assets/index-b.css">',
    '<link rel="modulepreload" crossorigin href="/assets/chunk-c.js">',
    '<link rel="manifest" href="/manifest.webmanifest">',
    '<link rel="icon" href="/favicon.ico">',
  ].join('\n');

  it('取出入口腳本、樣式與預載模組，去掉 base 後回傳 dist 內的相對路徑', () => {
    expect(entryPaths(html, '/')).toEqual(['assets/index-a.js', 'assets/index-b.css', 'assets/chunk-c.js']);
  });

  it('子路徑部署（base 為 /game/）時同樣能對應到 dist 檔案', () => {
    const prefixed = html.replaceAll('"/assets/', '"/game/assets/');
    expect(entryPaths(prefixed, '/game/')).toEqual(['assets/index-a.js', 'assets/index-b.css', 'assets/chunk-c.js']);
  });
});

describe('summarize', () => {
  const files = [
    { path: 'index.html', kind: 'html', raw: 1000, gzip: 400 },
    { path: 'assets/index-a.js', kind: 'js', raw: 2000, gzip: 900 },
    { path: 'assets/index-b.css', kind: 'css', raw: 300, gzip: 150 },
    { path: 'assets/characters/cat-2x.png', kind: 'asset', raw: 4000, gzip: 4000 },
  ];

  it('依種類加總，並算出總計', () => {
    const report = summarize(files);
    expect(report.html).toEqual({ raw: 1000, gzip: 400 });
    expect(report.js).toEqual({ raw: 2000, gzip: 900 });
    expect(report.css).toEqual({ raw: 300, gzip: 150 });
    expect(report.asset).toEqual({ raw: 4000, gzip: 4000 });
    expect(report.total).toEqual({ raw: 7300, gzip: 5450 });
  });
});

describe('overBudget', () => {
  it('預算是 8 MB（8,000,000 位元組，以原始大小計）', () => {
    expect(FIRST_LOAD_BUDGET_BYTES).toBe(8_000_000);
  });

  it('剛好等於預算不算超標，多一個位元組就超標', () => {
    expect(overBudget(8_000_000)).toBe(false);
    expect(overBudget(8_000_001)).toBe(true);
  });
});

describe('gzipLength', () => {
  it('重複的文字壓縮後明顯變小', () => {
    const text = 'dewhollow farm '.repeat(500);
    expect(gzipLength(Buffer.from(text))).toBeLessThan(text.length / 10);
  });
});
