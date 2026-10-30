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

interface MovementSnapshot {
  mapId: string;
  tile: { x: number; y: number };
  facing: string;
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
      const actors = (await page.evaluate(() => window.__dewhollow?.actors() ?? [])) as Actor[];
      return actors.find((a) => a.id === 'player')?.busy ?? true;
    })
    .toBe(false);
}

/** 從新版中央出生點繞過出貨箱，走到新版農田西側，再面向 (12,24) 的田格。 */
async function walkToFarmField(page: Page): Promise<void> {
  for (const [key, count] of [['ArrowDown', 10], ['ArrowLeft', 9]] as const) {
    await press(page, key, count);
  }
}

async function walkFromFieldToBed(page: Page): Promise<void> {
  // Farm field → central road → house portal → tile south of the bed (4,8).
  for (const [key, count] of [['ArrowRight', 9], ['ArrowUp', 10], ['ArrowRight', 7], ['ArrowUp', 5], ['ArrowUp', 9], ['ArrowLeft', 6], ['ArrowUp', 1]] as const) {
    await press(page, key, count);
  }
}

async function walkFromBedToField(page: Page): Promise<void> {
  // Bed approach (4,8) → house door → farm spawn (27,10) → field gate → field edge (11,24).
  for (const [key, count] of [['ArrowRight', 6], ['ArrowDown', 11], ['ArrowLeft', 7], ['ArrowDown', 14], ['ArrowLeft', 9]] as const) {
    await press(page, key, count);
  }
}

test('each ground makes its own footprint: grass, tilled field, then the stone path', async ({ page }) => {
  await waitForGame(page);
  // 從出貨箱西側走到草地 (13,24)，再踩進田格並回到路面。
  for (const [key, count] of [['ArrowDown', 12], ['ArrowLeft', 1], ['ArrowDown', 2], ['ArrowLeft', 6], ['ArrowUp', 4], ['ArrowLeft', 1], ['ArrowLeft', 3], ['ArrowUp', 1]] as const) {
    await press(page, key, count);
    await settle(page);
  }
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
  test.setTimeout(180_000);
  await waitForGame(page);
  // 開墾 (12,24)、播下月光豆（生長 2 天）、澆水；作物每天都要澆，否則會枯死。
  await walkToFarmField(page);
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
  await walkFromFieldToBed(page);
  await settle(page);
  await press(page, 'x'); // 睡覺
  await settle(page);
  await walkFromBedToField(page);
  await settle(page);
  await press(page, 'x'); // 澆水
  await settle(page);

  await walkFromFieldToBed(page);
  await settle(page);
  await press(page, 'x'); // 睡覺
  await settle(page);
  await walkFromBedToField(page);
  await settle(page);
  await press(page, 'x'); // 收成
  await settle(page);

  const names = await effectNames(page);
  expect(names).toContain('pickup:moon-bean');
  await expect(page.locator('#hud-log')).toContainText('收成了 月光豆');
});

test('the tool makes its sound when it lands, after the swing starts', async ({ page }) => {
  await waitForGame(page);
  await walkToFarmField(page);
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
