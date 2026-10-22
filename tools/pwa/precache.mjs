// 離線快取的純函式：快取名字、預快取清單、把清單寫進 service worker 樣板。
// 沒有任何 I/O，給 vite 外掛與測試共用。

import { createHash } from 'node:crypto';

export const CACHE_PREFIX = 'dewhollow-farm';

/** 快取名字 = 前綴 + 版本號 + index.html 內容的雜湊；index.html 會引用含雜湊的建置檔，內容一變，名字就變。 */
export function cacheNameFor(version, indexHtml) {
  const digest = createHash('sha256').update(indexHtml).digest('hex').slice(0, 8);
  return `${CACHE_PREFIX}-v${version}-${digest}`;
}

/**
 * 預快取清單：dist 裡所有要離線可用的檔案（不含 sw.js 與 source map），轉成以 base 為根的網址。
 * 另外加上目錄入口（base 本身），讓 `/` 的導覽請求也能離線開啟。
 */
export function precacheUrls(files, base) {
  const urls = new Set([base]);
  for (const file of files) {
    if (file === 'sw.js' || file.endsWith('.map')) continue;
    urls.add(`${base}${file.replace(/^\/+/, '')}`);
  }
  return [...urls].sort();
}

export const CACHE_NAME_TOKEN = '__CACHE_NAME__';
export const PRECACHE_URLS_TOKEN = '__PRECACHE_URLS__';

/** 把快取名字與清單寫進樣板；缺占位符就丟錯，避免產生壞掉的 sw.js。 */
export function renderServiceWorker(template, { cacheName, urls }) {
  for (const token of [CACHE_NAME_TOKEN, PRECACHE_URLS_TOKEN]) {
    if (!template.includes(token)) throw new Error(`service worker 樣板缺少占位符 ${token}`);
  }
  return template.replace(CACHE_NAME_TOKEN, () => JSON.stringify(cacheName)).replace(PRECACHE_URLS_TOKEN, () => JSON.stringify(urls));
}
