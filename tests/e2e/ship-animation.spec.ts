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

interface MovementSnapshot {
  mapId: string;
  tile: { x: number; y: number };
  facing: string;
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
    const before = key.startsWith('Arrow') ? await movementSnapshot(page) : null;
    await page.keyboard.press(key);
    if (before) {
      // Wait for the input to be consumed before checking idle; idle may still describe the previous frame.
      await expect.poll(() => movementSnapshot(page)).not.toEqual(before);
      await waitForMovementIdle(page);
    }
  }
}

async function movementSnapshot(page: Page): Promise<MovementSnapshot> {
  return page.evaluate(() => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow');
    const player = debug.actors().find((actor) => actor.id === 'player');
    if (!player) throw new Error('找不到玩家');
    return {
      mapId: debug.mapId(),
      tile: { x: player.tileX, y: player.tileY },
      facing: debug.gameState().player.facing,
    };
  });
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
 * 結束時玩家在新版田邊 (11,24)，面向 (12,24)。
 */
async function harvestMoonBean(page: Page): Promise<void> {
  await press(page, 'ArrowDown', 10);
  await press(page, 'ArrowLeft', 9); // → (11,24)，面向田格 (12,24)
  await settle(page);
  await press(page, 'x'); // 開墾
  await settle(page);
  await press(page, 'z', 2); // 種子袋
  await press(page, 'x'); // 播種
  await settle(page);
  await press(page, 'z', 2); // 水壺
  await press(page, 'x'); // 澆水
  await settle(page);

  await walkFieldToBed(page);
  await settle(page);
  await press(page, 'x'); // 睡覺
  await settle(page);
  await walkBedToField(page);
  await settle(page);
  await press(page, 'x'); // 澆水
  await settle(page);

  await walkFieldToBed(page);
  await settle(page);
  await press(page, 'x'); // 睡覺
  await settle(page);
  await walkBedToField(page);
  await settle(page);
  await press(page, 'x'); // 收成
  await settle(page);
}

async function walkFieldToBed(page: Page): Promise<void> {
  await press(page, 'ArrowRight', 9);
  await press(page, 'ArrowUp', 10);
  await press(page, 'ArrowRight', 7);
  await press(page, 'ArrowUp', 5);
  await press(page, 'ArrowUp', 9);
  await press(page, 'ArrowLeft', 6);
  await press(page, 'ArrowUp'); // (4,9) → 床前格 (4,8)，面向床，不走進床格 (4,7)
}

async function walkBedToField(page: Page): Promise<void> {
  await press(page, 'ArrowRight', 6);
  await press(page, 'ArrowDown', 11);
  await press(page, 'ArrowLeft', 7);
  await press(page, 'ArrowDown', 14);
  await press(page, 'ArrowLeft', 9);
}

/** 從新版田邊走到出貨箱 (20,27) 西側 (19,27)，面向箱子。 */
async function walkToShipBox(page: Page): Promise<void> {
  await press(page, 'ArrowRight', 8);
  await press(page, 'ArrowDown', 4);
  await press(page, 'ArrowUp');
  await settle(page);
  await press(page, 'ArrowRight'); // 箱子不能走進去，只會轉身面向它
  await settle(page);
}

test('a shipped crop flies into the box, and the shipping effect comes when it lands', async ({ page }) => {
  test.setTimeout(180_000);
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
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await waitForGame(page);
  await harvestMoonBean(page);
  await walkToShipBox(page);

  await press(page, 'x'); // 出貨
  await settle(page);

  await expect.poll(() => effectNames(page)).toContain('effect:ship');
  expect(await effectNames(page)).not.toContain('ship:fly');
});
