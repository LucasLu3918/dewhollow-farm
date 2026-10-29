import { expect, test, type Page } from '@playwright/test';

/**
 * 存檔槽（M7）：三格存檔的新遊戲、讀取、刪除（二次確認）、匯出、匯入（驗證失敗不覆寫、舊版遷移）、損毀時保留原檔。
 * 注意：讀檔後要先等「已讀取存檔」出現（場景與鍵盤都接上了）才按鍵；換格會重新載入頁面，要等網址與載入完成。
 */

const V1_STATE = {
  schemaVersion: 1,
  calendar: { year: 1, season: 'spring', day: 4, minuteOfDay: 400 },
  energy: { current: 60, max: 100 },
  gold: 250,
  mapId: 'farm',
  player: { x: 7, y: 9, facing: 'down' },
  plots: {},
  bag: { seeds: { 'moon-bean': 2 }, crops: {} },
  shipBox: { items: {} },
  flags: {},
  tool: 'hoe',
  selectedSeed: 'moon-bean',
  rng: 12345,
};

/** 等場景真的建立好、鍵盤監聽器掛上才開始按鍵（與 farm-loop.spec.ts 相同的做法）。 */
async function waitForScene(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).not.toBe('');
}

async function startGame(page: Page, url = '/'): Promise<void> {
  await page.goto(url);
  await expect(page.locator('#game canvas')).toBeVisible();
  await waitForScene(page);
}

async function press(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
}

async function openSlots(page: Page): Promise<void> {
  await press(page, 'l');
  await expect(page.locator('#save-panel')).toBeVisible();
}

/** 第 n 格（1 起算）的列。 */
function row(page: Page, n: number) {
  return page.locator('#save-list li.save-slot').nth(n - 1);
}

/**
 * 模擬在匯入對話框選了一個檔案：把內容放進面板的檔案欄位並觸發 change（不用系統的檔案視窗）。
 * 呼叫前先按下面板上的「匯入」。
 */
async function chooseImportFile(page: Page, name: string, text: string): Promise<void> {
  await page.evaluate(
    ({ fileName, content }) => {
      const input = document.querySelector<HTMLInputElement>('#save-panel input[type=file]');
      if (!input) throw new Error('找不到匯入的檔案欄位');
      const transfer = new DataTransfer();
      transfer.items.add(new File([content], fileName, { type: 'application/json' }));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change'));
    },
    { fileName: name, content: text },
  );
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

async function readRecord(page: Page, slot: string): Promise<{ state: unknown } | undefined> {
  return page.evaluate(
    (key) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('dewhollow-farm');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result.transaction('saves').objectStore('saves').get(key);
          get.onsuccess = () => {
            open.result.close();
            resolve(get.result);
          };
          get.onerror = () => reject(get.error);
        };
      }),
    slot,
  );
}

test('lists three slots and starts on slot 1', async ({ page }) => {
  await startGame(page);
  await openSlots(page);
  await expect(page.locator('#save-list li.save-slot')).toHaveCount(3);
  await expect(row(page, 1).locator('.save-title')).toContainText('正在玩');
  await expect(row(page, 2).locator('.save-detail')).toContainText('空白');
});

test('the slot in the address bar is the one that opens', async ({ page }) => {
  await startGame(page, '/?slot=slot-2');
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 1 天');
  await openSlots(page);
  await expect(row(page, 2).locator('.save-title')).toContainText('正在玩');
});

test('a new game in slot 2 switches to slot 2 and keeps the progress of slot 1', async ({ page }) => {
  await startGame(page);
  await press(page, 's');
  await expect(page.locator('#hud-log')).toContainText('已存檔');

  await openSlots(page);
  await Promise.all([page.waitForURL(/slot=slot-2/), row(page, 2).getByRole('button', { name: '新遊戲' }).click()]);
  await waitForScene(page);
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 1 天');

  await openSlots(page);
  await expect(row(page, 1).locator('.save-detail')).not.toContainText('空白');
  await expect(row(page, 2).locator('.save-title')).toContainText('正在玩');
});

test('deleting a slot needs a second click', async ({ page }) => {
  await startGame(page);
  await press(page, 's');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  await openSlots(page);
  // 先換到第 2 格，才能刪除第 1 格（正在玩的格子刪除會重新載入）。
  await Promise.all([page.waitForURL(/slot=slot-2/), row(page, 2).getByRole('button', { name: '新遊戲' }).click()]);
  await waitForScene(page);

  await openSlots(page);
  await row(page, 1).getByRole('button', { name: '刪除' }).click();
  await expect(row(page, 1).getByRole('button', { name: '再按一次：確定刪除' })).toBeVisible();
  await expect(row(page, 1).locator('.save-detail')).not.toContainText('空白');

  await row(page, 1).getByRole('button', { name: '再按一次：確定刪除' }).click();
  await expect(page.locator('#save-message')).toContainText('已刪除');
  await expect(row(page, 1).locator('.save-detail')).toContainText('空白');
});

