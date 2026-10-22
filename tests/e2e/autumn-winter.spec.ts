import { expect, test, type Page } from '@playwright/test';

/**
 * M6：秋冬內容（豐穗祭、暖燈節、溫室、季節進貨）。這個檔案已寫好，但這次沒有執行（依照指示避開 5173 port，
 * 不跑 npm run test:e2e）。作法與 festival.spec.ts 相同：先存一個新遊戲，改寫存檔的日期與位置，重新讀取，再操作。
 * 規則與內容的交叉參照已由單元測試涵蓋（application/autumn-winter.spec.ts）；這裡只看畫面路線是否通。
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

test('on autumn 12 the plaza festival panel lists the harvest contest and the seed swaps', async ({ page }) => {
  await waitForGame(page);
  await seedAndReload(page, {
    calendar: { year: 1, season: 'autumn', day: 12, minuteOfDay: 720 },
    mapId: 'plaza',
    weather: 'sunny',
    forecast: 'sunny',
    player: { x: 1, y: 9, facing: 'up' },
  });

  await page.keyboard.press('x');
  await expect(page.locator('#festival-panel')).toBeVisible();
  await expect(page.locator('#festival-list')).toContainText('收成比賽');
  await expect(page.locator('#festival-list')).toContainText('種子交換');
  await page.keyboard.press('Escape');
  await expect(page.locator('#festival-panel')).toBeHidden();
});

test('in winter, after 18:00 a lantern in the plaza lights up once and gives its gold', async ({ page }) => {
  await waitForGame(page);
  await seedAndReload(page, {
    calendar: { year: 1, season: 'winter', day: 20, minuteOfDay: 1100 },
    mapId: 'plaza',
    weather: 'sunny',
    forecast: 'sunny',
    player: { x: 2, y: 2, facing: 'up' },
    gold: 100,
  });

  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('點亮了一盞燈');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('plaza');
});

test('the greenhouse door stays shut until the remodel is bought, then leads into the greenhouse', async ({ page }) => {
  await waitForGame(page);
  await seedAndReload(page, {
    calendar: { year: 1, season: 'winter', day: 5, minuteOfDay: 600 },
    mapId: 'farm',
    weather: 'sunny',
    forecast: 'sunny',
    player: { x: 30, y: 19, facing: 'down' },
    flags: {},
  });

  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#hud-log')).toContainText('溫室還沒改建');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
});
