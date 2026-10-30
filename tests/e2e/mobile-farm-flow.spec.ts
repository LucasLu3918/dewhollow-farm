import { expect, test, type Page, type TestInfo } from '@playwright/test';

// Mirrors content/tuning.json: harvest min/max are 1/2 and harvest energy cost is 1.
const HARVEST_MIN = 1;
const HARVEST_MAX = 2;
const HARVEST_ENERGY_COST = 1;

const SETTINGS_KEY = 'dewhollow-farm.settings';
const HARVESTED_CROP = 'crop.moon-bean';

interface SavedGame {
  slot: string;
  savedAt: string;
  state: {
    calendar: { day: number; season: string };
    energy: { current: number };
    gold: number;
    inventory: { stacks: { itemId: string; count: number }[] };
    plots: Record<string, { watered: boolean; crop: { cropId: string; growthDays: number } | null }>;
    [key: string]: unknown;
  };
}

async function seedTouchSettings(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 2, settings: { touchControls: 'on' } }));
  }, SETTINGS_KEY);
}

async function start(page: Page): Promise<void> {
  await seedTouchSettings(page);
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await expect(page.locator('#touch-controls')).toBeVisible();
  await expect(page.locator('#touch-controls button[data-action="interact"]')).toBeVisible();
}

async function tile(page: Page): Promise<{ x: number; y: number }> {
  const actors = await page.evaluate(() => window.__dewhollow?.actors() ?? []);
  const player = (actors as { id: string; tileX: number; tileY: number }[]).find((actor) => actor.id === 'player');
  if (!player) throw new Error('找不到玩家');
  return { x: player.tileX, y: player.tileY };
}

async function touchAction(page: Page, action: string): Promise<void> {
  await page.locator(`#touch-controls button[data-action="${action}"]`).tap();
}

async function move(page: Page, direction: 'Up' | 'Down' | 'Left' | 'Right', steps = 1): Promise<void> {
  for (let index = 0; index < steps; index += 1) {
    const before = await tile(page);
    await touchAction(page, `move${direction}`);
    await page.waitForFunction(({ x, y }) => {
      const player = window.__dewhollow?.actors().find((actor) => actor.id === 'player');
      return Boolean(player && !player.busy && (player.tileX !== x || player.tileY !== y));
    }, before);
  }
}

async function turnTowardBlockedTile(page: Page, direction: 'Up' | 'Down' | 'Left' | 'Right'): Promise<void> {
  const before = await tile(page);
  await touchAction(page, `move${direction}`);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.actors().find((actor) => actor.id === 'player')?.busy ?? true)).toBe(false);
  expect(await tile(page)).toEqual(before);
}

async function interact(page: Page): Promise<void> {
  await touchAction(page, 'interact');
}

async function openMoreAction(page: Page, action: string): Promise<void> {
  const more = page.locator('.touch-more-toggle');
  await more.tap();
  await expect(page.locator('#touch-more')).toBeVisible();
  await page.locator(`#touch-more button[data-action="${action}"]`).tap();
}

async function inventory(page: Page, slot = 'slot-1'): Promise<SavedGame> {
  return page.evaluate((slotId) => new Promise<SavedGame>((resolve, reject) => {
    const request = indexedDB.open('dewhollow-farm');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('saves').objectStore('saves').get(slotId);
      get.onsuccess = () => { db.close(); resolve(get.result as SavedGame); };
      get.onerror = () => { db.close(); reject(get.error); };
    };
  }), slot);
}

async function saveByTouch(page: Page): Promise<SavedGame> {
  await openMoreAction(page, 'manualSave');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  return inventory(page);
}

async function enterHouseAndSleep(page: Page): Promise<void> {
  await move(page, 'Down', 3); // field edge (10,24) -> south lane (10,27)
  await move(page, 'Right', 9); // pass the shipping crate at (20,27) via (19,27)
  await move(page, 'Up', 13); // farm crossroads (19,14)
  await move(page, 'Right', 8); // farmhouse entrance lane (27,14)
  await move(page, 'Up', 5); // farmhouse door (27,9)
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('house');
  await move(page, 'Left', 5); // house spawn (10,18) -> clear aisle (5,18)
  await move(page, 'Up', 10);
  await move(page, 'Left'); // (4,8), south of the bed; bypass the workbench
  await turnTowardBlockedTile(page, 'Up'); // face the bed at (4,7)
  await interact(page);
  await expect(page.locator('#hud-log')).toContainText('你睡了一覺');
}

