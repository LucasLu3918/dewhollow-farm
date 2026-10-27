import { expect, test, type Page, type TestInfo } from '@playwright/test';

const nodeProcess = (globalThis as typeof globalThis & {
  process?: { cwd(): string; env?: Record<string, string | undefined> };
}).process;
const evidenceEnabled = nodeProcess?.env?.SAVE_VF11_SCENE_EVIDENCE === '1';
const baselineMode = nodeProcess?.env?.VF11_CAPTURE_BASELINE === '1';

interface SaveOverrides {
  mapId: string;
  player: { x: number; y: number; facing: string };
}

async function putRecord(page: Page, state: SaveOverrides): Promise<void> {
  await page.evaluate((saved) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const request = open.result.transaction('saves', 'readwrite')!.objectStore('saves').put({
        slot: 'slot-1', savedAt: '2026-10-26T00:00:00.000Z',
        state: {
          schemaVersion: 13,
          calendar: { year: 1, season: 'spring', day: 4, minuteOfDay: 600 },
          weather: 'sunny', forecast: 'sunny', energy: { current: 100, max: 100 }, gold: 600,
          mapId: saved.mapId, player: saved.player,
          plots: {}, inventory: { capacity: 24, stacks: [] }, shipBox: { entries: [] }, flags: {}, rng: 12345,
          tool: 'hoe', toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 },
          worldChanges: {}, skills: { farming: 0, foraging: 0, fishing: 0, mining: 0, cooking: 0 },
          talents: {}, animals: [], cows: [], sheep: [], processing: [], fishing: null,
          mineSeed: 1, mineCheckpoint: 1, selectedSeed: 'moon-bean', playtimeSeconds: 0,
        },
      });
      request.onsuccess = () => { open.result.close(); resolve(); };
      request.onerror = () => reject(request.error);
    };
  }), state);
}

async function waitForMap(page: Page, mapId: string): Promise<void> {
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe(mapId);
}

async function waitForSprites(page: Page, expected: string[]): Promise<string[]> {
  let spriteKeys: string[] = [];
  await expect.poll(async () => {
    spriteKeys = await page.evaluate(() => window.__dewhollow?.sprites().map((sprite) => sprite.key) ?? []);
    return spriteKeys;
  }).toEqual(expect.arrayContaining(expected));
  return spriteKeys;
}

async function pauseScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow');
    return debug.pauseScene();
  });
}

async function capture(page: Page, mapId: string, testInfo: TestInfo, evidenceName = mapId) {
  const canvas = page.locator('#game canvas');
  const metadata = await page.evaluate(() => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow');
    const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
    if (!canvas) throw new Error('缺少遊戲 canvas');
    return {
      mapId: debug.mapId(),
      viewport: { width: innerWidth, height: innerHeight },
      devicePixelRatio,
      canvas: { width: canvas.width, height: canvas.height, cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight },
      camera: debug.cameraView(),
      scroll: debug.cameraScroll(),
      player: debug.actors().find((actor) => actor.id === 'player'),
      season: 'spring', year: 1, day: 4, time: '10:00', weather: 'sunny',
    };
  });
  if (evidenceEnabled) {
    await canvas.screenshot({ path: `docs/art/audit/vf11-scenes/${evidenceName}-after.png` });
    console.log(`[VF11_CAPTURE:${evidenceName}] ${JSON.stringify(metadata)}`);
  }
  await testInfo.attach(`${evidenceName}-scene-metadata.json`, {
    body: `${JSON.stringify(metadata, null, 2)}\n`,
    contentType: 'application/json',
  });
  return metadata;
}

test('approved farm and village scene assets render over the existing map targets', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await waitForMap(page, 'farm');
  await putRecord(page, { mapId: 'farm', player: { x: 7, y: 5, facing: 'down' } });
  await page.reload();
  await waitForMap(page, 'farm');
  const expectedFarmKeys = baselineMode
    ? ['tile.wall']
    : ['tile.wall', 'tile.grass', 'tile.path', 'tile.field', 'tile.fence', 'tile.shipbox', 'tile.door', 'scene.farm.tree', 'scene.farm.house'];
  const farmKeys = await waitForSprites(page, expectedFarmKeys);
  const farmSprites = await page.evaluate(() => window.__dewhollow?.sprites() ?? []);
  if (!baselineMode) {
    expect(farmKeys).toEqual(expect.arrayContaining(expectedFarmKeys));
    const wall = farmSprites.find((sprite) => sprite.key === 'tile.wall');
    expect(wall).toBeDefined();
    expect(farmSprites.some((sprite) => ['tile.grass', 'tile.path', 'tile.field'].includes(sprite.key)
      && sprite.left === wall!.left && sprite.top === wall!.top)).toBe(true);
  }
  await pauseScene(page);
  const farmCapture = await capture(page, 'farm', testInfo, 'farm-house');
  expect(farmCapture).toMatchObject({ mapId: 'farm', viewport: { width: 1280, height: 720 }, devicePixelRatio: 1, season: 'spring', year: 1, day: 4, time: '10:00', weather: 'sunny' });

  await putRecord(page, { mapId: 'farm', player: { x: 35, y: 25, facing: 'down' } });
  await page.reload();
  await waitForMap(page, 'farm');
  await waitForSprites(page, expectedFarmKeys);
  await pauseScene(page);
  const farmTreeCapture = await capture(page, 'farm', testInfo, 'farm-tree');
  expect(farmTreeCapture).toMatchObject({ mapId: 'farm', player: { tileX: 35, tileY: 25 }, viewport: { width: 1280, height: 720 }, devicePixelRatio: 1, season: 'spring', year: 1, day: 4, time: '10:00', weather: 'sunny' });

  await putRecord(page, { mapId: 'village', player: { x: 7, y: 10, facing: 'up' } });
  await page.reload();
  await waitForMap(page, 'village');
  const expectedVillageKeys = baselineMode
    ? ['tile.wall']
    : ['tile.wall', 'tile.grass', 'tile.path', 'scene.village.general-shop', 'scene.village.smithy'];
  const villageKeys = await waitForSprites(page, expectedVillageKeys);
  if (!baselineMode) {
    expect(villageKeys).toEqual(expect.arrayContaining(expectedVillageKeys));
  }
  await pauseScene(page);
  const villageCapture = await capture(page, 'village', testInfo, 'village');
  expect(villageCapture).toMatchObject({ mapId: 'village', viewport: { width: 1280, height: 720 }, devicePixelRatio: 1, season: 'spring', year: 1, day: 4, time: '10:00', weather: 'sunny' });
});
