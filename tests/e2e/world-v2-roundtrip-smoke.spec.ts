import { expect, test, type BrowserContext, type Page, type TestInfo, type Video } from '@playwright/test';

type PlayerState = { x: number; y: number; facing: string };
type SmokeState = {
  mapId: string;
  player: PlayerState;
  calendar: { year: number; season: string; day: number; minuteOfDay: number };
  gold: number;
};
type GameDebug = {
  mapId(): string;
  gameState(): SmokeState;
  actors(): Array<{ id: string; busy: boolean; tileX: number; tileY: number }>;
  movement(): { moving: boolean; pending: boolean; queuedTaps: number; heldDirection: string | null };
  worldV2SceneCandidate(): {
    enabled: boolean;
    mapId: string;
    frames: string[];
    placements: Array<{ frame: string; x: number; y: number; depth: number }>;
  };
};


async function waitForMap(page: Page, expected: 'farm' | 'house'): Promise<void> {
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: GameDebug }).__dewhollow?.mapId() ?? '')).toBe(expected);
}

async function expectWorldV2Candidate(page: Page, expected: 'farm' | 'house'): Promise<void> {
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: GameDebug }).__dewhollow?.worldV2SceneCandidate().enabled ?? false)).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: GameDebug }).__dewhollow?.worldV2SceneCandidate().mapId ?? '')).toBe(expected);
  const candidate = await page.evaluate(() => (window as unknown as { __dewhollow?: GameDebug }).__dewhollow!.worldV2SceneCandidate());
  if (expected === 'farm') {
    expect(candidate.frames).toContain('gate1-world-v2-farm-atlas:tree-canopy');
    expect(candidate.frames).not.toContain('gate1-world-v2-house-atlas:rug');
    expect(candidate.placements.map(({ frame }) => frame)).toContain('tree-canopy');
  } else {
    expect(candidate.frames).toContain('gate1-world-v2-house-atlas:bed');
    expect(candidate.frames).toContain('gate1-world-v2-house-atlas:workbench');
    expect(candidate.placements.map(({ frame }) => frame)).toContain('bed');
    expect(candidate.placements.map(({ frame }) => frame)).toContain('workbench');
  }
}

async function waitForMovementIdle(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const movement = (window as unknown as { __dewhollow?: GameDebug }).__dewhollow?.movement();
    const player = (window as unknown as { __dewhollow?: GameDebug }).__dewhollow?.actors().find((actor) => actor.id === 'player');
    return Boolean(movement && player
      && !movement.moving && !movement.pending && movement.queuedTaps === 0
      && movement.heldDirection === null && !player.busy);
  })).toBe(true);
}

async function move(page: Page, key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'): Promise<void> {
  await page.keyboard.press(key);
  await waitForMovementIdle(page);
}

async function walk(page: Page, key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight', steps: number): Promise<void> {
  for (let step = 0; step < steps; step += 1) await move(page, key);
}

async function enterHouseFromSpawn(page: Page): Promise<void> {
  // Farm spawn (7,9) → outside the farmhouse door (2,5) → house entrance (10,18).
  await walk(page, 'ArrowUp', 4);
  await walk(page, 'ArrowLeft', 5);
  await move(page, 'ArrowUp');
  await waitForMap(page, 'house');
  await expect.poll(() => page.evaluate(() => {
    const player = (window as unknown as { __dewhollow?: GameDebug }).__dewhollow?.gameState().player;
    return player && { x: player.x, y: player.y };
  })).toEqual({ x: 10, y: 18 });
  await expectWorldV2Candidate(page, 'house');
}

async function leaveHouse(page: Page): Promise<void> {
  await move(page, 'ArrowDown');
  await waitForMap(page, 'farm');
  await expect.poll(() => page.evaluate(() => {
    const player = (window as unknown as { __dewhollow?: GameDebug }).__dewhollow?.gameState().player;
    return player && { x: player.x, y: player.y };
  })).toEqual({ x: 2, y: 5 });
  await expectWorldV2Candidate(page, 'farm');
}

async function useWorkbench(page: Page): Promise<void> {
  // Existing house route: go around the bench, then face it from (4,16).
  await walk(page, 'ArrowUp', 9);
  await walk(page, 'ArrowLeft', 7);
  await walk(page, 'ArrowDown', 7);
  await move(page, 'ArrowRight');
  await move(page, 'ArrowUp');
  await page.keyboard.press('x');
  await expect(page.locator('#workbench-panel')).toBeVisible();
  await expect(page.locator('#workbench-list')).toContainText('灑水器');
  await page.keyboard.press('Escape');
  await expect(page.locator('#workbench-panel')).toBeHidden();

  // Return to the house entrance so the following route is deterministic.
  await move(page, 'ArrowLeft');
  await walk(page, 'ArrowUp', 7);
  await walk(page, 'ArrowRight', 7);
  await walk(page, 'ArrowDown', 9);
}

