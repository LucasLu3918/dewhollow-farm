// 首次載入大小的純函式（沒有 I/O）：哪些檔案算首次載入、加總原始與 gzip 大小、是否超過預算。
// 預算以原始位元組計（比 gzip 嚴格）；gzip 只回報，供參考。

import { gzipSync } from 'node:zlib';

/** 8 MB。剛好等於預算不算超標。 */
export const FIRST_LOAD_BUDGET_BYTES = 8_000_000;

/**
 * 從 dist/index.html 取出首次載入會抓的入口檔（module 腳本、樣式、modulepreload），
 * 去掉 base 前綴後回傳 dist 內的相對路徑。
 */
export function entryPaths(html, base) {
  const paths = [];
  for (const match of html.matchAll(/<(script|link)\b[^>]*>/g)) {
    const tag = match[0];
    const isModuleScript = /^<script\b/.test(tag) && /type="module"/.test(tag);
    const isStylesheet = /^<link\b/.test(tag) && /rel="stylesheet"/.test(tag);
    const isPreload = /^<link\b/.test(tag) && /rel="modulepreload"/.test(tag);
    if (!isModuleScript && !isStylesheet && !isPreload) continue;
    const attr = tag.match(/\b(?:src|href)="([^"]+)"/);
    if (!attr) continue;
    const path = stripBase(attr[1], base);
    if (path !== undefined && !paths.includes(path)) paths.push(path);
  }
  return paths;
}

function stripBase(url, base) {
  if (!url.startsWith(base)) return undefined;
  return url.slice(base.length);
}

/**
 * 一個 JS chunk 靜態匯入的同目錄 chunk（`from"./x.js"` 或 `import"./x.js"`）。
 * 動態 import()、套件匯入（"phaser" 這類）不算，因為前者不是開機必要、後者不在 dist 裡。
 */
export function staticChunkImports(source) {
  const found = [];
  for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*)(["'])(\.\/[^"']+\.js)\1/g)) {
    if (!found.includes(match[2])) found.push(match[2]);
  }
  return found;
}

/** 回傳 gzip 後的位元組數（與瀏覽器傳輸時的大小接近，等級 9）。 */
export function gzipLength(buffer) {
  return gzipSync(buffer, { level: 9 }).length;
}

/**
 * files：{ path, kind: 'html'|'js'|'css'|'asset'|'other', raw, gzip }。
 * 回傳每種類別的原始與 gzip 合計，以及總計。
 */
export function summarize(files) {
  const report = {
    html: { raw: 0, gzip: 0 },
    js: { raw: 0, gzip: 0 },
    css: { raw: 0, gzip: 0 },
    asset: { raw: 0, gzip: 0 },
    other: { raw: 0, gzip: 0 },
    total: { raw: 0, gzip: 0 },
  };
  for (const file of files) {
    const bucket = report[file.kind] ?? report.other;
    bucket.raw += file.raw;
    bucket.gzip += file.gzip;
    report.total.raw += file.raw;
    report.total.gzip += file.gzip;
  }
  return report;
}

export function overBudget(rawTotal, budget = FIRST_LOAD_BUDGET_BYTES) {
  return rawTotal > budget;
}