async function bedToPlot(page: Page): Promise<void> {
  await move(page, 'Right'); // leave the bed approach through the clear aisle
  await move(page, 'Down', 10);
  await move(page, 'Right', 5);
  await move(page, 'Down'); // house door at (10,19) transitions to farm spawn (27,10)
  await expect.poll(() => page.evaluate(() => ({
    mapId: window.__dewhollow?.mapId() ?? '',
    tile: (() => { const { x, y } = window.__dewhollow?.movement().tile ?? { x: -1, y: -1 }; return { x, y }; })(),
  }))).toEqual({ mapId: 'farm', tile: { x: 27, y: 10 } }); // door transition ends at the farm spawn
  await move(page, 'Left', 7); // central road (20,10)
  await move(page, 'Down', 16); // approach the shipping crate at (20,26)
  await move(page, 'Left'); // pass beside the shipping crate at (19,26)
  await move(page, 'Down', 2); // south lane (19,28)
  await move(page, 'Left', 10); // field path (9,28)
  await move(page, 'Up', 4); // plot approach (9,24)
  await move(page, 'Right'); // stand west of the selected field target
  await expect.poll(() => tile(page)).toEqual({ x: 10, y: 24 });
}

async function talkShopAndReturn(page: Page): Promise<SavedGame> {
  const beforeVisit = await saveByTouch(page);
  expect(beforeVisit.state.gold).toBe(100);

  await move(page, 'Down', 12); // approach the shipping crate from the north
  await move(page, 'Left');
  await move(page, 'Down', 2);
  await move(page, 'Right');
  await move(page, 'Down'); // farm's south door -> village
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('village');
  await move(page, 'Up', 5);
  await move(page, 'Right', 2); // (9,5), next to Maomao at (10,5)
  await turnTowardBlockedTile(page, 'Right');
  await interact(page);
  await expect(page.locator('#hud-log')).toContainText('你好，我是毛毛。');

  // The first conversation gives three sweet-radish seeds and does not charge gold.
  await expect(page.locator('#hud-gold')).toHaveText('100 金');
  const beforeShopClock = await page.locator('#hud-clock').innerText();
  await move(page, 'Left', 6); // (9,5) -> store approach (3,5)
  await turnTowardBlockedTile(page, 'Up'); // the counter occupies (3,4)
  await interact(page);
  await expect(page.locator('#shop-panel')).toBeVisible();
  await expect(page.locator('#shop-title')).toHaveText('雜貨店');
  await page.locator('#shop-list li').first().getByRole('button', { name: '買一個' }).tap();
  await expect(page.locator('#hud-gold')).toHaveText('90 金');
  await expect(page.locator('#hud-clock')).toHaveText(beforeShopClock);
  await expect(page.locator('#hud-log')).toContainText('買了');
  await page.locator('#shop-close').tap();
  await expect(page.locator('#shop-panel')).toBeHidden();

  const bought = await saveByTouch(page);
  expect(bought.state.gold).toBe(beforeVisit.state.gold - 10);
  const countOf = (saved: SavedGame, itemId: string): number =>
    saved.state.inventory.stacks.find((stack) => stack.itemId === itemId)?.count ?? 0;
  expect(countOf(bought, 'seed.dew-grass')).toBe(countOf(beforeVisit, 'seed.dew-grass') + 1);
  expect(countOf(bought, 'seed.sweet-radish')).toBe(countOf(beforeVisit, 'seed.sweet-radish') + 3);

  await move(page, 'Right', 4);
  await move(page, 'Down', 6); // village south door -> farm (7,28)
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await move(page, 'Right', 2); // farm south lane (9,28)
  await move(page, 'Up', 4); // field approach (9,24)
  await move(page, 'Right'); // stand west of the selected field target
  await expect.poll(() => tile(page)).toEqual({ x: 10, y: 24 });
  return bought;
}

async function selectTool(page: Page, toolId: string): Promise<void> {
  await page.locator('#hud-tool').tap();
  await expect(page.locator('#tool-seed-panel')).toBeVisible();
  await page.locator(`#tool-seed-list [data-selector-id="${toolId}"]`).tap();
  await expect(page.locator('#tool-seed-panel')).toBeHidden();
}