test('export downloads a file named with the slot and the date', async ({ page }) => {
  await startGame(page);
  await press(page, 's');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  await openSlots(page);

  const downloadPromise = page.waitForEvent('download');
  await row(page, 1).getByRole('button', { name: '匯出' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^dewhollow-farm-slot-1-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(page.locator('#save-message')).toContainText('已匯出');
});

test('importing a newer version is refused and the empty slot stays empty', async ({ page }) => {
  await startGame(page);
  await openSlots(page);

  await row(page, 3).getByRole('button', { name: '匯入' }).click();
  await chooseImportFile(page, 'newer.json', JSON.stringify({ slot: 'slot-3', savedAt: '2026-10-22T00:00:00.000Z', state: { ...V1_STATE, schemaVersion: 26 } }));
  await expect(page.locator('#save-message')).toContainText('更新版本');
  await expect(page.locator('#save-message')).toContainText('沒有被改動');
  await expect(row(page, 3).locator('.save-detail')).toContainText('空白');
});

test('importing a file that is not JSON is refused', async ({ page }) => {
  await startGame(page);
  await openSlots(page);

  await row(page, 3).getByRole('button', { name: '匯入' }).click();
  await chooseImportFile(page, 'broken.json', '{ 壞掉的內容');
  await expect(page.locator('#save-message')).toContainText('不是有效的 JSON');
  await expect(row(page, 3).locator('.save-detail')).toContainText('空白');
});

test('importing a version 1 save migrates it and it loads', async ({ page }) => {
  await startGame(page);
  await openSlots(page);

  await row(page, 3).getByRole('button', { name: '匯入' }).click();
  await chooseImportFile(page, 'old.json', JSON.stringify({ slot: 'slot-1', savedAt: '2026-10-20T10:00:00.000Z', state: V1_STATE }));
  await expect(page.locator('#save-message')).toContainText('已匯入到');
  await expect(row(page, 3).getByRole('button', { name: '讀取' })).toBeVisible();

  await Promise.all([page.waitForURL(/slot=slot-3/), row(page, 3).getByRole('button', { name: '讀取' }).click()]);
  await waitForScene(page);
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 4 天');
  await expect(page.locator('#hud-gold')).toHaveText('250 金');
  const saved = await readRecord(page, 'slot-3');
  expect((saved?.state as { schemaVersion: number }).schemaVersion).toBe(25);
});

test('saves and reloads a current v25 game without losing inventory, tools, clothing, map, or skills', async ({ page }) => {
  await startGame(page);
  const state = await page.evaluate(() => window.__dewhollow!.gameState());
  expect(state.schemaVersion).toBe(25);
  state.mapId = 'village';
  state.player = { ...state.player, x: 7, y: 9, facing: 'down' };
  state.inventory = {
    capacity: 24,
    stacks: [{ itemId: 'crop.moon-bean', quality: 'good', count: 3 }],
  };
  state.toolTiers = { ...state.toolTiers, hoe: 2, rod: 1 };
  state.wearing = { player: 'sun-hat' };
  state.skills = { ...state.skills, farming: 137, fishing: 42 };
  await putRecord(page, { slot: 'slot-1', savedAt: '2026-10-27T00:00:00.000Z', state });

  await page.reload();
  await waitForScene(page);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('village');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.gameState().schemaVersion ?? 0)).toBe(25);
  await press(page, 's');
  await expect(page.locator('#hud-log')).toContainText('已存檔');

  await page.reload();
  await waitForScene(page);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('village');
  const reloaded = await page.evaluate(() => window.__dewhollow!.gameState());
  expect(reloaded.schemaVersion).toBe(25);
  expect(reloaded.inventory).toEqual({
    capacity: 24,
    stacks: [{ itemId: 'crop.moon-bean', quality: 'good', count: 3 }],
  });
  expect(reloaded.toolTiers).toMatchObject({ hoe: 2, rod: 1 });
  expect(reloaded.wearing).toEqual({ player: 'sun-hat' });
  expect(reloaded.skills).toMatchObject({ farming: 137, fishing: 42 });
  expect(reloaded.player).toMatchObject({ x: 7, y: 9, facing: 'down' });
});

test('a corrupt save shows the real error, keeps the original file, and opens the slot panel', async ({ page }) => {
  await startGame(page);
  await putRecord(page, { slot: 'slot-1', savedAt: '2026-10-22T00:00:00.000Z', state: 'not a save' });

  await page.reload();
  await expect(page.locator('#hud-log')).toContainText('無法讀取存檔');
  await expect(page.locator('#save-panel')).toBeVisible();
  await expect(row(page, 1).locator('.save-detail')).toContainText('損毀');
  await expect(row(page, 1).getByRole('button', { name: '讀取' })).toHaveCount(0);
  await expect(row(page, 1).getByRole('button', { name: '新遊戲' })).toHaveCount(0);

  const record = await readRecord(page, 'slot-1');
  expect(record?.state).toBe('not a save');
});
