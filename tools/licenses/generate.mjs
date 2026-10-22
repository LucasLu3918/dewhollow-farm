// 產生 docs/LICENSES.md（用法：npm run licenses）。
// 資料來源：content/assets.json（素材與來源）、package.json 與 package-lock.json（依賴）、node_modules/*/package.json（各套件的授權欄位）。
// 文件由程式產生，不要手改；要改內容請改來源檔後重新產生。

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = `${ROOT}docs/LICENSES.md`;

const assetsFile = JSON.parse(readFileSync(`${ROOT}content/assets.json`, 'utf8'));
const pkg = JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8'));
const lock = JSON.parse(readFileSync(`${ROOT}package-lock.json`, 'utf8'));

/** 依賴用途（直接依賴才有）。 */
const PURPOSE = {
  phaser: '遊戲引擎（場景、貼圖、輸入與鏡頭）',
  dexie: 'IndexedDB 存檔封裝',
  zod: '內容與存檔資料的格式驗證',
  typescript: '型別檢查與編譯',
  vite: '開發伺服器與建置（產生 dist/）',
  vitest: '單元測試與模擬',
  '@playwright/test': '端到端測試（不隨遊戲發布）',
};

const esc = (text) => String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** 本機沒有安裝時：有 os／cpu 限制的是其他平台的原生套件，不是遺漏。 */
function missingLicense(lockEntry) {
  return lockEntry?.os || lockEntry?.cpu ? '（平台專用套件，本機未安裝，未讀取授權）' : '（未安裝，無法讀取）';
}

function licenseOf(manifest, lockEntry) {
  if (!manifest) return missingLicense(lockEntry);
  if (typeof manifest.license === 'string') return manifest.license;
  if (manifest.license && typeof manifest.license.type === 'string') return manifest.license.type;
  if (Array.isArray(manifest.licenses)) return manifest.licenses.map((l) => l.type ?? l).join(' OR ');
  return '（套件未標示）';
}

function readInstalled(lockKey) {
  const path = `${ROOT}${lockKey}/package.json`;
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, 'utf8'));
}

// ---- 素材 ----
const assets = assetsFile.assets;
const withFile = assets.filter((a) => a.file);
const mirrored = assets.filter((a) => a.mirrorOf);
const placeholders = assets.filter((a) => !a.file && !a.mirrorOf);
const modelGenerated = withFile.filter((a) => a.source.startsWith('本機模型生成'));
const programFiles = withFile.filter((a) => a.source.startsWith('程式產生'));
const otherFiles = withFile.filter((a) => !modelGenerated.includes(a) && !programFiles.includes(a));

const assetRow = (a) => `| \`${a.id}\` | ${a.kind} | ${a.file ? `\`${a.file}\`` : a.mirrorOf ? `水平翻轉 \`${a.mirrorOf}\``: '（無檔案，程式繪製色塊）'} | ${esc(a.source)} |`;
const assetTable = (rows) => ['| 素材 id | 類別 | 檔案 | 來源與授權 |', '| --- | --- | --- | --- |', ...rows.map(assetRow)].join('\n');

// ---- 依賴 ----
const direct = [...Object.keys(pkg.dependencies ?? {}).map((name) => ({ name, dev: false })), ...Object.keys(pkg.devDependencies ?? {}).map((name) => ({ name, dev: true }))];
const directRows = direct.map(({ name, dev }) => {
  const entry = lock.packages?.[`node_modules/${name}`];
  const installed = readInstalled(`node_modules/${name}`);
  const version = installed?.version ?? entry?.version ?? '?';
  return `| \`${name}\` | ${version} | ${licenseOf(installed, entry)} | ${dev ? '開發用' : '執行期'} | ${esc(PURPOSE[name] ?? '')} |`;
});

