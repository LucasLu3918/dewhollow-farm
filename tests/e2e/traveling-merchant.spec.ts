import { expect, test, type Page } from '@playwright/test';

/**
 * 旅行商人（週五、六在鎮廣場的櫃檯）的畫面行為。存檔是一份 v11 的存檔，讀取後遷移成 v22。
 * 週五（春 5）在櫃檯前按 X 會打開貨架；平日（春 1）打開的貨架只說明旅行商人今天不在。
 * 注意：這份測試需要在本機 5173 port 執行 playwright，本次任務未執行（見交付報告）。
 */
function recordOn(day: number) {
  return {
    slot: 'slot-1',
    savedAt: '2026-10-22T10:00:00.000Z',
    state: {
      schemaVersion: 11,
      calendar: { year: 1, season: 'spring', day, minuteOfDay: 600 },
      weather: 'sunny',
      forecast: 'sunny',
      energy: { current: 60, max: 100 },
      gold: 1000,
      mapId: 'plaza',
      // 櫃檯在 (14,8)；站在它下面的 (14,7)，面向下。
      player: { x: 14, y: 7, facing: 'down' },
      plots: {},
      inventory: { capacity: 24, stacks: [] },
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
}

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

test('on Friday the traveling merchant opens a rotating shelf, and a purchase takes gold', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await putRecord(page, recordOn(5));

  await page.reload();
  await page.keyboard.press('x');
  await expect(page.locator('#shop-panel')).toBeVisible();
  await expect(page.locator('#shop-title')).toHaveText('旅行商人');
  await page.locator('#shop-list button').first().click();
  await expect(page.locator('#hud-log')).toContainText('向旅行商人買了');
});

test('on Monday the merchant is away: the shelf says so and nothing is taken', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await putRecord(page, recordOn(1));

  await page.reload();
  await page.keyboard.press('x');
  await expect(page.locator('#shop-panel')).toBeVisible();
  await expect(page.locator('#shop-list')).toContainText('旅行商人只在週五、週六的鎮廣場出現');
});
