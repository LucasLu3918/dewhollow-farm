import { expect, test, type Page } from '@playwright/test';

/**
 * M2 的回饋（ROADMAP：每個玩家動作都有對應視覺與音效）：
 * - 地形腳步：走過的格子決定腳步的塵土與聲音（草、田、石板路）；
 * - 拾取：收成時作物飛到玩家頭上，再飄出「+1 名稱」；
 * - 音效：每個動作播放對應的聲音，按 M 靜音。
 * 聲音與飛行的紀錄見 window.__dewhollow（僅開發模式）。
 */
interface LogEntry {
  name: string;
  at: number;
}

interface Actor {
  id: string;
  busy: boolean;
  pose: { y: number };
}

async function effectNames(page: Page): Promise<string[]> {
  const log = (await page.evaluate(() => window.__dewhollow?.effectLog() ?? [])) as LogEntry[];
  return log.map((entry) => entry.name);
}

async function soundIds(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__dewhollow?.soundLog() ?? []) as Promise<string[]>;
}

async function waitForGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

async function press(page: Page, key: string, times = 1): Promise<void> {
  for (let i = 0; i < times; i += 1) {
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

/** 等玩家真的靜止（沒有在走、揮、排隊）。 */
async function settle(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      const actors = (await page.evaluate(() => window.__dewhollow?.actors() ?? [])) as Actor[];
      return actors.find((a) => a.id === 'player')?.busy ?? true;
    })
    .toBe(false);
}

test('each ground makes its own footprint: grass, tilled field, then the stone path', async ({ page }) => {
  await waitForGame(page);
  await press(page, 'ArrowUp', 4); // (7,9) → (7,5)，離開的是草地
  await settle(page);
  await press(page, 'ArrowDown'); // 離開田地 (7,5)
  await settle(page);
  await press(page, 'ArrowDown', 4); // 草地 → 路 (7,10)
  await settle(page);
  await press(page, 'ArrowUp'); // 離開路 (7,10)
  await settle(page);

  const names = (await effectNames(page)).filter((name) => name.startsWith('step:'));
  expect(names).toContain('step:grass');
  expect(names).toContain('step:field');
  expect(names).toContain('step:path');
  // 順序：先離開草地，之後離開田地，最後離開路。
  expect(names.indexOf('step:field')).toBeGreaterThan(names.indexOf('step:grass'));
  expect(names.lastIndexOf('step:path')).toBeGreaterThan(names.indexOf('step:field'));
});

test('a harvested crop flies up to the player and is named as it lands', async ({ page }) => {
  await waitForGame(page);
  // 田邊 (7,5) → 小屋的床 (2,1)：左走五步到 (2,5)、上一步進門（落在 (4,5)）、上三步到 (4,2)、繞過工作台到 (2,2)、上一步、左轉向床。
  const toBed = ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowLeft', 'ArrowUp', 'ArrowLeft'];
  // 小屋的床 (2,1) → 田邊 (7,5)：右一步到 (3,1)、下四步到 (3,5)、右一步到 (4,5)、下到門出去，再下一步、右五步，最後往上一步面向田。
  const backToField = ['ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowUp'];

  // 開墾 (7,4)、播下月光豆（生長 2 天）、澆水；作物每天都要澆，否則會枯死。
  await press(page, 'ArrowUp', 4); // → (7,5) 面向 (7,4)
  await settle(page);
  await press(page, 'x'); // 開墾
  await settle(page);
  await press(page, 'z', 2); // 種子袋
  await press(page, 'x'); // 播種
  await settle(page);
  await press(page, 'z', 2); // 水壺
  await press(page, 'x'); // 澆水
  await settle(page);

  // 第一晚睡醒後澆水（第 2 天）；第二晚睡醒後作物已成熟，面向它按 x 就是收成。
  for (const key of toBed) await press(page, key);
  await settle(page);
  await press(page, 'x'); // 睡覺
  await settle(page);
  for (const key of backToField) await press(page, key);
  await settle(page);
  await press(page, 'x'); // 澆水
  await settle(page);

  for (const key of toBed) await press(page, key);
  await settle(page);
  await press(page, 'x'); // 睡覺
  await settle(page);
  for (const key of backToField) await press(page, key);
  await settle(page);
  await press(page, 'x'); // 收成
  await settle(page);

  const names = await effectNames(page);
  expect(names).toContain('pickup:moon-bean');
  await expect(page.locator('#hud-log')).toContainText('收成了 月光豆');
});

test('the tool makes its sound when it lands, after the swing starts', async ({ page }) => {
  await waitForGame(page);
  await press(page, 'ArrowUp', 5);
  await settle(page);
  await press(page, 'x');
  await settle(page);

  const sounds = await soundIds(page);
  expect(sounds).toContain('swing');
  expect(sounds).toContain('till');
  expect(sounds.indexOf('swing')).toBeLessThan(sounds.indexOf('till'));
});

test('cycling the tool clicks, and M turns the sound off and back on', async ({ page }) => {
  await waitForGame(page);
  await press(page, 'z');
  expect(await soundIds(page)).toContain('click');

  await press(page, 'm');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.muted() ?? false)).toBe(true);
  const before = (await soundIds(page)).length;
  await press(page, 'z');
  await press(page, 'x');
  expect((await soundIds(page)).length).toBe(before);
  await expect(page.locator('#hud-log')).toContainText('已靜音');

  await press(page, 'm');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.muted() ?? true)).toBe(false);
  await press(page, 'z');
  expect((await soundIds(page)).length).toBeGreaterThan(before);
});
