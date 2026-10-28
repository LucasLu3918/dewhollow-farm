import { expect, test, type Page } from '@playwright/test';

const TOWN_ATLAS_KEY = 'p6-060-town-atlas';
const TOWN_ASSET_PATH = '/docs/art/candidates/pixel-movement/p6-village-plaza/';
const PIXEL32_QUERY = 'renderProfile=pixel32&gate1Runtime=pixel32-map-animation';
const TOWN_QUERY = 'gate1TownVisual=p6-060';

interface Sprite {
  key: string;
  frame: string | null;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Actor {
  id: string;
  tileX: number;
  tileY: number;
  busy: boolean;
}

async function writeState(page: Page, mapId: 'village' | 'plaza', player: { x: number; y: number; facing: string }, festival = false): Promise<void> {
  await page.evaluate(({ nextMap, nextPlayer, festivalDay }) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction('saves', 'readwrite');
      transaction.objectStore('saves').put({
        slot: 'slot-1',
        savedAt: '2026-10-28T00:00:00.000Z',
        state: {
          schemaVersion: 13,
          calendar: { year: 1, season: 'spring', day: festivalDay ? 12 : 4, minuteOfDay: 720 },
          weather: 'sunny', forecast: 'sunny',
          energy: { current: 100, max: 100 }, gold: 100,
          mapId: nextMap, player: nextPlayer,
          plots: {}, inventory: { capacity: 24, stacks: [] }, shipBox: { entries: [] },
          flags: {}, rng: 12345, tool: 'hoe',
          toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 },
          worldChanges: {},
          skills: { farming: 0, foraging: 0, fishing: 0, mining: 0, cooking: 0 },
          talents: {}, animals: [], cows: [], sheep: [], processing: [], fishing: null,
          mineSeed: 1, mineCheckpoint: 1, selectedSeed: 'moon-bean', playtimeSeconds: 0,
        },
      });
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  }), { nextMap: mapId, nextPlayer: player, festivalDay: festival });
}

async function waitForMap(page: Page, expected: 'village' | 'plaza'): Promise<void> {
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe(expected);
}

async function sprites(page: Page): Promise<Sprite[]> {
  return page.evaluate(() => window.__dewhollow?.sprites() ?? []) as Promise<Sprite[]>;
}

async function state(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const current = window.__dewhollow?.gameState();
    if (!current) throw new Error('missing game state');
    return {
      mapId: current.mapId, player: current.player, calendar: current.calendar,
      gold: current.gold, flags: current.flags, inventory: current.inventory,
      worldChanges: current.worldChanges, festival: current.festival,
    };
  });
}

async function player(page: Page): Promise<Actor> {
  const found = (await page.evaluate(() => window.__dewhollow?.actors() ?? []))
    .find((actor) => actor.id === 'player') as Actor | undefined;
  if (!found) throw new Error('missing player actor');
  return found;
}

async function walk(page: Page, key: string): Promise<void> {
  const before = await player(page);
  await page.keyboard.press(key);
  await page.waitForFunction(({ x, y }) => {
    const actor = window.__dewhollow?.actors().find((candidate) => candidate.id === 'player');
    return actor && (actor.tileX !== x || actor.tileY !== y) && !actor.busy;
  }, { x: before.tileX, y: before.tileY });
}

async function waitForCandidateFrames(page: Page, expected: readonly string[]): Promise<void> {
  await expect.poll(async () => {
    const candidateSprites = (await sprites(page)).filter(({ key }) => key === TOWN_ATLAS_KEY);
    const frames = candidateSprites.map((sprite) => sprite.frame);
    return expected.filter((frame) => !frames.includes(frame));
  }).toEqual([]);
}