async function plantWaterAndHarvest(page: Page, beforeFarm: SavedGame): Promise<SavedGame> {
  const tillEnergy = Number((await page.locator('#hud-energy-text').innerText()).match(/\d+/)?.[0]);
  await interact(page);
  await expect(page.locator('#hud-log')).toContainText('開墾了一塊田');
  await expect(page.locator('#hud-energy-text')).toHaveText(`${tillEnergy - 2} / 100`);

  await selectTool(page, 'seedbag');
  await page.locator('#hud-seed').tap();
  await expect(page.locator('#tool-seed-panel')).toBeVisible();
  await page.locator('#tool-seed-list [data-selector-id="moon-bean"]').tap();
  await expect(page.locator('#tool-seed-panel')).toBeHidden();
  await interact(page);
  await expect(page.locator('#hud-log')).toContainText('播下了 月光豆 種子');

  await selectTool(page, 'can');
  await interact(page);
  await expect(page.locator('#hud-log')).toContainText('澆了水');

  await enterHouseAndSleep(page); // night 1 -> day 2
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 2 天');
  await bedToPlot(page);
  await interact(page);
  await expect(page.locator('#hud-log')).toContainText('澆了水');
  await enterHouseAndSleep(page); // night 2 -> day 3
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 3 天');
  await bedToPlot(page);
  const harvestEnergyBefore = Number((await page.locator('#hud-energy-text').innerText()).match(/\d+/)?.[0]);
  const harvestEffectsBefore = await page.evaluate(() => window.__dewhollow?.effectLog().filter((entry) => entry.name === 'effect:harvest').length ?? 0);
  await interact(page);
  await expect(page.locator('#hud-log')).toContainText('收成了 月光豆');
  await expect(page.locator('#hud-log')).toContainText('成就達成：第一次收成（獲得 50 金）');
  await expect(page.locator('#hud-log li').filter({ hasText: '收成了 月光豆' })).toHaveCount(1);
  await expect(page.locator('#hud-log li').filter({ hasText: '第一次收成' })).toHaveCount(1);
  await expect(page.locator('#hud-energy-text')).toHaveText(`${harvestEnergyBefore - HARVEST_ENERGY_COST} / 100`);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.effectLog().filter((entry) => entry.name === 'effect:harvest').length ?? 0)).toBe(harvestEffectsBefore + 1);

  const saved = await saveByTouch(page);
  expect(saved.state.calendar).toMatchObject({ day: 3, season: 'spring' });
  expect(saved.state.energy.current).toBe(99);
  expect(saved.state.gold).toBe(140); // 90 after the shop purchase, plus the first-harvest achievement reward.
  const priorCrops = beforeFarm.state.inventory.stacks.find((stack) => stack.itemId === HARVESTED_CROP)?.count ?? 0;
  const harvestedCount = saved.state.inventory.stacks.find((stack) => stack.itemId === HARVESTED_CROP)?.count ?? 0;
  expect(harvestedCount - priorCrops).toBeGreaterThanOrEqual(HARVEST_MIN);
  expect(harvestedCount - priorCrops).toBeLessThanOrEqual(HARVEST_MAX);
  expect(saved.state.plots['farm|11,24']?.crop).toBeNull();
  expect(saved.state.inventory.stacks.find((stack) => stack.itemId === 'seed.dew-grass')?.count ?? 0).toBeGreaterThan(0);

  await page.reload();
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 3 天');
  await expect(page.locator('#hud-gold')).toHaveText('140 金');
  await expect(page.locator('#hud-energy-text')).toHaveText('99 / 100');
  const afterReload = await inventory(page);
  expect(afterReload.state).toMatchObject({ calendar: saved.state.calendar, energy: saved.state.energy, gold: saved.state.gold, inventory: saved.state.inventory });
  return afterReload;
}

test.describe('行動版完整觸控農場流程', () => {
  test.use({ hasTouch: true });

  for (const viewport of [
    { name: 'portrait', width: 390, height: 844 },
    { name: 'landscape', width: 844, height: 390 },
  ]) {
    test(`touch completes dialogue, shop, farm and save loop in ${viewport.name}`, async ({ page }, testInfo: TestInfo) => {
      test.setTimeout(300_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await start(page);
      const beforeFarm = await talkShopAndReturn(page);
      await plantWaterAndHarvest(page, beforeFarm);
      const screenshotPath = testInfo.outputPath(`farm-${viewport.name}-after-reload.png`);
      await page.screenshot({ path: screenshotPath });
      await testInfo.attach(`farm-${viewport.name}-after-reload`, { path: screenshotPath, contentType: 'image/png' });
    });
  }
});
