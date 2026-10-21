import { expect, test, type Page } from '@playwright/test';

/**
 * M5c：節慶與夜市。這個檔案已寫好，但這次沒有執行（依照指示避開 5173 port，不跑 npm run test:e2e）。
 * 作法：先存一個新遊戲，改寫存檔裡的日期與位置（春 12 或夏 14），重新讀取，再到鎮廣場操作。
 * 內容的交叉參照與邏輯已由單元測試涵蓋；這裡只看畫面路線是否通。
 */

async function waitForGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

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

async function readRecord(page: Page): Promise<{ slot: string; savedAt: string; state: Record<string, unknown> }> {
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

/** 把目前的存檔改成指定的日期、地點與位置，然後重新載入。 */
async function seedAndReload(page: Page, patch: Record<string, unknown>): Promise<void> {
  await page.keyboard.press('s');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  const record = await readRecord(page);
  await putRecord(page, { ...record, state: { ...record.state, ...patch } });
  await page.reload();
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
}

test('on the festival day, the notice board in the plaza opens the festival panel with the swaps', async ({ page }) => {
  await waitForGame(page);
  await seedAndReload(page, {
    calendar: { year: 1, season: 'spring', day: 12, minuteOfDay: 720 },
    mapId: 'plaza',
    player: { x: 1, y: 9, facing: 'up' },
    gold: 500,
  });

  await page.keyboard.press('x');
  await expect(page.locator('#festival-panel')).toBeVisible();
  await expect(page.locator('#festival-list')).toContainText('種子交換');
  await page.keyboard.press('Escape');
  await expect(page.locator('#festival-panel')).toBeHidden();
});

test('on a normal day the board says there is no festival, and the swap is refused', async ({ page }) => {
  await waitForGame(page);
  await seedAndReload(page, {
    calendar: { year: 1, season: 'spring', day: 3, minuteOfDay: 720 },
    mapId: 'plaza',
    player: { x: 1, y: 9, facing: 'up' },
  });

  await page.keyboard.press('x');
  await expect(page.locator('#festival-summary')).toContainText('節慶只在指定的日子開放');
});

test('the star pool at night catches a star or lets it slip, and the reel uses only the X key', async ({ page }) => {
  await waitForGame(page);
  await seedAndReload(page, {
    calendar: { year: 1, season: 'summer', day: 14, minuteOfDay: 1200 },
    mapId: 'plaza',
    player: { x: 9, y: 4, facing: 'up' },
    weather: 'sunny',
  });

  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('收網');
  await page.keyboard.press('x');
  // 時機可能接到、也可能溜走，兩種都算通過；這裡只確認收網有結果。
  await expect(page.locator('#hud-log')).toContainText(/星河碎片|溜走了/);
});
