// 驗證驅動器：用真的瀏覽器（Playwright Chromium）像玩家一樣操作晨露農場，並留下截圖與 JSON 證據。
// 用法（在專案根目錄執行）：
//   node .claude/skills/verify-dewhollow/scripts/verify.mjs doctor
//   node .claude/skills/verify-dewhollow/scripts/verify.mjs farm-loop
// 環境變數 VERIFY_URL 可指定開發伺服器（預設 http://127.0.0.1:5173）。
// 證據寫入 test-results/verify/<時間戳>/（已被 .gitignore 忽略），清理時不會刪除證據。

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const mode = process.argv[2];
const baseURL = process.env.VERIFY_URL ?? 'http://127.0.0.1:5173';
const root = resolve(import.meta.dirname, '../../../..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceDir = join(root, 'test-results', 'verify', `${mode}-${stamp}`);

const steps = [];
function record(name, detail = {}) {
  steps.push({ name, at: new Date().toISOString(), ...detail });
  console.log(`[ok] ${name}`);
}

async function waitForScene(page) {
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).not.toBe('');
}

async function waitForGame(page) {
  await page.goto(baseURL);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 1 天');
  await waitForScene(page);
}

async function press(page, keys) {
  for (const key of keys) await page.keyboard.press(key);
}

async function shot(page, name) {
  const file = join(evidenceDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function readSave(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('dewhollow-farm');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result.transaction('saves').objectStore('saves').get('slot-1');
          get.onsuccess = () => {
            open.result.close();
            resolve(get.result ?? null);
          };
          get.onerror = () => reject(get.error);
        };
      }),
  );
}

// doctor：唯讀檢查。伺服器有回應、頁面能載入、場景已建立，且地圖是農場。
async function doctor(page) {
  const res = await fetch(baseURL);
  if (!res.ok) throw new Error(`伺服器回應 ${res.status}，不是我們要驗證的實例`);
  record('server responds', { status: res.status, url: baseURL });
  await waitForGame(page);
  const mapId = await page.evaluate(() => window.__dewhollow.mapId());
  if (mapId !== 'farm') throw new Error(`預期地圖 farm，實際為 ${mapId}`);
  record('scene ready on farm map', { mapId });
}

// farm-loop：開墾 → 播種 → 澆水 → 存檔 → 重新整理後接續 → 睡覺進入第 2 天。
// 步驟與 tests/e2e/farm-loop.spec.ts 相同，但每一步留下截圖與存檔內容。
async function farmLoop(page) {
  await waitForGame(page);
  record('new game loaded', { shot: await shot(page, '01-loaded') });

  await press(page, ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp']);
  await press(page, ['x']);
  await expect(page.locator('#hud-energy-text')).toHaveText('98 / 100');
  await expect(page.locator('#hud-log')).toContainText('開墾了一塊田');
  record('tilled a field', { energy: '98 / 100', shot: await shot(page, '02-tilled') });

  await press(page, ['z', 'z', 'x']);
  await expect(page.locator('#hud-log')).toContainText('播下了 月光豆 種子');
  await expect(page.locator('#hud-energy-text')).toHaveText('97 / 100');
  record('planted moonbean seed', { energy: '97 / 100', shot: await shot(page, '03-planted') });

  await press(page, ['z', 'z', 'x']);
  await expect(page.locator('#hud-log')).toContainText('澆了水');
  await expect(page.locator('#hud-energy-text')).toHaveText('96 / 100');
  record('watered the field', { energy: '96 / 100', shot: await shot(page, '04-watered') });

  await press(page, ['s']);
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  const save = await readSave(page);
  if (!save || !save.state) throw new Error('IndexedDB 的 slot-1 沒有存檔內容（副作用未發生）');
  record('manual save wrote IndexedDB slot-1', { savedAt: save.savedAt, slot: save.slot });

  await page.reload();
  await waitForScene(page);
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
  await expect(page.locator('#hud-energy-text')).toHaveText('96 / 100');
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 1 天');
  record('reload resumes the save', { shot: await shot(page, '05-resumed') });

  await press(page, ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft']);
  await press(page, ['ArrowUp']);
  await press(page, ['ArrowUp', 'ArrowUp', 'ArrowUp']);
  await press(page, ['ArrowLeft', 'ArrowLeft']);
  await press(page, ['ArrowUp', 'ArrowLeft']);
  await press(page, ['x']);
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 2 天');
  await expect(page.locator('#hud-energy-text')).toHaveText('100 / 100');
  await expect(page.locator('#hud-log')).toContainText('你睡了一覺');
  record('slept into day 2', { energy: '100 / 100', shot: await shot(page, '06-day2') });

  await page.reload();
  await waitForScene(page);
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 2 天');
  await expect(page.locator('#hud-gold')).toHaveText('100 金');
  record('day 2 persists across reload', { gold: '100 金', shot: await shot(page, '07-day2-reload') });
}

async function main() {
  if (mode !== 'doctor' && mode !== 'farm-loop') {
    console.error('用法：verify.mjs <doctor|farm-loop>');
    process.exit(2);
  }
  mkdirSync(evidenceDir, { recursive: true });
  const browser = await chromium.launch();
  // 每次執行使用全新的瀏覽器情境，IndexedDB 是乾淨的，不會接到上一次的存檔。
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  let status = 'PASS';
  let failure = null;
  try {
    if (mode === 'doctor') await doctor(page);
    else await farmLoop(page);
  } catch (error) {
    status = 'FAIL';
    failure = String(error?.message ?? error);
    record('FAILED', { error: failure, shot: await shot(page, 'failure').catch(() => null) });
  } finally {
    // 清理：只關閉自己開的瀏覽器與情境。證據保留在 evidenceDir。
    await context.close();
    await browser.close();
    writeFileSync(join(evidenceDir, 'report.json'), JSON.stringify({ mode, baseURL, status, failure, steps }, null, 2));
    console.log(`證據：${evidenceDir}`);
    console.log(`結果：${status}`);
    process.exitCode = status === 'PASS' ? 0 : 1;
  }
}

main();
