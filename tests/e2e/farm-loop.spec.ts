import { expect, test, type Page } from '@playwright/test';

/**
 * 可重現的多日循環：耕地／播種／澆水 → 拒絕重複開墾 → 森林採集 → 存讀 →
 * 睡覺隔日與照料作物 → 收成／出貨 → 日結 → 存檔讀回資源。
 * 地圖座標依 content/maps/farm.json、house.json 與 forest.json。
 */
async function press(page: Page, keys: string[]): Promise<void> {
  for (const key of keys) {
    await page.keyboard.press(key);
    if (key.startsWith('Arrow')) await waitForMovementIdle(page);
  }
}

async function waitForMovementIdle(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const movement = window.__dewhollow?.movement();
    return !movement || (!movement.moving && !movement.pending && movement.queuedTaps === 0 && movement.heldDirection === null);
  })).toBe(true);
}

async function walk(page: Page, key: string, steps: number): Promise<void> {
  for (let i = 0; i < steps; i += 1) {
    const before = await page.evaluate(() => ({
      mapId: window.__dewhollow?.mapId() ?? '',
      x: window.__dewhollow?.gameState().player.x ?? null,
      y: window.__dewhollow?.gameState().player.y ?? null,
    }));
    await page.keyboard.press(key);
    await expect.poll(() => page.evaluate(() => ({
      mapId: window.__dewhollow?.mapId() ?? '',
      x: window.__dewhollow?.gameState().player.x ?? null,
      y: window.__dewhollow?.gameState().player.y ?? null,
    }))).not.toEqual(before);
    await waitForMovementIdle(page);
  }
}

/** 只有出貨箱這個設計阻擋格允許 tile 不變；仍須明確驗證位置不變且轉向箱子。 */
async function faceBlockedShipbox(page: Page): Promise<void> {
  const before = await page.evaluate(() => ({
    mapId: window.__dewhollow?.mapId() ?? '',
    player: window.__dewhollow?.gameState().player ?? null,
  }));
  expect(before).toMatchObject({ mapId: 'farm', player: { x: 19, y: 27, facing: 'up' } });

  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => ({
    mapId: window.__dewhollow?.mapId() ?? '',
    player: window.__dewhollow?.gameState().player ?? null,
  }))).toMatchObject({ mapId: 'farm', player: { x: 19, y: 27, facing: 'right' } });
  await waitForMovementIdle(page);
}

/** 開發模式的場景建立與鍵盤監聽在同一同步段落；等 mapId 可避免開場按鍵被丟掉。 */
async function waitForScene(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).not.toBe('');
}

async function waitForGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 1 天');
  await waitForScene(page);
}

async function fieldToBed(page: Page): Promise<void> {
  // 由田區東側農門接上中央大道，再由小屋正門進屋。
  await walk(page, 'ArrowRight', 9);
  await walk(page, 'ArrowUp', 10);
  await walk(page, 'ArrowRight', 7);
  await walk(page, 'ArrowUp', 5);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('house');
  await walk(page, 'ArrowUp', 9);
  await walk(page, 'ArrowLeft', 6);
  await walk(page, 'ArrowUp', 1);
  await page.keyboard.press('ArrowUp'); // 面向床位 (4,7)
  await page.keyboard.press('x');
}

async function bedToField(page: Page): Promise<void> {
  // 床前 (4,8) → 門 → 農場 spawn (27,10)，沿中央大道通過農門回田區。
  await walk(page, 'ArrowRight', 6);
  await walk(page, 'ArrowDown', 11); // 出門回到農場 (27,10)
  await walk(page, 'ArrowLeft', 7);
  await walk(page, 'ArrowDown', 14);
  await walk(page, 'ArrowLeft', 9);
}

async function moveToFarmField(page: Page): Promise<void> {
  // 出生點 (20,14) 沿中央大道南下，再從農門進田區到 (11,24)。
  await walk(page, 'ArrowDown', 10);
  await walk(page, 'ArrowLeft', 9);
}

async function moveToShipbox(page: Page): Promise<void> {
  // 從田格 (11,24) 繞到出貨箱西側 (19,27)，再轉身面向箱子。
  await walk(page, 'ArrowRight', 8);
  await walk(page, 'ArrowDown', 4);
  await walk(page, 'ArrowUp', 1);
  await faceBlockedShipbox(page);
}

async function moveFromShipboxToBed(page: Page): Promise<void> {
  // 從出貨箱旁回到中央道路，再由房門進屋走到床前。
  await walk(page, 'ArrowUp', 1);
  await walk(page, 'ArrowRight', 1);
  await walk(page, 'ArrowUp', 16);
  await walk(page, 'ArrowRight', 7);
  await walk(page, 'ArrowUp', 1);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('house');
  await walk(page, 'ArrowUp', 9);
  await walk(page, 'ArrowLeft', 6);
  await walk(page, 'ArrowUp', 1);
}

async function readSavedGame(page: Page): Promise<{
  state: {
    calendar: { day: number; season: string };
    energy: { current: number };
    gold: number;
    shipBox: { entries: unknown[] };
    inventory: { stacks: { itemId: string; count: number }[] };
  };
}> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('dewhollow-farm');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('saves').objectStore('saves').get('slot-1');
      get.onsuccess = () => { db.close(); resolve(get.result); };
      get.onerror = () => { db.close(); reject(get.error); };
    };
  })) as Promise<{
    state: {
      calendar: { day: number; season: string };
      energy: { current: number };
      gold: number;
      shipBox: { entries: unknown[] };
      inventory: { stacks: { itemId: string; count: number }[] };
    };
  }>;
}

