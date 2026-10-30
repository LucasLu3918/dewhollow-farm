import { expect, test, type Page } from '@playwright/test';

interface Actor {
  id: string;
  tileX: number;
  tileY: number;
  busy: boolean;
}

interface SaveRecord {
  slot: string;
  savedAt: string;
  state: {
    calendar: { minuteOfDay: number; [key: string]: unknown };
    flags: Record<string, boolean>;
    friendship: Record<string, { points: number; talkedDay: number | null }>;
    inventory: unknown;
    gold: number;
    quests: Record<string, unknown>;
    [key: string]: unknown;
  };
}

async function waitForGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

async function actor(page: Page, id: string): Promise<Actor> {
  const actors = (await page.evaluate(() => window.__dewhollow?.actors() ?? [])) as Actor[];
  const found = actors.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`找不到角色 ${id}`);
  return found;
}

async function walk(page: Page, key: string, steps: number): Promise<void> {
  const delta = key === 'ArrowUp' ? { x: 0, y: -1 }
    : key === 'ArrowDown' ? { x: 0, y: 1 }
      : key === 'ArrowLeft' ? { x: -1, y: 0 }
        : { x: 1, y: 0 };
  for (let step = 0; step < steps; step += 1) {
    const from = await actor(page, 'player');
    const fromMap = await page.evaluate(() => window.__dewhollow?.mapId() ?? '');
    const expected = { x: from.tileX + delta.x, y: from.tileY + delta.y };
    await page.keyboard.press(key);
    await expect.poll(async () => {
      const current = await actor(page, 'player');
      const currentMap = await page.evaluate(() => window.__dewhollow?.mapId() ?? '');
      return currentMap !== fromMap ? expected : { x: current.tileX, y: current.tileY };
    }).toEqual(expected);
    await expect.poll(async () => (await actor(page, 'player')).busy).toBe(false);
  }
}

async function readSave(page: Page): Promise<SaveRecord> {
  return page.evaluate(() => new Promise<SaveRecord>((resolve, reject) => {
    const request = indexedDB.open('dewhollow-farm');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('saves').objectStore('saves').get('slot-1');
      get.onsuccess = () => { db.close(); resolve(get.result as SaveRecord); };
      get.onerror = () => { db.close(); reject(get.error); };
    };
  }));
}

async function saveGame(page: Page): Promise<SaveRecord> {
  await page.keyboard.press('s');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  return readSave(page);
}

function residentEffects(record: SaveRecord) {
  return {
    gold: record.state.gold,
    inventory: record.state.inventory,
    friendship: record.state.friendship['a-gan'],
    talked: record.state.flags['talked:a-gan'],
    quests: record.state.quests,
    minuteOfDay: record.state.calendar.minuteOfDay,
  };
}