const allPackages = Object.keys(lock.packages ?? {})
  .filter((key) => key.startsWith('node_modules/'))
  .map((key) => {
    const installed = readInstalled(key);
    return {
      name: key.replace(/^node_modules\//, ''),
      version: installed?.version ?? lock.packages[key].version ?? '?',
      license: licenseOf(installed, lock.packages[key]),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const licenseCounts = new Map();
for (const p of allPackages) licenseCounts.set(p.license, (licenseCounts.get(p.license) ?? 0) + 1);
const countRows = [...licenseCounts.entries()].sort((a, b) => b[1] - a[1]).map(([license, n]) => `| ${esc(license)} | ${n} |`);

const doc = `# 素材與授權清單

本文件由 \`npm run licenses\`（\`tools/licenses/generate.mjs\`）產生，資料來源是 \`content/assets.json\`、\`package.json\`、\`package-lock.json\` 與 \`node_modules/\`。請改來源檔後重新產生，不要手改。

原則見 [ORIGINALITY.md](ORIGINALITY.md)：所有角色、地名、作物與文字皆為原創；素材來源必須登錄；來源不明的檔案不得進入發布版本。

## 一、素材（content/assets.json）

共 ${assets.length} 筆：有檔案 ${withFile.length} 筆（其中本機模型生成 ${modelGenerated.length}、程式產生 ${programFiles.length}）、水平翻轉 ${mirrored.length} 筆（不另存檔）、占位（程式繪製的色塊，無檔案）${placeholders.length} 筆。

### 1.1 本機影像模型生成

角色與工具圖由本機影像模型生成，流程見 [ART_PIPELINE.md](ART_PIPELINE.md)。

- **模型**：Z-Image Turbo，**授權 Apache-2.0**。文生圖、固定 seed，綠幕去背、縮放並量化到 \`content/palette.json\`（\`tools/art\`）。提示詞與挑選記錄見 [art/character-briefs.md](art/character-briefs.md) 與 [art/tool-briefs.md](art/tool-briefs.md)。
- 未使用其他模型的圖；ART_PIPELINE 所列的其他模型（FLUX.2 klein、Qwen Image Edit）**沒有**產出任何已入庫的素材。

${assetTable(modelGenerated)}

### 1.2 程式產生（有檔案）

${assetTable(programFiles)}

${otherFiles.length ? `### 1.3 其他有檔案的素材\n\n${assetTable(otherFiles)}\n` : ''}
### 1.4 水平翻轉（不另存檔）

翻轉原圖在執行期完成，不另外存檔，來源與原圖相同。

${assetTable(mirrored)}

### 1.5 占位（程式繪製的色塊，無檔案）

遊戲運行時以 \`color\` 繪製的占位圖或純色區塊，沒有圖檔，也不含任何外部素材。

${assetTable(placeholders)}

### 1.6 音訊

音效與背景音樂由程式合成（\`src/presentation/audio/synth.ts\`、\`content/music.json\`、\`content/sounds.json\`），**沒有**音檔，不含外部素材。

## 二、第三方依賴（package.json 直接依賴）

| 套件 | 版本 | 授權 | 類別 | 用途 |
| --- | --- | --- | --- | --- |
${directRows.join('\n')}

## 三、已安裝的全部套件（含間接依賴）

共 ${allPackages.length} 個套件（依 \`package-lock.json\` 與 \`node_modules/\` 產生）。

| 授權 | 套件數 |
| --- | --- |
${countRows.join('\n')}

| 套件 | 版本 | 授權 |
| --- | --- | --- |
${allPackages.map((p) => `| \`${p.name}\` | ${p.version} | ${esc(p.license)} |`).join('\n')}

## 四、字型

遊戲使用系統字型與瀏覽器預設的中文字型，沒有內嵌或下載字型檔。

## 五、本文件的限制

- 授權欄位取自各套件的 \`package.json\`，不是法律意見；公開發布前請由作者或法律顧問再次確認（見 ORIGINALITY.md）。
- 模型授權以 ART_PIPELINE.md 的記載為準；若更換模型，須同步更新本文件與 \`content/assets.json\` 的 \`source\`。
`;

writeFileSync(OUT, doc);
console.log(`已產生 docs/LICENSES.md：素材 ${assets.length} 筆、直接依賴 ${direct.length} 個、已安裝套件 ${allPackages.length} 個`);
