import { expect, test, type Page } from '@playwright/test';

/**
 * M5d：社區修復（廣場的修復委員會告示）。這個檔案已寫好，但這次沒有執行（依照指示避開 5173 port，不跑 npm run test:e2e）。
 * 作法：先存一個新遊戲，改寫存檔裡的日期、位置與背包，重新讀取，再到鎮廣場的告示前按 X 捐獻。
 * 規則與內容已由單元測試涵蓋；這裡只看畫面路線是否通。
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

/** 把目前的存檔改成指定的內容，然後重新載入。 */
async function seedAndReload(page: Page, patch: Record<string, unknown>): Promise<void> {
  await page.keyboard.press('s');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  const record = await readRecord(page);
  await putRecord(page, { ...record, state: { ...record.state, ...patch } });
  await page.reload();
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
}

test('in spring, the repair notice in the plaza opens the panel and a donation comes out of the bag', async ({ page }) => {
  await waitForGame(page);
  await seedAndReload(page, {
    calendar: { year: 1, season: 'spring', day: 4, minuteOfDay: 600 },
    mapId: 'plaza',
    player: { x: 6, y: 9, facing: 'down' },
    weather: 'sunny',
    forecast: 'sunny',
    inventory: { capacity: 60, stacks: [{ itemId: 'mushroom', quality: 'normal', count: 2 }] },
  });

  await page.keyboard.press('x');
  await expect(page.locator('#repair-panel')).toBeVisible();
  await expect(page.locator('#repair-panel')).toContainText('花園修復');

  await page.locator('#repair-list button', { hasText: '捐一件' }).first().click();
  await expect(page.locator('#hud-log')).toContainText('捐出了野菇');
});

test('a donation the bag cannot cover is refused and nothing leaves the bag', async ({ page }) => {
  await waitForGame(page);
  await seedAndReload(page, {
    calendar: { year: 1, season: 'spring', day: 4, minuteOfDay: 600 },
    mapId: 'plaza',
    player: { x: 6, y: 9, facing: 'down' },
    weather: 'sunny',
    forecast: 'sunny',
    inventory: { capacity: 60, stacks: [] },
  });

  await page.keyboard.press('x');
  await expect(page.locator('#repair-panel')).toBeVisible();
  // 背包空的時候，所有捐獻按鈕都不能按。
  const buttons = page.locator('#repair-list button');
  await expect(buttons.first()).toBeDisabled();
});

test('in summer the spring repair cannot be donated to, the lake repair is shown instead', async ({ page }) => {
  await waitForGame(page);
  await seedAndReload(page, {
    calendar: { year: 1, season: 'summer', day: 4, minuteOfDay: 600 },
    mapId: 'plaza',
    player: { x: 6, y: 9, facing: 'down' },
    weather: 'sunny',
    forecast: 'sunny',
    inventory: { capacity: 60, stacks: [{ itemId: 'fish.carp', quality: 'normal', count: 3 }] },
  });

  await page.keyboard.press('x');
  await expect(page.locator('#repair-panel')).toBeVisible();
  await expect(page.locator('#repair-panel')).toContainText('湖畔修復');
  await expect(page.locator('#repair-panel')).toContainText('這一項要等它的季節才能捐。');
});