test('a rendered resident conversation and shop flow survive reload without duplicate effects', async ({ page }) => {
  test.setTimeout(120_000);
  await waitForGame(page);

  // Farm spawn → village, then route around the shop counter to stand west of 阿柑 (2,4).
  // The shipbox blocks the central path at (20,27); route around its west side.
  await walk(page, 'ArrowDown', 12);
  await walk(page, 'ArrowLeft', 1);
  await walk(page, 'ArrowDown', 2);
  await walk(page, 'ArrowRight', 1);
  await walk(page, 'ArrowDown', 1);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('village');
  await expect.poll(async () => (await actor(page, 'a-gan')).tileX).toBe(2);
  await expect.poll(async () => (await actor(page, 'a-gan')).tileY).toBe(4);
  const villageSpawn = await actor(page, 'player');
  await walk(page, 'ArrowUp', 5);
  await walk(page, 'ArrowDown', 1);
  await walk(page, 'ArrowLeft', villageSpawn.tileX - 1);
  await walk(page, 'ArrowUp', 2);
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await actor(page, 'player')).busy).toBe(false);
  await expect.poll(() => page.evaluate(() => {
    const actors = window.__dewhollow?.actors() ?? [];
    return {
      player: actors.find((candidate) => candidate.id === 'player'),
      resident: actors.find((candidate) => candidate.id === 'a-gan'),
      interaction: window.__dewhollow?.interaction(),
    };
  })).toMatchObject({
    player: { tileX: 1, tileY: 4 },
    resident: { tileX: 2, tileY: 4 },
    interaction: { action: 'talk', entityId: 'a-gan' },
  });

  const beforeTalkClock = await page.locator('#hud-clock').innerText();
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('歡迎光臨雜貨店');
  await expect(page.locator('#hud-clock')).toHaveText(beforeTalkClock);
  await page.keyboard.press('f');
  await expect(page.locator('#resident-panel')).toBeVisible();
  await expect(page.locator('#resident-list')).toContainText('阿柑');
  await expect(page.locator('#resident-list')).toContainText('今天已聊過');
  await page.keyboard.press('Escape');

  // The clean-start A-Gan request needs one heart (100 points); one talk grants only 10.
  await page.keyboard.press('j');
  await expect(page.locator('#quest-panel')).toBeVisible();
  await expect(page.locator('#quest-list')).toContainText('居民委託');
  await expect(page.locator('#quest-list')).not.toContainText('進貨前的雞蛋');
  await page.keyboard.press('Escape');

  const afterFirstTalk = await saveGame(page);
  expect(afterFirstTalk.state.flags['talked:a-gan']).toBe(true);
  expect(afterFirstTalk.state.friendship['a-gan']?.points).toBe(10);
  expect(afterFirstTalk.state.gold).toBe(100);
  expect(afterFirstTalk.state.quests).toEqual({});

  // A second talk on the same day is dialogue-only and does not change gameplay state again.
  const logCountBeforeRepeat = await page.locator('#hud-log li').count();
  await page.keyboard.press('x');
  await expect.poll(() => page.locator('#hud-log li').count()).toBeGreaterThan(logCountBeforeRepeat);
  await expect(page.locator('#hud-log li').last()).toContainText('要買東西記得先站到櫃檯前面');
  const afterRepeatTalk = await saveGame(page);
  expect(residentEffects(afterRepeatTalk)).toEqual(residentEffects(afterFirstTalk));

  // The same resident's shop is an actual follow-up interaction; use the south lane to avoid 阿柑 and 榕伯.
  await walk(page, 'ArrowDown', 2);
  await walk(page, 'ArrowRight', 3);
  await walk(page, 'ArrowUp', 2);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('x');
  await expect(page.locator('#shop-panel')).toBeVisible();
  await expect(page.locator('#shop-title')).toHaveText('雜貨店');
  const beforeClose = await page.locator('#hud-clock').innerText();
  await page.keyboard.press('Escape');
  await expect(page.locator('#shop-panel')).toBeHidden();
  await expect(page.locator('#hud-clock')).toHaveText(beforeClose);

  // Reload the saved encounter; the talk and shop actions have not duplicated any saved effect.
  await page.reload();
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('village');
  const afterReload = await readSave(page);
  expect(residentEffects(afterReload)).toEqual(residentEffects(afterRepeatTalk));

  // Move one tile out of reach: the refusal must not mutate the resident or economy state.
  await walk(page, 'ArrowDown', 1);
  const beforeBlocked = await saveGame(page);
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('這裡沒有可以互動的東西');
  const afterBlocked = await saveGame(page);
  expect(residentEffects(afterBlocked)).toEqual(residentEffects(beforeBlocked));

  await page.reload();
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('village');
  const afterBlockedReload = await readSave(page);
  expect(residentEffects(afterBlockedReload)).toEqual(residentEffects(afterRepeatTalk));
  expect(afterBlockedReload.state.flags['talked:a-gan']).toBe(true);
  expect(afterBlockedReload.state.friendship['a-gan']?.points).toBe(10);
});
