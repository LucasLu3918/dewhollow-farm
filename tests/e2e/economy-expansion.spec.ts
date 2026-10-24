import { expect, test, type Page } from '@playwright/test';

/**
 * 羊與布、小屋擴建（M6 之後的經濟擴充，存檔 v21）。路線（農場出生點 (7,9)）：
 * - 小屋的門在農場 (2,4)，從 (2,5) 往上進門，落在小屋 (4,5)。
 * - 牧草地：往右到 (38,9)、往下到 (38,13)，往右進牧草地的門 (39,13)，落在 (1,7)（春 15 天起開放）。
 * - 羊圈在牧草地：乾草槽 (5,12)，座位 (3,11)、(5,11)、(7,11)。
 * 這個檔案尚未在這次工作中執行（會與其他 worktree 搶 5173 port）；路線與格子依內容檔推算。
 */
interface Actor {
  id: string;
  busy: boolean;
  tileX: number;
  tileY: number;
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
        const player = actors.find((actor) => actor.id === 'player');
        const currentMap = await mapId(page);
        return Boolean(player && (currentMap !== before.map || player.tileX !== before.x || player.tileY !== before.y));
      })
      .toBe(true);
    await expect
      .poll(async () => {
        const movement = await page.evaluate(() => window.__dewhollow?.movement());
        return movement && movement.heldDirection === null && !movement.moving && !movement.pending && movement.queuedTaps === 0;
      })
      .toBe(true);
    await expect
      .poll(async () => {
        const actors = (await page.evaluate(() => window.__dewhollow?.actors() ?? [])) as Actor[];
        return actors.find((actor) => actor.id === 'player')?.busy ?? true;
      })
      .toBe(false);
  }
}

/** 直接寫入遊戲使用的 IndexedDB（與 pasture.spec.ts 相同的做法；舊版存檔由遷移補齊欄位）。 */
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

/** 春 15 天、牧草地開放、羊圈有一隻羊（羊毛已經長好、還沒摸過）、背包有兩包乾草。 */
const DAY_FIFTEEN_WITH_SHEEP = {
  slot: 'slot-1',
  savedAt: '2026-10-22T10:00:00.000Z',
  state: {
    schemaVersion: 13,
    calendar: { year: 1, season: 'spring', day: 15, minuteOfDay: 360 },
    weather: 'sunny',
    forecast: 'sunny',
    energy: { current: 100, max: 100 },
    gold: 600,
    mapId: 'farm',
    player: { x: 7, y: 9, facing: 'down' },
    plots: {},
    inventory: { capacity: 24, stacks: [{ itemId: 'hay', quality: 'normal', count: 2 }] },
    shipBox: { entries: [] },
    flags: {},
    rng: 12345,
    tool: 'hoe',
    toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 },
    worldChanges: {},
    skills: { farming: 0, foraging: 0, fishing: 0, mining: 0, cooking: 0 },
    talents: {},
    animals: [],
    cows: [],
    sheep: [{ kind: 'sheep', fed: false, petted: false, milked: false, mood: 5, woolDays: 3 }],
    processing: [],
    fishing: null,
    mineSeed: 1,
    mineCheckpoint: 1,
    selectedSeed: 'moon-bean',
    playtimeSeconds: 0,
  },
};

/** 第一次擴建（東側一間房）已經買了：農場的小屋門落到新的格局。 */
const WING_BOUGHT = {
  slot: 'slot-1',
  savedAt: '2026-10-22T10:00:00.000Z',
  state: {
    schemaVersion: 13,
    calendar: { year: 1, season: 'spring', day: 20, minuteOfDay: 360 },
    weather: 'sunny',
    forecast: 'sunny',
    energy: { current: 100, max: 100 },
    gold: 100,
    mapId: 'farm',
    player: { x: 3, y: 5, facing: 'left' },
    plots: {},
    inventory: { capacity: 24, stacks: [] },
    shipBox: { entries: [] },
    flags: { 'house-wing': true },
    rng: 12345,
    tool: 'hoe',
    toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 },
    worldChanges: {},
    skills: { farming: 0, foraging: 0, fishing: 0, mining: 0, cooking: 0 },
    talents: {},
    animals: [],
    cows: [],
    processing: [],
    fishing: null,
    mineSeed: 1,
    mineCheckpoint: 1,
    selectedSeed: 'moon-bean',
    playtimeSeconds: 0,
  },
};

test('a sheep in the pasture pen is fed at the trough, then petted, then sheared once its wool is ready', async ({ page }) => {
  await waitForGame(page);
  await putRecord(page, DAY_FIFTEEN_WITH_SHEEP);
  await page.reload();
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');

  // 農場 → 牧草地（落在 (1,7)）。
  await walk(page, 'ArrowRight', 31);
  await walk(page, 'ArrowDown', 4);
  await walk(page, 'ArrowRight', 1);
  await expect.poll(() => mapId(page)).toBe('pasture');

  // 乾草槽：從 (1,7) 往下走到 (1,12)，再往右走到 (4,12) 面向槽 (5,12)，餵一次。
  await walk(page, 'ArrowDown', 5);
  await walk(page, 'ArrowRight', 3);
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('餵了羊');

  // 座位 (3,11)：從 (3,9) 往下走到 (3,10) 面向座位。第一次摸羊，第二次剪毛（羊毛已經長好）。
  await walk(page, 'ArrowUp', 2);
  await walk(page, 'ArrowLeft', 1);
  await walk(page, 'ArrowUp', 1);
  await walk(page, 'ArrowDown', 1);
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('摸了摸羊');
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('剪下了羊的羊毛');
});

test('after the east room is bought, the farm door to the house leads into the east-room layout', async ({ page }) => {
  await waitForGame(page);
  await putRecord(page, WING_BOUGHT);
  await page.reload();
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');

  // 農場的小屋門在 (2,4)：站在 (3,5) 往左到 (2,5)，再往上進門。
  await walk(page, 'ArrowLeft', 1);
  await walk(page, 'ArrowUp', 1);
  await expect.poll(() => mapId(page)).toBe('house-wing');
});