test('completes farm, exploration, shipping and save loop without duplicate costs', async ({ page }) => {
  test.setTimeout(180_000);
  await waitForGame(page);

  // 第 1 天耕地、播種、澆水；同一格重複開墾應被拒絕且不再扣體力。
  await moveToFarmField(page);
  await page.keyboard.press('x');
  await expect(page.locator('#hud-energy-text')).toHaveText('98 / 100');
  await expect(page.locator('#hud-log')).toContainText('開墾了一塊田');
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('這塊田已經開墾');
  await expect(page.locator('#hud-energy-text')).toHaveText('98 / 100');

  await press(page, ['z', 'z', 'x']); // 月光豆種子
  await expect(page.locator('#hud-log')).toContainText('播下了 月光豆 種子');
  await expect(page.locator('#hud-energy-text')).toHaveText('97 / 100');
  await press(page, ['z', 'z', 'x']); // 水壺
  await expect(page.locator('#hud-log')).toContainText('澆了水');
  await expect(page.locator('#hud-energy-text')).toHaveText('96 / 100');

  // 手動存讀保留第一天耕作與資源狀態。
  await page.keyboard.press('s');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  await page.reload();
  await waitForScene(page);
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 1 天');
  await expect(page.locator('#hud-energy-text')).toHaveText('96 / 100');

  // 第 1 天探索森林採集；重複採同一採集點會提示已採過，不能再次扣體力。
  await walk(page, 'ArrowRight', 9);
  await walk(page, 'ArrowUp', 10);
  await walk(page, 'ArrowRight', 19); // 由中央大道到東門 → 森林 (2,7)，避開田區圍籬與出貨箱
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('forest');
  await walk(page, 'ArrowDown', 1); // (2,8)，面向 (2,9) 野薄荷
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('採到了');
  await expect(page.locator('#hud-energy-text')).toHaveText('95 / 100');
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('這裡已經採過了');
  await expect(page.locator('#hud-energy-text')).toHaveText('95 / 100');

  await page.keyboard.press('s');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  await page.reload();
  await waitForScene(page);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('forest');
  await expect(page.locator('#hud-energy-text')).toHaveText('95 / 100');
  const forestSave = await readSavedGame(page);
  expect(forestSave.state.inventory.stacks.find((stack) => stack.itemId === 'mint')?.count ?? 0).toBeGreaterThan(0);

  // 返回農場進屋睡覺，隔日體力恢復、作物成長。
  await walk(page, 'ArrowUp', 1); // 回到森林西門所在的第 7 列
  await walk(page, 'ArrowLeft', 2); // 森林西門 → 農場 (30,7)
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await walk(page, 'ArrowDown', 2);
  await walk(page, 'ArrowLeft', 3); // 森林西門落在 (30,7)，沿支路到小屋門 (27,9)
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('house');
  await walk(page, 'ArrowUp', 9);
  await walk(page, 'ArrowLeft', 6);
  await walk(page, 'ArrowUp', 1);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('x');
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 2 天');
  await expect(page.locator('#hud-energy-text')).toHaveText('100 / 100');
  await expect(page.locator('#hud-log')).toContainText('你睡了一覺');

  // 第 2 天澆水後再睡；第 3 天月光豆成熟。
  await bedToField(page);
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('澆了水');
  await expect(page.locator('#hud-energy-text')).toHaveText('99 / 100');
  await fieldToBed(page);
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 3 天');
  await expect(page.locator('#hud-energy-text')).toHaveText('100 / 100');

  await bedToField(page);
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('收成了 月光豆');

  // 將作物與可出貨的採集物交給出貨箱，睡覺結算金幣。
  await moveToShipbox(page);
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('把作物放進了出貨箱');
  await moveFromShipboxToBed(page);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('house');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('x');
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 4 天');
  await expect(page.locator('#hud-energy-text')).toHaveText('100 / 100');
  await expect(page.locator('#hud-log')).toContainText('出貨箱結算 +');
  const settledGold = Number((await page.locator('#hud-gold').textContent())?.match(/\d+/)?.[0] ?? 0);
  expect(settledGold).toBeGreaterThan(100);

  // 隔日存檔重載後，日期、金幣、體力與出貨箱結算狀態都要一致。
  await page.keyboard.press('s');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  await page.reload();
  await waitForScene(page);
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 4 天');
  await expect(page.locator('#hud-energy-text')).toHaveText('100 / 100');
  await expect(page.locator('#hud-gold')).toHaveText(`${settledGold} 金`);
  const finalSave = await readSavedGame(page);
  expect(finalSave.state.calendar).toMatchObject({ day: 4, season: 'spring' });
  expect(finalSave.state.energy.current).toBe(100);
  expect(finalSave.state.gold).toBe(settledGold);
  expect(finalSave.state.shipBox.entries).toHaveLength(0);
  expect(finalSave.state.inventory.stacks.some((stack) => stack.itemId === 'crop.moon-bean')).toBe(false);
});
