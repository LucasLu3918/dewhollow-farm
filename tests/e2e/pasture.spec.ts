import { expect, test, type Page } from '@playwright/test';

/**
 * M4c：牧草地與牛舍。路線（農場出生點 (7,9)）：
 * 往右到 (38,9)、往下到 (38,13)，往右進牧草地的門 (39,13)，落在牧草地 (1,7)。
 * 牧草地的牛舍門在 (15,4)（要先改建），從 (15,5) 往上進，落在牛舍 (2,3)。
 * 牛舍的乾草槽在 (3,2)，座位在 (1,1) 與 (4,1)。
 */
interface Actor {
  id: string;
  tileX: number;
  tileY: number;
  busy: boolean;
}

async function waitForGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

async function mapId(page: Page): Promise<string> {
  return page.evaluate(() => window.__dewhollow?.mapId() ?? '');
}

async function walk(page: Page, key: string, steps: number): Promise<void> {
  for (let i = 0; i < steps; i += 1) {
    const before = await page.evaluate(() => {
      const player = window.__dewhollow?.actors().find((actor) => actor.id === 'player');
      return { map: window.__dewhollow?.mapId() ?? '', x: player?.tileX ?? -1, y: player?.tileY ?? -1 };
    });
    await page.keyboard.press(key);
    await expect
      .poll(async () => {
        const actors = (await page.evaluate(() => window.__dewhollow?.actors() ?? [])) as Actor[];
        const player = actors.find((a) => a.id === 'player');
        const currentMap = await mapId(page);
        return Boolean(player && (currentMap !== before.map || player.tileX !== before.x || player.tileY !== before.y));
      }, { timeout: 15_000 })
      .toBe(true);
    await expect
      .poll(async () => {
        const actors = (await page.evaluate(() => window.__dewhollow?.actors() ?? [])) as Actor[];
        return actors.find((a) => a.id === 'player')?.busy ?? true;
      }, { timeout: 15_000 })
      .toBe(false);
  }
}

async function faceBlockedTile(page: Page, key: string): Promise<void> {
  const before = await page.evaluate(() => {
    const player = window.__dewhollow?.actors().find((actor) => actor.id === 'player');
    return { x: player?.tileX ?? -1, y: player?.tileY ?? -1 };
  });
  await page.keyboard.press(key);
  await expect
    .poll(async () => {
      const player = (await page.evaluate(() => window.__dewhollow?.actors() ?? [])) as Actor[];
      return player.find((actor) => actor.id === 'player')?.busy ?? true;
    }, { timeout: 15_000 })
    .toBe(false);
  await expect.poll(async () => page.evaluate(() => {
    const player = window.__dewhollow?.actors().find((actor) => actor.id === 'player');
    return { x: player?.tileX ?? -1, y: player?.tileY ?? -1 };
  }), { timeout: 15_000 }).toEqual(before);
}

/** 直接寫入遊戲使用的 IndexedDB（與 save-migration.spec.ts 相同的做法）。 */
async function putRecord(page: Page, record: unknown): Promise<void> {
  await page.evaluate(
    (value) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('dewhollow-farm');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('saves', 'readwrite');
          tx.objectStore('saves').put(value);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    record,
  );
}

/** 春 15 天、牛舍已改建、一頭還沒餵的牛、背包有三包乾草。 */
const DAY_FIFTEEN_WITH_COW = {
  slot: 'slot-1',
  savedAt: '2026-10-22T10:00:00.000Z',
  state: {
    schemaVersion: 13,
    calendar: { year: 1, season: 'spring', day: 15, minuteOfDay: 360 },
    weather: 'sunny',
    forecast: 'sunny',
    energy: { current: 100, max: 100 },
    gold: 6000,
    mapId: 'farm',
    player: { x: 7, y: 9, facing: 'down' },
    plots: {},
    inventory: { capacity: 24, stacks: [{ itemId: 'hay', quality: 'normal', count: 3 }] },
    shipBox: { entries: [] },
    flags: { cowbarn: true },
    rng: 12345,
    tool: 'hoe',
    toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 },
    worldChanges: {},
    skills: { farming: 0, foraging: 0, fishing: 0, mining: 0, cooking: 0 },
    talents: {},
    animals: [],
    cows: [{ kind: 'cow', fed: false, petted: false, milked: false, mood: 5 }],
    processing: [],
    fishing: null,
    mineSeed: 1,
    mineCheckpoint: 1,
    selectedSeed: 'moon-bean',
    playtimeSeconds: 0,
  },
};

test('the pasture gate is shut before spring day 15, and says when it opens', async ({ page }) => {
  test.setTimeout(120_000);
  await waitForGame(page);
  await walk(page, 'ArrowRight', 31);
  await walk(page, 'ArrowDown', 4);
  await faceBlockedTile(page, 'ArrowRight');
  await expect(page.locator('#hud-log')).toContainText('春 15 天起才開放');
  expect(await mapId(page)).toBe('farm');
});

test('on spring day 15 the gate opens, and a cow in the remodeled barn is fed, petted, then milked', async ({ page }) => {
  test.setTimeout(120_000);
  await waitForGame(page);
  await putRecord(page, DAY_FIFTEEN_WITH_COW);

  await page.reload();
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 15 天');

  // 農場 → 牧草地（落在 (1,7)）。
  await walk(page, 'ArrowRight', 31);
  await walk(page, 'ArrowDown', 4);
  await walk(page, 'ArrowRight', 1);
  await expect.poll(() => mapId(page)).toBe('pasture');

  // 牧草地 → 牛舍（從 (15,5) 往上進門 (15,4)，落在 (2,3)）。
  await walk(page, 'ArrowRight', 14);
  await walk(page, 'ArrowUp', 3);
  await expect.poll(() => mapId(page)).toBe('cowbarn');

  // 乾草槽：站在 (2,2) 面向右邊的槽 (3,2)，餵一次（一包乾草餵全部的牛）。
  await walk(page, 'ArrowUp', 1);
  await faceBlockedTile(page, 'ArrowRight');
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('餵了牛');

  // 座位 (1,1)：從 (1,3) 往上走到 (1,2) 面向座位。第一次摸牛，第二次擠奶。
  await walk(page, 'ArrowDown', 1);
  await walk(page, 'ArrowLeft', 1);
  await walk(page, 'ArrowUp', 1);
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('摸了摸牛');
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('擠了牛的奶，得到牛奶');
  await expect(page.locator('#hud-gold')).toHaveText('6000 金');
});
