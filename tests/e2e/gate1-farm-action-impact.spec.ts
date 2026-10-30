import { expect, test, type Page } from '@playwright/test';

test.use({ video: 'on' });

interface FarmState {
    calendar: { day: number };
    plots: Record<string, {
      watered: boolean;
      crop: null | { cropId: string; growthDays: number };
    }>;
    inventory: { stacks: Array<{ itemId: string; count: number }> };
}

interface FarmDebug {
  gameState(): FarmState;
  effectLog(): Array<{ name: string; at: number }>;
}

interface FarmSnapshot {
  gameState: FarmState;
  effectLog: Array<{ name: string; at: number }>;
}

async function debug(page: Page): Promise<FarmSnapshot> {
  return page.evaluate(() => {
    const value = (window as unknown as { __dewhollow?: FarmDebug }).__dewhollow;
    if (!value) throw new Error('缺少開發模式農場測試介面');
    return { gameState: value.gameState(), effectLog: value.effectLog() };
  });
}

async function press(page: Page, key: string): Promise<void> {
  const before = key.startsWith('Arrow')
    ? await page.evaluate(() => {
      const tile = window.__dewhollow?.movement().tile;
      return tile ? { x: tile.x, y: tile.y } : null;
    })
    : null;
  await page.keyboard.press(key);
  if (key.startsWith('Arrow')) {
    await expect.poll(() => page.evaluate(() => {
      const tile = window.__dewhollow?.movement().tile;
      return tile ? { x: tile.x, y: tile.y } : null;
    }))
      .not.toEqual(before);
    await expect.poll(() => page.evaluate(() => {
      const movement = window.__dewhollow?.movement();
      return !movement || (!movement.moving && !movement.pending && movement.queuedTaps === 0 && movement.heldDirection === null);
    })).toBe(true);
  }
}

async function waitForEffect(page: Page, action: string, count: number): Promise<void> {
  await expect.poll(() => page.evaluate((name) =>
    window.__dewhollow?.effectLog().filter((event) => event.name === name).length ?? 0,
  `effect:${action}`)).toBe(count);
}

async function walk(page: Page, key: string, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) await press(page, key);
}

async function fieldToBed(page: Page): Promise<void> {
  await walk(page, 'ArrowDown', 3); // field edge (9,24) -> south lane (9,27)
  await walk(page, 'ArrowRight', 9); // pass the shipping crate at (20,27) via (19,27)
  await walk(page, 'ArrowUp', 13); // farm crossroads (19,14)
  await walk(page, 'ArrowRight', 8); // farmhouse entrance lane (27,14)
  await walk(page, 'ArrowUp', 5); // enter the farmhouse at (27,9)
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('house');
  await walk(page, 'ArrowLeft', 5); // house spawn (10,18) -> clear aisle (5,18)
  await walk(page, 'ArrowUp', 10);
  await walk(page, 'ArrowLeft', 1); // (4,8), south of the bed; bypass the workbench
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement().tile ?? null)).toMatchObject({ x: 4, y: 8 });
  await page.keyboard.press('ArrowUp'); // face the bed at (4,7), which blocks movement
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement().tile ?? null)).toMatchObject({ x: 4, y: 8 });
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.interaction() ?? null)).toMatchObject({
    action: 'sleep', target: { x: 4, y: 7 },
  });
  await press(page, 'x');
}

async function bedToField(page: Page): Promise<void> {
  await walk(page, 'ArrowRight', 1); // leave the bed approach through the clear aisle
  await walk(page, 'ArrowDown', 10);
  await walk(page, 'ArrowRight', 5);
  await press(page, 'ArrowDown'); // exit to farm (27,10)
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await walk(page, 'ArrowLeft', 7); // central road (20,10)
  await walk(page, 'ArrowDown', 16); // approach the shipping crate at (20,26)
  await walk(page, 'ArrowLeft', 1); // pass beside the shipping crate at (19,26)
  await walk(page, 'ArrowDown', 2); // south lane (19,28)
  await walk(page, 'ArrowLeft', 10); // field path (9,28)
  await walk(page, 'ArrowUp', 4); // plot approach (9,24)
  await press(page, 'ArrowRight');
}

test('records till, sow, water, overnight growth and harvest with hit feedback', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');

  // Start at the crossroads, follow the south lane to the fenced farm plots.
  await walk(page, 'ArrowDown', 12);
  await walk(page, 'ArrowLeft', 1);
  await walk(page, 'ArrowDown', 1);
  await walk(page, 'ArrowLeft', 10);
  await walk(page, 'ArrowUp', 3); // (9,24), west of a field plot
  await press(page, 'ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.interaction() ?? null)).toMatchObject({
    action: 'workPlot', labelKey: 'till', target: { x: 11, y: 24 },
  });
  await press(page, 'x'); // hoe: till
  await waitForEffect(page, 'till', 1);
  await expect(page.locator('#hud-log')).toContainText('開墾了一塊田');

  await press(page, 'z');
  await press(page, 'z');
  await press(page, 'x'); // sow the selected moon bean
  await waitForEffect(page, 'plant', 1);
  await expect(page.locator('#hud-log')).toContainText('播下了 月光豆 種子');
  await press(page, 'z');
  await press(page, 'z');
  await press(page, 'x'); // water on day one
  await waitForEffect(page, 'water', 1);
  await expect.poll(async () => (await debug(page)).gameState.plots['farm|11,24']).toMatchObject({
    watered: true,
    crop: { cropId: 'moon-bean', growthDays: 0 },
  });

  const initialActions = (await debug(page)).effectLog.map((event) => event.name).filter((name) => name.startsWith('effect:'));
  expect(initialActions).toEqual(['effect:till', 'effect:plant', 'effect:water']);

  // One night grows the watered crop; water it again before the second night.
  await fieldToBed(page);
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 2 天');
  await bedToField(page);
  await expect.poll(async () => (await debug(page)).gameState.plots['farm|11,24']?.crop?.growthDays ?? -1).toBe(1);
  await press(page, 'x');
  await waitForEffect(page, 'water', 2);
  await fieldToBed(page);
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 3 天');

  await bedToField(page);
  await expect.poll(async () => (await debug(page)).gameState.plots['farm|11,24']?.crop?.growthDays ?? -1).toBe(2);
  await press(page, 'x'); // harvest the mature moon bean
  await waitForEffect(page, 'harvest', 1);
  await expect(page.locator('#hud-log')).toContainText('收成了 月光豆');

  const result = await debug(page);
  expect(result.gameState.plots['farm|11,24']).toMatchObject({ crop: null });
  expect(result.gameState.inventory.stacks.find((stack) => stack.itemId === 'crop.moon-bean')?.count ?? 0).toBeGreaterThanOrEqual(1);
  expect(result.effectLog.map((event) => event.name).filter((name) => name.startsWith('effect:'))).toEqual([
    'effect:water', 'effect:harvest',
  ]);
});