async function sleepOnce(page: Page): Promise<void> {
  // House spawn (10,18) → bed south tile (4,8), facing the bed.
  await walk(page, 'ArrowUp', 9);
  await walk(page, 'ArrowLeft', 6);
  await move(page, 'ArrowUp');
  const dayBefore = await page.evaluate(() => (window as unknown as { __dewhollow?: GameDebug }).__dewhollow!.gameState().calendar.day);
  await page.keyboard.press('x');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: GameDebug }).__dewhollow?.gameState().calendar.day ?? 0)).toBe(dayBefore + 1);
}

async function saveAndReload(page: Page): Promise<void> {
  await page.keyboard.press('s');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  const beforeReload = await page.evaluate(() => (window as unknown as { __dewhollow?: GameDebug }).__dewhollow!.gameState());
  expect(beforeReload.mapId).toBe('house');
  await page.reload();
  await expect(page.locator('#game canvas')).toBeVisible();
  await waitForMap(page, 'house');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: GameDebug }).__dewhollow!.gameState())).toMatchObject({
    mapId: beforeReload.mapId,
    player: beforeReload.player,
    calendar: beforeReload.calendar,
    gold: beforeReload.gold,
  });
}

async function backToHouseEntrance(page: Page): Promise<void> {
  // The bed route ends at (4,8); return through the open center aisle to (10,18).
  await walk(page, 'ArrowRight', 6);
  await walk(page, 'ArrowDown', 10);
}

test('P3-034 completes ten house/farm round trips with interaction, sleep, save and reload', async ({ browser }, testInfo: TestInfo) => {
  test.setTimeout(180_000);
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: testInfo.outputPath('recording'), size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  const video: Video | null = page.video();
  const transitions: string[] = [];

  try {
    await page.goto('/?renderProfile=pixel32&gate1Runtime=pixel32-map-animation&gate1SceneVisual=world-v2-cozy');
    await expect(page.locator('#game canvas')).toBeVisible();
    await waitForMap(page, 'farm');
    await expectWorldV2Candidate(page, 'farm');
    await page.screenshot({ path: testInfo.outputPath('farm.png'), animations: 'disabled' });

    for (let trip = 0; trip < 10; trip += 1) {
      if (trip === 0) await enterHouseFromSpawn(page);
      else {
        await move(page, 'ArrowUp');
        await waitForMap(page, 'house');
      }
      transitions.push(`farm-to-house-${trip + 1}`);

      if (trip === 0) {
        await page.screenshot({ path: testInfo.outputPath('house.png'), animations: 'disabled' });
        await useWorkbench(page);
        await sleepOnce(page);
        await saveAndReload(page);
        await backToHouseEntrance(page);
      } else {
        // Confirm actual movement in the house on every round without leaving the entrance aisle.
        await move(page, 'ArrowUp');
        await move(page, 'ArrowDown');
      }

      await leaveHouse(page);
      transitions.push(`house-to-farm-${trip + 1}`);
      expect(transitions).toHaveLength((trip + 1) * 2);
    }

    expect(transitions).toEqual(Array.from({ length: 10 }, (_, index) => [
      `farm-to-house-${index + 1}`,
      `house-to-farm-${index + 1}`,
    ]).flat());
    await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: GameDebug }).__dewhollow?.mapId() ?? '')).toBe('farm');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: GameDebug }).__dewhollow?.gameState().calendar.day ?? 0)).toBe(2);
    await page.screenshot({ path: testInfo.outputPath('farm-after-roundtrips.png'), animations: 'disabled' });
  } finally {
    await context.close();
    if (video) await video.saveAs(testInfo.outputPath('ten-roundtrips.webm'));
  }

  await testInfo.attach('farm.png', { path: testInfo.outputPath('farm.png'), contentType: 'image/png' });
  await testInfo.attach('house.png', { path: testInfo.outputPath('house.png'), contentType: 'image/png' });
  await testInfo.attach('farm-after-roundtrips.png', { path: testInfo.outputPath('farm-after-roundtrips.png'), contentType: 'image/png' });
  await testInfo.attach('ten-roundtrips.webm', { path: testInfo.outputPath('ten-roundtrips.webm'), contentType: 'video/webm' });
});
