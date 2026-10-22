import { expect, test, type Page } from '@playwright/test';

/**
 * 舊版（v1，MVP）存檔：瀏覽器裡已經有 v1 存檔的玩家更新遊戲後，必須能照常讀取，
 * 下一次存檔時改寫成 v2。
 */
const V1_RECORD = {
  slot: 'slot-1',
  savedAt: '2026-10-20T10:00:00.000Z',
  state: {
    schemaVersion: 1,
    calendar: { year: 1, season: 'spring', day: 4, minuteOfDay: 400 },
    energy: { current: 60, max: 100 },
    gold: 250,
    mapId: 'farm',
    player: { x: 7, y: 9, facing: 'down' },
    plots: {},
    bag: { seeds: { 'moon-bean': 2, 'sweet-radish': 5 }, crops: { 'sweet-radish': 3 } },
    shipBox: { items: {} },
    flags: {},
    tool: 'hoe',
    selectedSeed: 'moon-bean',
    rng: 12345,
  },
};

/** 直接寫入遊戲使用的 IndexedDB（資料庫由遊戲啟動時建立）。 */
async function putRecord(page: Page, record: unknown): Promise<void> {
  await page.evaluate(
    (value) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('dewhollow-farm');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('saves', 'readwrite');
          tx.objectStore('saves').put(value);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    record,
  );
}

async function readRecord(page: Page): Promise<{ state: Record<string, unknown> }> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('dewhollow-farm');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result.transaction('saves').objectStore('saves').get('slot-1');
          get.onsuccess = () => {
            open.result.close();
            resolve(get.result);
          };
          get.onerror = () => reject(get.error);
        };
      }),
  );
}

test('loads a v1 save and rewrites it as the current version on the next save', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await putRecord(page, V1_RECORD);

  await page.reload();
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 4 天');
  await expect(page.locator('#hud-gold')).toHaveText('250 金');

  await page.keyboard.press('s');
  await expect(page.locator('#hud-log')).toContainText('已存檔');

  const saved = await readRecord(page);
  expect(saved.state.schemaVersion).toBe(19);
  expect(saved.state).toHaveProperty('weather');
  expect(saved.state).toHaveProperty('toolTiers');
  expect(saved.state).not.toHaveProperty('bag');
  expect(saved.state.inventory).toMatchObject({
    stacks: [
      { itemId: 'seed.moon-bean', quality: 'normal', count: 2 },
      { itemId: 'seed.sweet-radish', quality: 'normal', count: 5 },
      { itemId: 'crop.sweet-radish', quality: 'normal', count: 3 },
    ],
  });
});

test('loads a v1 save whose plots have no dryDays field, as the old game wrote them', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  const oldPlots = {
    ...V1_RECORD,
    state: { ...V1_RECORD.state, plots: { '4,4': { watered: false, crop: null }, '4,3': { watered: true, crop: { cropId: 'moon-bean', growthDays: 1 } } } },
  };
  await putRecord(page, oldPlots);

  await page.reload();
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
  await expect(page.locator('#hud-log')).not.toContainText('無法讀取存檔');
});

test('shows a real error and keeps the save when it is from a newer game version', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  const newer = { ...V1_RECORD, state: { ...V1_RECORD.state, schemaVersion: 99 } };
  await putRecord(page, newer);

  await page.reload();
  await expect(page.locator('#hud-log')).toContainText('更新版本的遊戲');
  expect((await readRecord(page)).state.schemaVersion).toBe(99);
});
