import { expect, test, type Page } from '@playwright/test';

const LAKE_ATLAS_KEY = 'p6-061-lake-shore-atlas';
const LAKE_ASSET_PATH = '/docs/art/candidates/pixel-movement/p6-lake-shore/';
const PIXEL32_QUERY = 'renderProfile=pixel32&gate1Runtime=pixel32-map-animation';
const LAKE_QUERY = 'gate1LakeVisual=p6-061';

interface Sprite {
  key: string;
  frame: string | null;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface SaveState {
  mapId: string;
  player: { x: number; y: number; facing: string };
  fishing: unknown;
  rng: number;
}

async function writeLakeSave(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
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
          calendar: { year: 1, season: 'spring', day: 4, minuteOfDay: 600 },
          weather: 'sunny', forecast: 'sunny',
          energy: { current: 100, max: 100 }, gold: 600,
          mapId: 'lake', player: { x: 1, y: 7, facing: 'up' },
          plots: {}, inventory: { capacity: 24, stacks: [] }, shipBox: { entries: [] },
          flags: {}, rng: 2_654_435_761, tool: 'rod',
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
  }));
}

async function waitForMap(page: Page, expected: string): Promise<void> {
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe(expected);
}

async function sprites(page: Page): Promise<Sprite[]> {
  return page.evaluate(() => window.__dewhollow?.sprites() ?? []) as Promise<Sprite[]>;
}

async function state(page: Page): Promise<SaveState> {
  return page.evaluate(() => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('missing game debug interface');
    const game = debug.gameState();
    return { mapId: game.mapId, player: game.player, fishing: game.fishing, rng: game.rng };
  });
}

test('lake candidate resources are requested only behind the exact DEV pixel32 gates', async ({ page }) => {
  const candidateRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/p6-lake-shore/')) candidateRequests.push(new URL(request.url()).pathname);
  });
  await page.goto('/');
  await writeLakeSave(page);

  await page.goto('/?gate1LakeVisual=p6-061');
  await waitForMap(page, 'lake');
  expect(candidateRequests).toEqual([]);
  expect((await sprites(page)).some(({ key }) => key === LAKE_ATLAS_KEY)).toBe(false);

  await page.goto(`/?renderProfile=pixel32&gate1LakeVisual=p6-061`);
  await waitForMap(page, 'lake');
  expect(candidateRequests).toEqual([]); // pixel32 runtime query is also required.

  await page.goto(`/?${PIXEL32_QUERY}&gate1LakeVisual=p6-061x`);
  await waitForMap(page, 'lake');
  expect(candidateRequests).toEqual([]);

  await page.goto(`/?${PIXEL32_QUERY}&${LAKE_QUERY}`);
  await waitForMap(page, 'lake');
  await expect.poll(() => candidateRequests.length).toBe(2);
  expect(candidateRequests.sort()).toEqual([
    `${LAKE_ASSET_PATH}atlas.png`,
    `${LAKE_ASSET_PATH}manifest.json`,
  ]);
  expect((await sprites(page)).some(({ key }) => key === LAKE_ATLAS_KEY)).toBe(true);
});

test('lake shore frames fit phone and desktop viewports without changing map or fishing state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await writeLakeSave(page);
  await page.goto(`/?${PIXEL32_QUERY}&${LAKE_QUERY}`);
  await waitForMap(page, 'lake');

  const initial = await state(page);
  expect(initial).toMatchObject({
    mapId: 'lake',
    player: { x: 1, y: 7, facing: 'up' },
    fishing: null,
    rng: 2_654_435_761,
  });

  const expectedFrames = ['shore-south', 'shore-west', 'fishing-ripple'];
  const assertCandidateInViewport = async (): Promise<void> => {
    const mapSprites = await sprites(page);
    const candidateSprites = mapSprites.filter(({ key }) => key === LAKE_ATLAS_KEY);
    expect(candidateSprites.map(({ frame }) => frame)).toEqual(expect.arrayContaining(expectedFrames));
    expect(candidateSprites.every(({ width, height }) => width === 64 && height === 64)).toBe(true);

    const view = await page.evaluate(() => {
      const debug = window.__dewhollow;
      if (!debug) throw new Error('missing game debug interface');
      return {
        scroll: debug.cameraScroll(),
        camera: debug.cameraView(),
        viewport: debug.pixelViewport(),
      };
    });
    const cameraRight = view.scroll.x + view.camera.width;
    const cameraBottom = view.scroll.y + view.camera.height;
    expect(candidateSprites.some(({ left, top, width, height }) =>
      left < cameraRight && left + width > view.scroll.x
      && top < cameraBottom && top + height > view.scroll.y,
    )).toBe(true);
    expect(view.viewport.profile).toBe('pixel32');
    expect(view.viewport.actualWorldTilesVisible.width).toBeCloseTo(view.viewport.worldTilesVisible.width, 1);
    expect(view.viewport.actualWorldTilesVisible.height).toBeCloseTo(view.viewport.worldTilesVisible.height, 1);
    const canvas = await page.locator('#game canvas').boundingBox();
    expect(canvas).not.toBeNull();
    expect(canvas!.width).toBeGreaterThan(0);
    expect(canvas!.height).toBeGreaterThan(0);
  };

  await assertCandidateInViewport();
  expect(await state(page)).toEqual(initial); // Rendering is presentation-only.

  await page.keyboard.press('x');
  await expect(page.locator('#hud-log li').last()).toContainText('魚上鉤了');
  expect((await state(page)).fishing).not.toBeNull();
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('釣到了');
  expect((await state(page)).fishing).toBeNull();

  await page.setViewportSize({ width: 1280, height: 720 });
  await assertCandidateInViewport();

  // Crossing to forest rebuilds the map tile layer and cannot leave lake-atlas tiles behind.
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('forest');
  expect((await sprites(page)).some(({ key }) => key === LAKE_ATLAS_KEY)).toBe(false);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('lake');
  await expect.poll(async () => (await sprites(page)).some(({ key }) => key === LAKE_ATLAS_KEY)).toBe(true);
});
