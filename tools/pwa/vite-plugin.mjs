// Vite 外掛：建置時產生 dist/sw.js（預快取清單與快取名字填入樣板）。
// 只在 build 時作用；dev 模式不會註冊、也不會產生 sw.js。

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { cacheNameFor, precacheUrls, renderServiceWorker } from './precache.mjs';

const TEMPLATE_URL = new URL('./service-worker.template.js', import.meta.url);

/** 把 VITE_BASE 整理成以 / 開頭、結尾的 base；沒設定就是 /。 */
export function normalizeBase(raw) {
  let base = raw === undefined || raw.trim() === '' ? '/' : raw.trim();
  if (!/^https?:\/\//.test(base) && !base.startsWith('/')) base = `/${base}`;
  if (!base.endsWith('/')) base = `${base}/`;
  return base;
}

/** 列出 public 目錄下所有檔案（相對路徑，斜線分隔）。目錄不存在時回傳空陣列。 */
function listPublicFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { recursive: true, withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath ?? entry.path, entry.name)).split(sep).join('/'));
}

export function serviceWorkerPlugin({ version }) {
  let base = '/';
  let publicDir = '';
  return {
    name: 'dewhollow-service-worker',
    apply: 'build',
    configResolved(config) {
      base = config.base;
      publicDir = config.publicDir;
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const indexHtml = bundle['index.html'];
        if (!indexHtml || indexHtml.type !== 'asset') {
          throw new Error('建置產物缺少 index.html，無法產生 sw.js');
        }
        const html = String(indexHtml.source);
        const files = [...Object.keys(bundle), ...listPublicFiles(publicDir)];
        const source = renderServiceWorker(readFileSync(TEMPLATE_URL, 'utf8'), {
          cacheName: cacheNameFor(version, html),
          urls: precacheUrls(files, base),
        });
        this.emitFile({ type: 'asset', fileName: 'sw.js', source });
      },
    },
  };
}
