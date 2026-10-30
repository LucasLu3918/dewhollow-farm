import { expect, test, type Page } from '@playwright/test';

/**
 * 角色素材：玩家小涵與村裡的毛毛使用入庫的 2x 母版（128×160 的圖），
 * 以 0.5 倍顯示成 64×80，腳底貼齊所在格子的底部。
 * 讀取方式見 window.__dewhollow（僅開發模式）。
 */
interface SpriteInfo {
  key: string;
  left: number;
  top: number;
  width: number;
  height: number;
  flipX: boolean;
}

async function sprites(page: Page, prefix: string): Promise<SpriteInfo[]> {
  return page.evaluate((p) => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow（需用開發伺服器執行）');
    return debug.sprites().filter((s) => s.key.startsWith(p));
  }, prefix);
}

async function textureSize(page: Page, key: string): Promise<{ width: number; height: number }> {
  return page.evaluate((k) => {
    const size = window.__dewhollow?.textureSize(k);
    if (!size) throw new Error(`找不到貼圖 ${k}`);
    return size;
  }, key);
}

async function waitForGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 1 天');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

async function pressMovement(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await expect.poll(() => page.evaluate(() => {
    const movement = window.__dewhollow?.movement();
    return !movement || (!movement.moving && !movement.pending && movement.queuedTaps === 0 && movement.heldDirection === null);
  })).toBe(true);
}

test('the player is drawn from the real 2x image at half scale, standing on her tile', async ({ page }) => {
  const requested: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/assets/characters/') && r.ok()) requested.push(r.url().split('/').pop() ?? '');
  });
  await waitForGame(page);

  // 貼圖是檔案（128×160），不是 64×64 的占位圖。
  expect(await textureSize(page, 'player.down')).toEqual({ width: 128, height: 160 });
  expect(requested).toContain('xiaohan-2x.png');
  await expect(page.locator('#hud-log')).not.toContainText('素材載入失敗');

  // 新農場中央十字路口 (20,14)：顯示成 64×80，腳底貼齊所在格子底部。
  const [player] = await sprites(page, 'player.');
  expect(player).toMatchObject({ key: 'player.down', left: 20 * 64, top: 14 * 64 - 16, width: 64, height: 80 });
});

test('each direction has its own image, and facing right mirrors the side image', async ({ page }) => {
  const requested: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/assets/characters/') && r.ok()) requested.push(r.url().split('/').pop() ?? '');
  });
  await waitForGame(page);

  // 前、後、側三張都是真正載入的 2x 圖（128×160）；朝右沒有自己的貼圖，直接用朝左的翻轉。
  for (const key of ['player.down', 'player.up', 'player.left']) {
    expect(await textureSize(page, key), key).toEqual({ width: 128, height: 160 });
  }
  expect(await page.evaluate(() => window.__dewhollow?.textureSize('player.right'))).toBeNull();
  expect(requested).toEqual(expect.arrayContaining(['xiaohan-2x.png', 'xiaohan-back-2x.png', 'xiaohan-side-2x.png']));
  await expect(page.locator('#hud-log')).not.toContainText('素材載入失敗');

  const current = async () => (await sprites(page, 'player.'))[0];

  // 往上：背面。出生點 (20,14) → (20,13)。
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await current())?.key).toBe('player.up');
  await expect.poll(async () => (await current())?.top).toBe(13 * 64 - 16);
  expect(await current()).toMatchObject({ left: 20 * 64, width: 64, height: 80, flipX: false });

  // 往左：側面，不翻轉。(20,13) → (19,13)。
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await current())?.left).toBe(19 * 64);
  expect(await current()).toMatchObject({ key: 'player.left', top: 13 * 64 - 16, width: 64, height: 80, flipX: false });

  // 往右：同一張側面圖，水平翻轉。(19,13) → (20,13)。
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await current())?.left).toBe(20 * 64);
  expect(await current()).toMatchObject({ key: 'player.left', top: 13 * 64 - 16, width: 64, height: 80, flipX: true });

  // 往下：回到正面，不翻轉。
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await current())?.key).toBe('player.down');
  // 貼圖一換就變了，但人還在走這一步（傾斜、拉長會讓外框變大）。完成的條件是「角色不忙了」；
  // 不能用「外框剛好是 64×80」判斷——一步剛開始的瞬間外框也恰好是 64×80。
  await expect
    .poll(() => page.evaluate(() => window.__dewhollow?.actors().find((a) => a.id === 'player')?.busy ?? true))
    .toBe(false);
  expect(await current()).toMatchObject({ flipX: false, width: 64, height: 80 });
});

test('Maomao in the village uses the real image and stands on his tile', async ({ page }) => {
  await waitForGame(page);
  // 從中央路口繞過南側出貨箱，再由農場南門進入村莊。
  for (let i = 0; i < 12; i += 1) await pressMovement(page, 'ArrowDown');
  await pressMovement(page, 'ArrowLeft');
  for (let i = 0; i < 2; i += 1) await pressMovement(page, 'ArrowDown');
  await pressMovement(page, 'ArrowRight');
  await pressMovement(page, 'ArrowDown');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('village');

  expect(await textureSize(page, 'npc.maomao')).toEqual({ width: 128, height: 160 });
  const [maomao] = await sprites(page, 'npc.maomao');
  // 村莊 (10,5)：腳底在 (5+1)×64 = 384。
  expect(maomao).toMatchObject({ key: 'npc.maomao', left: 640, top: 304, width: 64, height: 80 });
  await expect(page.locator('#hud-log')).not.toContainText('素材載入失敗');
});

test('terrain and object tiles use their 2x masters (128 px), shown at 64 px', async ({ page }) => {
  await waitForGame(page);
  expect(await textureSize(page, 'tile.grass')).toEqual({ width: 128, height: 128 });
  expect(await textureSize(page, 'tile.tree')).toEqual({ width: 128, height: 128 });
});
