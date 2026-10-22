import { expect, test, type Page } from '@playwright/test';

/**
 * 小屋裡的裝飾與服飾。存檔是一份 v11 的存檔（背包裡有一件星空燈串與一件衣服），讀取後遷移成 v22。
 * 站在小屋的 (4,2) 面向下方的空地板 (4,3)，按 V 擺放；按 E 穿上衣服；按 S 存檔後檢查紀錄。
 * 注意：這份測試需要在本機 5173 port 執行 playwright，本次任務未執行（見交付報告）。
 */
const V11_RECORD = {
  slot: 'slot-1',
  savedAt: '2026-10-22T10:00:00.000Z',
  state: {
    schemaVersion: 11,
    calendar: { year: 1, season: 'spring', day: 4, minuteOfDay: 400 },
    weather: 'sunny',
    forecast: 'sunny',
    energy: { current: 60, max: 100 },
    gold: 250,
    mapId: 'house',
    player: { x: 4, y: 2, facing: 'down' },
    plots: {},
    inventory: {
      capacity: 24,
      stacks: [
        { itemId: 'star-string', quality: 'normal', count: 1 },
        { itemId: 'clothes', quality: 'normal', count: 1 },
      ],
    },
    shipBox: { entries: [] },
    flags: {},
    tool: 'hoe',
    toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0 },
    worldChanges: {},
    skills: { farming: 0, foraging: 0, fishing: 0, mining: 0, cooking: 0 },
    fishing: null,
    animals: [],
    processing: [],
    mineSeed: 9,
    mineCheckpoint: 1,
    selectedSeed: 'moon-bean',
    rng: 12345,
    playtimeSeconds: 0,
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

test('V places a decor in the house, E puts on the clothes, and both are saved', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await putRecord(page, V11_RECORD);

  await page.reload();
  await page.keyboard.press('v');
  await expect(page.locator('#hud-log')).toContainText('擺好了星空燈串');
  await page.keyboard.press('e');
  await expect(page.locator('#hud-log')).toContainText('穿上了衣服');

  await page.keyboard.press('s');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  const saved = await readRecord(page);
  expect(saved.state.schemaVersion).toBe(22);
  expect(saved.state.decor).toEqual({ house: [{ itemId: 'star-string', x: 4, y: 3 }] });
  expect(saved.state.wearing).toEqual({ player: 'clothes' });
});
