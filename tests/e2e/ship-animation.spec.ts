import { expect, test, type Page } from '@playwright/test';

/**
 * 出貨的飛行與箱蓋（見 src/presentation/ship-animation.ts 與 effects.ts 的 shipFlight）：
 * - 玩家在出貨箱前出貨：物品飛進箱子，落地後才出現原本的「出貨」效果；
 * - 減少動態（prefers-reduced-motion）時不飛、不開蓋，效果立刻出現。
 * 紀錄見 window.__dewhollow.effectLog()（僅開發模式）。
 */
interface LogEntry {
  name: string;
  at: number;
}

async function effectNames(page: Page): Promise<string[]> {
  const log = (await page.evaluate(() => window.__dewhollow?.effectLog() ?? [])) as LogEntry[];
  return log.map((entry) => entry.name);
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
      const actors = (await page.evaluate(() => window.__dewhollow?.actors() ?? [])) as { id: string; busy: boolean }[];
      return actors.find((a) => a.id === 'player')?.busy ?? true;
    })
    .toBe(false);
}

/**
 * 收成一棵月光豆，讓背包裡有可出貨的作物（沿用 feedback.spec.ts 的步驟）。
 * 結束時玩家在田邊 (7,5)，面向 (7,4)。
 */
async function harvestMoonBean(page: Page): Promise<void> {
  const toBed = [...Array(5).fill('ArrowLeft'), 'ArrowUp', ...Array(9).fill('ArrowUp'), ...Array(6).fill('ArrowLeft'), 'ArrowUp'];
  const backToField = [...Array(6).fill('ArrowRight'), 'ArrowDown', ...Array(9).fill('ArrowDown'), 'ArrowDown', ...Array(5).fill('ArrowRight'), 'ArrowDown', 'ArrowUp'];

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
}

/** 從田邊 (7,5) 走到出貨箱 (2,7) 的前面 (3,7)，再原地轉身面向箱子（出貨箱不能走進去）。 */
async function walkToShipBox(page: Page): Promise<void> {
  await press(page, 'ArrowLeft', 4); // → (3,5)
  await settle(page);
  await press(page, 'ArrowDown', 2); // → (3,7)
  await settle(page);
  await press(page, 'ArrowLeft'); // 箱子不能走進去，只會轉身面向它
  await settle(page);
}

test('a shipped crop flies into the box, and the shipping effect comes when it lands', async ({ page }) => {
  test.setTimeout(60_000);
  await waitForGame(page);
  await harvestMoonBean(page);
  await walkToShipBox(page);

  await press(page, 'x'); // 出貨
  await settle(page);

  await expect.poll(() => effectNames(page)).toContain('effect:ship');
  const names = await effectNames(page);
  expect(names).toContain('ship:fly');
  // 先飛、後落地：飛行的紀錄在出貨效果之前。
  expect(names.indexOf('ship:fly')).toBeLessThan(names.indexOf('effect:ship'));
  await expect(page.locator('#hud-log')).toContainText('把作物放進了出貨箱');
});

test('with reduced motion the crop does not fly, and the shipping effect shows at once', async ({ page }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await waitForGame(page);
  await harvestMoonBean(page);
  await walkToShipBox(page);

  await press(page, 'x'); // 出貨
  await settle(page);

  await expect.poll(() => effectNames(page)).toContain('effect:ship');
  expect(await effectNames(page)).not.toContain('ship:fly');
});
