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
  await page.keyboard.press(key);
  if (key.startsWith('Arrow')) {
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
  await walk(page, 'ArrowLeft', 5);
  await press(page, 'ArrowUp');
  await walk(page, 'ArrowUp', 9);
  await walk(page, 'ArrowLeft', 6);
  await press(page, 'ArrowUp');
  await press(page, 'ArrowUp');
  await press(page, 'x');
}

async function bedToField(page: Page): Promise<void> {
  await walk(page, 'ArrowRight', 6);
  await press(page, 'ArrowDown');
  await walk(page, 'ArrowDown', 9);
  await press(page, 'ArrowDown');
  await walk(page, 'ArrowRight', 5);
  await press(page, 'ArrowDown');
  await press(page, 'ArrowUp');
}

test('records till, sow, water, overnight growth and harvest with hit feedback', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');

  // Start at (7,9), approach the clear plot at (7,4) from its south side.
  await walk(page, 'ArrowUp', 4);
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
  await expect.poll(async () => (await debug(page)).gameState.plots['7,4']).toMatchObject({
    watered: true,
    crop: { cropId: 'moon-bean', growthDays: 0 },
  });

  const initialActions = (await debug(page)).effectLog.map((event) => event.name).filter((name) => name.startsWith('effect:'));
  expect(initialActions).toEqual(['effect:till', 'effect:plant', 'effect:water']);

  // One night grows the watered crop; water it again before the second night.
  await fieldToBed(page);
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 2 天');
  await bedToField(page);
  await expect.poll(async () => (await debug(page)).gameState.plots['7,4']?.crop?.growthDays ?? -1).toBe(1);
  await press(page, 'x');
  await waitForEffect(page, 'water', 2);
  await fieldToBed(page);
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 3 天');

  await bedToField(page);
  await expect.poll(async () => (await debug(page)).gameState.plots['7,4']?.crop?.growthDays ?? -1).toBe(2);
  await press(page, 'x'); // harvest the mature moon bean
  await waitForEffect(page, 'harvest', 1);
  await expect(page.locator('#hud-log')).toContainText('收成了 月光豆');

  const result = await debug(page);
  expect(result.gameState.plots['7,4']).toMatchObject({ crop: null });
  expect(result.gameState.inventory.stacks).toContainEqual(expect.objectContaining({ itemId: 'crop.moon-bean', count: 1 }));
  expect(result.effectLog.map((event) => event.name).filter((name) => name.startsWith('effect:'))).toEqual([
    'effect:till', 'effect:plant', 'effect:water', 'effect:water', 'effect:harvest',
  ]);
});
