import { expect, test, type Page, type TestInfo } from '@playwright/test';

interface Actor {
  id: string;
  tileX: number;
  tileY: number;
  busy: boolean;
}

interface SavedGame {
  slot: string;
  savedAt: string;
  state: {
    calendar: { year: number; season: string; day: number; minuteOfDay: number };
    gold: number;
    quests: Record<string, { status: string; progress: number; seen: string[] }>;
    mapId: string;
    achievements: { unlocked: string[] };
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

async function saveGame(page: Page): Promise<SavedGame> {
  await page.keyboard.press('s');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  return readSave(page);
}

async function readSave(page: Page): Promise<SavedGame> {
  return page.evaluate(() => new Promise<SavedGame>((resolve, reject) => {
    const request = indexedDB.open('dewhollow-farm');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('saves').objectStore('saves').get('slot-1');
      get.onsuccess = () => { db.close(); resolve(get.result as SavedGame); };
      get.onerror = () => { db.close(); reject(get.error); };
    };
  }));
}

async function sleepAtHome(page: Page, firstNight: boolean, expectedDay: number): Promise<void> {
  if (firstNight) {
    // Farm spawn (20,14) → main path → house door H at (27,9).
    await walk(page, 'ArrowUp', 4);
    await walk(page, 'ArrowRight', 7);
    await walk(page, 'ArrowUp', 1);
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('house');

    // House spawn (10,18) → stand below the bed at (4,7), facing north.
    await walk(page, 'ArrowUp', 9);
    await walk(page, 'ArrowLeft', 6);
    await walk(page, 'ArrowUp', 1);
    await expect.poll(async () => {
      const player = await actor(page, 'player');
      return { x: player.tileX, y: player.tileY, busy: player.busy };
    }).toEqual({ x: 4, y: 8, busy: false });
  }

  await page.keyboard.press('x');
  await expect(page.locator('#hud-day')).toHaveText(`第 1 年 春 第 ${expectedDay} 天`);
}

async function captureCompletion(page: Page, testInfo: TestInfo): Promise<void> {
  // Keep a visual artifact of the rendered success state alongside the browser trace.
  await page.screenshot({ path: testInfo.outputPath('daily-forest-complete.png') });
}

test('accepting and completing the day-four forest bulletin is visible and saved', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await waitForGame(page);
  expect(await actor(page, 'player')).toMatchObject({ tileX: 20, tileY: 14 });

  // The clean game's date-seeded board includes daily-forest on spring day 4.
  await sleepAtHome(page, true, 2);
  await sleepAtHome(page, false, 3);
  await sleepAtHome(page, false, 4);

  await page.keyboard.press('j');
  await expect(page.locator('#quest-panel')).toBeVisible();
  const forestQuest = page.locator('#quest-list li').filter({ hasText: '森林入口巡視' });
  await expect(forestQuest).toContainText('可接取');
  await forestQuest.getByRole('button', { name: '接取' }).click();
  await expect(forestQuest).toContainText('進行中');
  await expect(forestQuest.getByRole('button')).toHaveCount(0);
  await page.keyboard.press('Escape');

  const accepted = await saveGame(page);
  expect(accepted.state.calendar).toMatchObject({ year: 1, season: 'spring', day: 4 });
  expect(accepted.state.quests['daily-forest']).toMatchObject({ status: 'active' });

  // Leave the house through the south door to farm spawn (27,10), then use the north forest gate.
  await walk(page, 'ArrowRight', 6);
  await walk(page, 'ArrowDown', 1);
  await walk(page, 'ArrowDown', 9);
  await walk(page, 'ArrowDown', 1);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await walk(page, 'ArrowLeft', 7);
  await walk(page, 'ArrowUp', 10);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('forest');
  await expect(page.locator('#hud-log')).toContainText('委託完成：森林入口巡視');
  await expect(page.locator('#hud-log')).toContainText('成就達成：第一件委託');

  const completed = await saveGame(page);
  expect(completed.state.mapId).toBe('forest');
  expect(completed.state.quests['daily-forest']).toMatchObject({ status: 'done' });
  expect(completed.state.gold).toBe(accepted.state.gold + 140); // 90 quest gold + 50 first-quest achievement.
  expect(completed.state.achievements.unlocked).toContain('first-quest');
  await captureCompletion(page, testInfo);

  await page.reload();
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('forest');
  const reloaded = await readSave(page);
  expect(reloaded.state.quests['daily-forest']).toMatchObject({ status: 'done' });
  expect(reloaded.state.gold).toBe(accepted.state.gold + 140);
  expect(reloaded.state.achievements.unlocked).toContain('first-quest');
});
