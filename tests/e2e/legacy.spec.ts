import { expect, test, type Page } from '@playwright/test';

/**
 * 床邊的公告：農場評級、豐收重置（第 2 年春季第 1 天）與傳承（主線第 5 章完成後）。
 * 存檔使用目前 schema，站在小屋的 (2,5) 面向上方的公告 (2,4)，按 X 打開面板。
 * 兩個動作都要按兩次（第一次只顯示說明，第二次才確認）。
 * 注意：這份測試需要在本機 5173 port 執行 playwright，本次任務未執行（見交付報告）。
 */

function record(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    slot: 'slot-1',
    savedAt: '2026-10-22T10:00:00.000Z',
    state: {
      schemaVersion: 26,
      calendar: { year: 2, season: 'spring', day: 1, minuteOfDay: 360 },
      weather: 'sunny',
      forecast: 'sunny',
      energy: { current: 100, max: 100 },
      gold: 900,
      mapId: 'house',
      player: { x: 2, y: 5, facing: 'up' },
      plots: {},
      inventory: { capacity: 24, stacks: [{ itemId: 'hay', quality: 'normal', count: 2 }] },
      shipBox: { entries: [] },
      flags: { 'house-wing': true, 'main:1': true },
      tool: 'hoe',
      toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 },
      worldChanges: {},
      skills: { farming: 0, foraging: 0, fishing: 0, mining: 0, cooking: 0 },
      talents: {},
      fishing: null,
      animals: [],
      cows: [],
      sheep: [],
      processing: [],
      friendship: {},
      heartEvents: [],
      pendingHeartEvent: null,
      quests: {},
      board: { day: 0, daily: [], weekly: null },
      mail: {},
      dexFragments: 0,
      story: { chapter: 2 },
      festival: {
        done: {},
        contest: { year: 0, caught: 0 },
        sold: { year: 0, counts: {} },
        exchanged: { year: 0, counts: {} },
        harvest: { year: 0, count: 0 },
      },
      starLine: false,
      repairs: {},
      dailyEvent: { day: 0, id: null },
      collection: { found: [], claimed: [] },
      achievements: { unlocked: [], counters: {}, titles: [] },
      decor: {},
      wearing: {},
      merchant: { week: 0, bought: {} },
      mineSeed: 9,
      mineCheckpoint: 1,
      selectedSeed: 'moon-bean',
      hotbar: [null, null, null, null],
      rng: 12345,
      playtimeSeconds: 0,
      yearlyIncome: 0,
      previousYearIncome: 0,
      resetBonus: 0,
      playerName: '小涵',
      generation: 1,
      ...overrides,
    },
  };
}

/** 直接寫入遊戲使用的 IndexedDB（資料庫由遊戲啟動時建立）。 */
async function putRecord(page: Page, value: unknown): Promise<void> {
  await page.evaluate(
    (record) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('dewhollow-farm');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('saves', 'readwrite');
          tx.objectStore('saves').put(record);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    value,
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

test('豐收重置：第一次按只顯示說明，第二次確認後清空農場並增加售價加成', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await putRecord(page, record({}));

  await page.reload();
  // 讀檔後先等提示出現，再按鍵。
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
  await page.keyboard.press('x');
  await expect(page.locator('#legacy-panel')).toBeVisible();

  const reset = page.locator('#legacy-list button', { hasText: '豐收重置' }).first();
  await reset.click();
  // 第一次按之後還沒有執行：畫面只換成「再按一次確認」的按鈕。
  await expect(page.locator('#legacy-list button', { hasText: '再按一次確認豐收重置' })).toBeVisible();
  await page.locator('#legacy-list button', { hasText: '再按一次確認豐收重置' }).click();
  await expect(page.locator('#hud-log')).toContainText('豐收重置完成');
  // 面板開著時只有 Esc 能離開，離開後才能存檔。
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  const saved = await readRecord(page);
  expect(saved.state.schemaVersion).toBe(26);
  expect(saved.state.resetBonus).toBe(1);
  expect(saved.state.gold).toBe(100);
  expect(saved.state.flags).not.toHaveProperty('house-wing');
  expect(saved.state.flags).toHaveProperty('main:1', true);
});

test('傳承：主線第 5 章完成後，可以改名，二次確認後由新角色接手', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await putRecord(page, record({ story: { chapter: 6 }, playerName: '小涵', yearlyIncome: 800, calendar: { year: 3, season: 'autumn', day: 5, minuteOfDay: 360 } }));

  await page.reload();
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
  await page.keyboard.press('x');
  await expect(page.locator('#legacy-panel')).toBeVisible();

  await page.locator('#legacy-list input').fill('小禾');
  await page.locator('#legacy-list button', { hasText: '傳承' }).first().click();
  await expect(page.locator('#legacy-list button', { hasText: '再按一次確認傳承' })).toBeVisible();
  await page.locator('#legacy-list button', { hasText: '再按一次確認傳承' }).click();
  await expect(page.locator('#hud-log')).toContainText('小禾 接手了農場');
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  const saved = await readRecord(page);
  expect(saved.state.playerName).toBe('小禾');
  expect(saved.state.generation).toBe(2);
  expect(saved.state.calendar).toMatchObject({ year: 1, season: 'spring', day: 1 });
  expect(saved.state.yearlyIncome).toBe(0);
});