test('town candidate assets are fetched only behind the exact DEV pixel32 gates', async ({ page }) => {
  const candidateRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/p6-village-plaza/')) candidateRequests.push(new URL(request.url()).pathname);
  });
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await writeState(page, 'village', { x: 3, y: 5, facing: 'up' });

  await page.goto(`/?${TOWN_QUERY}`);
  await waitForMap(page, 'village');
  expect(candidateRequests).toEqual([]);
  expect((await sprites(page)).some(({ key }) => key === TOWN_ATLAS_KEY)).toBe(false);

  await page.goto(`/?renderProfile=pixel32&${TOWN_QUERY}`);
  await waitForMap(page, 'village');
  expect(candidateRequests).toEqual([]);

  await page.goto(`/?${PIXEL32_QUERY}&gate1TownVisual=p6-060x`);
  await waitForMap(page, 'village');
  expect(candidateRequests).toEqual([]);

  await page.goto(`/?${PIXEL32_QUERY}&${TOWN_QUERY}`);
  await waitForMap(page, 'village');
  await expect.poll(() => candidateRequests.length).toBe(2);
  expect(candidateRequests.sort()).toEqual([
    `${TOWN_ASSET_PATH}atlas.png`,
    `${TOWN_ASSET_PATH}manifest.json`,
  ]);
  await waitForCandidateFrames(page, ['general-store', 'blacksmith']);
});

test('village and plaza candidate overlays preserve shop, festival, and portal behavior at desktop and mobile sizes', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();

  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await writeState(page, 'village', { x: 3, y: 5, facing: 'up' });
    await page.goto(`/?${PIXEL32_QUERY}&${TOWN_QUERY}`);
    await waitForMap(page, 'village');
    await waitForCandidateFrames(page, ['general-store', 'blacksmith']);
    await waitForCandidateFrames(page, ['grass-base', 'path-stone', 'wall-stone']);
    if (viewport.width === 1280) {
      const screenshot = await page.screenshot({
        path: testInfo.outputPath('village-dev-1280x720.png'),
        animations: 'disabled',
        scale: 'css',
      });
      await testInfo.attach('village-dev-1280x720.png', { body: screenshot, contentType: 'image/png' });
    }

    const beforeShop = await state(page);
    await page.keyboard.press('x');
    await expect(page.locator('#shop-panel')).toBeVisible();
    await expect(page.locator('#shop-title')).toHaveText('雜貨店');
    await page.keyboard.press('Escape');
    await expect(page.locator('#shop-panel')).toBeHidden();
    expect(await state(page)).toEqual(beforeShop);

    await writeState(page, 'plaza', { x: 1, y: 9, facing: 'up' }, true);
    await page.reload();
    await waitForMap(page, 'plaza');
    await waitForCandidateFrames(page, [
      'night-market-stall', 'traveling-merchant-cart', 'bulletin-board', 'anvil',
      'lantern', 'festival-pennants', 'well', 'bench', 'market-display-table', 'barrel-and-sack',
      'grass-base', 'plaza-cobble', 'wall-stone',
    ]);
    if (viewport.width === 1280) {
      const screenshot = await page.screenshot({
        path: testInfo.outputPath('plaza-dev-1280x720.png'),
        animations: 'disabled',
        scale: 'css',
      });
      await testInfo.attach('plaza-dev-1280x720.png', { body: screenshot, contentType: 'image/png' });
    }

    const beforeFestival = await state(page);
    await page.keyboard.press('x');
    await expect(page.locator('#festival-panel')).toBeVisible();
    await expect(page.locator('#festival-list')).toContainText('種子交換');
    await page.keyboard.press('Escape');
    expect(await state(page)).toEqual(beforeFestival);

    // Walk around the existing festival-board tile and leave through the plaza's west portal.
    for (const key of ['ArrowRight', 'ArrowRight', 'ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowLeft', 'ArrowUp', 'ArrowLeft']) {
      await walk(page, key);
    }
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('village');
    await waitForCandidateFrames(page, ['general-store', 'blacksmith']);
    expect((await sprites(page)).filter(({ key }) => key === TOWN_ATLAS_KEY).map(({ frame }) => frame))
      .not.toContain('night-market-stall');
    expect((await sprites(page)).filter(({ key }) => key === TOWN_ATLAS_KEY).map(({ frame }) => frame))
      .not.toContain('well');
  }
});
