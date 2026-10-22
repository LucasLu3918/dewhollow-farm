// 建置後檢查（用法：npm run build && npm run budget）。
// 1. 首次載入大小：index.html、入口 JS／CSS、modulepreload、sw.js、manifest 與 content/assets.json 宣告的所有素材，
//    以原始位元組計，不得超過 8 MB；gzip 只回報。
// 2. PWA 產物：dist/manifest.webmanifest、dist/sw.js 存在，且 sw.js 的預快取清單包含入口檔。
// 3. 版本號與 package.json 一致（sw 的快取名字含版本號）。
// 有任何檢查失敗就以非零代碼結束，CI 因此失敗。

import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { entryPaths, FIRST_LOAD_BUDGET_BYTES, gzipLength, overBudget, staticChunkImports, summarize } from './first-load.mjs';
import { normalizeBase } from '../pwa/vite-plugin.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIST = `${ROOT}dist/`;
const base = normalizeBase(process.env.VITE_BASE);
const problems = [];

if (!existsSync(`${DIST}index.html`)) {
  console.error('找不到 dist/index.html，請先執行 npm run build。');
  process.exit(1);
}

const html = readFileSync(`${DIST}index.html`, 'utf8');
const assets = JSON.parse(readFileSync(`${ROOT}content/assets.json`, 'utf8')).assets;
const pkg = JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8'));

function kindOf(path) {
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.js')) return 'js';
  if (path.endsWith('.css')) return 'css';
  if (/\.(png|jpe?g|webp|gif|svg)$/.test(path)) return 'asset';
  return 'other';
}

/** 讀取一個 dist 檔案，缺檔就記錄問題並回傳 undefined。 */
function load(path) {
  const full = `${DIST}${path}`;
  if (!existsSync(full)) {
    problems.push(`缺少 dist/${path}`);
    return undefined;
  }
  return readFileSync(full);
}

const entries = entryPaths(html, base);
if (entries.length === 0) problems.push('index.html 沒有任何入口腳本或樣式（base 可能設錯）');

// 入口 JS 靜態匯入的 chunk（例如 phaser、zod、dexie）也是開機必要的，要沿著匯入圖走完。
const chunks = new Set();
const queue = entries.filter((p) => p.endsWith('.js'));
while (queue.length > 0) {
  const path = queue.shift();
  if (chunks.has(path)) continue;
  chunks.add(path);
  const buffer = existsSync(`${DIST}${path}`) ? readFileSync(`${DIST}${path}`, 'utf8') : '';
  for (const spec of staticChunkImports(buffer)) {
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
    queue.push(`${dir}${spec.slice(2)}`);
  }
}

const declared = assets.filter((a) => a.file).map((a) => a.file);
const firstLoadPaths = [...new Set(['index.html', ...entries, ...chunks, 'manifest.webmanifest', 'sw.js', ...declared])];

const files = [];
for (const path of firstLoadPaths) {
  const buffer = load(path);
  if (!buffer) continue;
  files.push({ path, kind: kindOf(path), raw: buffer.length, gzip: gzipLength(buffer) });
}

const report = summarize(files);
const mb = (n) => `${(n / 1_000_000).toFixed(3)} MB`;
const kb = (n) => `${(n / 1024).toFixed(1)} KiB`;
console.log('首次載入大小（原始 / gzip）：');
for (const key of ['html', 'js', 'css', 'asset', 'other', 'total']) {
  console.log(`  ${key.padEnd(6)} ${kb(report[key].raw).padStart(10)} / ${kb(report[key].gzip).padStart(10)}`);
}
console.log(`預算：${mb(FIRST_LOAD_BUDGET_BYTES)}（原始位元組）；本次總計 ${mb(report.total.raw)}`);
if (overBudget(report.total.raw)) {
  problems.push(`首次載入 ${mb(report.total.raw)} 超過預算 ${mb(FIRST_LOAD_BUDGET_BYTES)}`);
}

// PWA 產物
const manifestBuffer = load('manifest.webmanifest');
if (manifestBuffer) {
  try {
    const manifest = JSON.parse(manifestBuffer.toString('utf8'));
    if (manifest.name !== '晨露農場') problems.push('dist/manifest.webmanifest 的名稱不是「晨露農場」');
  } catch {
    problems.push('dist/manifest.webmanifest 不是合法的 JSON');
  }
}

const swBuffer = load('sw.js');
if (swBuffer) {
  const sw = swBuffer.toString('utf8');
  if (!sw.includes(`const CACHE_NAME = "dewhollow-farm-v${pkg.version}-`)) {
    problems.push(`sw.js 的快取名字沒有含版本號 ${pkg.version}`);
  }
  for (const path of entries) {
    if (!sw.includes(JSON.stringify(`${base}${path}`))) problems.push(`sw.js 的預快取清單缺少 ${base}${path}`);
  }
  if (!sw.includes(JSON.stringify(`${base}index.html`))) problems.push('sw.js 的預快取清單缺少 index.html');
  for (const path of ['manifest.webmanifest', 'assets/icons/icon-192.png']) {
    if (!sw.includes(JSON.stringify(`${base}${path}`))) problems.push(`sw.js 的預快取清單缺少 ${base}${path}（離線時無法安裝）`);
  }
  if (statSync(`${DIST}sw.js`).size === 0) problems.push('sw.js 是空檔');
}

if (problems.length > 0) {
  console.error('建置後檢查失敗：');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('建置後檢查通過（預算、manifest、sw.js）。');
