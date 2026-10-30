import { expect, test, type Page } from '@playwright/test';

type CandidateDebug = {
  mapId(): string;
  gameState(): Record<string, unknown>;
  indoorSceneCandidate(): {
    enabled: boolean;
    mapId: string;
    frames: string[];
    layers: Array<{ frame: string; layer: 'ground' | 'object'; x: number; y: number }>;
  };
  worldV2SceneCandidate(): { frames: string[] };
};

type Fixture = {
  mapId: string;
  player: { x: number; y: number; facing: string };
  flags: Record<string, boolean>;
  expectedFrames: string[];
  expectedWorldFrames?: string[];
  viewport: { width: number; height: number };
  screenshot: string;
};

async function putSave(page: Page, fixture: Fixture): Promise<void> {
  await page.evaluate(({ mapId, player, flags }) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('saves', 'readwrite');
      transaction.objectStore('saves').put({
        slot: 'slot-1',
        savedAt: '2026-10-28T00:00:00.000Z',
        state: {
          schemaVersion: 13,
          calendar: { year: 1, season: 'spring', day: 4, minuteOfDay: 600 },
          weather: 'sunny', forecast: 'sunny', energy: { current: 100, max: 100 }, gold: 600,
          mapId, player, plots: {}, inventory: { capacity: 24, stacks: [] }, shipBox: { entries: [] }, flags,
          rng: 12345, tool: 'pick', toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 },
          worldChanges: {}, skills: { farming: 0, foraging: 0, fishing: 0, mining: 0, cooking: 0 }, talents: {},
          animals: [], cows: [], sheep: [], processing: [], fishing: null, mineSeed: 7123, mineCheckpoint: 1,
          selectedSeed: 'sweet-radish', playtimeSeconds: 0,
        },
      });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
  }), fixture);
  await page.reload();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow?.mapId() ?? '')).toBe(fixture.mapId);
}

test('P6-062 indoor candidates stay DEV gated and render existing maps without changing save state', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?renderProfile=pixel32&gate1Runtime=pixel32-map-animation');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow?.indoorSceneCandidate().enabled ?? true)).toBe(false);

  const requests = [
    '/p6-062-farm-interiors/manifest.json', '/p6-062-farm-interiors/atlas.png',
    '/p6-062-mine/manifest.json', '/p6-062-mine/atlas.png',
    '/gate1-world-v2-scene/farm/manifest.json', '/gate1-world-v2-scene/farm/atlas.png',
    '/df-v2-030-house-interior/manifest.json', '/df-v2-030-house-interior/atlas.png',
  ].map((assetPath) => page.waitForResponse((response) => response.url().includes(assetPath)));
  await page.goto('/?renderProfile=pixel32&gate1Runtime=pixel32-map-animation&gate1IndoorScene=p6-062&gate1SceneVisual=world-v2-cozy');
  await expect(page.locator('#game canvas')).toBeVisible();
  expect((await Promise.all(requests)).map((response) => response.status())).toEqual([200, 200, 200, 200, 200, 200, 200, 200]);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow?.indoorSceneCandidate().enabled ?? false)).toBe(true);

  const fixtures: Fixture[] = [
    { mapId: 'coop', player: { x: 3, y: 4, facing: 'up' }, flags: {}, expectedFrames: ['coop-floor-a', 'coop-wall', 'coop-trough', 'coop-stall'], viewport: { width: 390, height: 844 }, screenshot: 'p6-062-farm-interiors/screenshots/coop-390x844.png' },
    { mapId: 'cowbarn', player: { x: 2, y: 3, facing: 'up' }, flags: {}, expectedFrames: ['coop-floor-a', 'coop-wall', 'coop-trough', 'coop-stall'], viewport: { width: 390, height: 844 }, screenshot: 'p6-062-farm-interiors/screenshots/cowbarn-390x844.png' },
    { mapId: 'pasture', player: { x: 1, y: 7, facing: 'right' }, flags: {}, expectedFrames: ['pasture-grass', 'pasture-path', 'pasture-fence-horizontal', 'pasture-water-edge'], viewport: { width: 1280, height: 720 }, screenshot: 'p6-062-farm-interiors/screenshots/pasture-1280x720.png' },
    { mapId: 'mine-entrance', player: { x: 8, y: 8, facing: 'up' }, flags: {}, expectedFrames: ['cave-floor', 'loose-rock', 'cave-mouth', 'mine-exit-door'], viewport: { width: 1280, height: 720 }, screenshot: 'p6-062-mine/screenshots/mine-entrance-1280x720.png' },
    { mapId: 'mine-41', player: { x: 37, y: 8, facing: 'left' }, flags: {}, expectedFrames: ['cave-floor', 'rock-wall', 'loose-rock', 'stairs-up', 'stairs-down'], viewport: { width: 1280, height: 720 }, screenshot: 'p6-062-mine/screenshots/mine-layer-1280x720.png' },
    { mapId: 'house', player: { x: 10, y: 18, facing: 'up' }, flags: {}, expectedFrames: [], expectedWorldFrames: ['floor-a', 'wall-left-corner'], viewport: { width: 390, height: 844 }, screenshot: 'p6-062-farm-interiors/screenshots/house-390x844.png' },
    { mapId: 'house-wing', player: { x: 10, y: 18, facing: 'up' }, flags: {}, expectedFrames: [], expectedWorldFrames: ['floor-a', 'wall-left-corner'], viewport: { width: 390, height: 844 }, screenshot: 'p6-062-farm-interiors/screenshots/house-wing-390x844.png' },
    { mapId: 'house-full', player: { x: 10, y: 18, facing: 'up' }, flags: {}, expectedFrames: [], expectedWorldFrames: ['floor-a', 'wall-left-corner'], viewport: { width: 390, height: 844 }, screenshot: 'p6-062-farm-interiors/screenshots/house-full-390x844.png' },
    { mapId: 'farm', player: { x: 7, y: 9, facing: 'up' }, flags: {}, expectedFrames: [], viewport: { width: 390, height: 844 }, screenshot: 'p6-062-farm-interiors/screenshots/greenhouse-locked-390x844.png' },
    { mapId: 'greenhouse', player: { x: 6, y: 6, facing: 'up' }, flags: { greenhouse: true }, expectedFrames: ['greenhouse-ground', 'greenhouse-glass', 'greenhouse-front', 'greenhouse-door'], viewport: { width: 390, height: 844 }, screenshot: 'p6-062-farm-interiors/screenshots/greenhouse-390x844.png' },
  ];

  for (const fixture of fixtures) {
    await page.setViewportSize(fixture.viewport);
    await putSave(page, fixture);
    const snapshot = await page.evaluate(() => {
      const debug = (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow!;
      return { state: debug.gameState(), scene: debug.indoorSceneCandidate(), worldV2SceneCandidate: debug.worldV2SceneCandidate() };
    });
    expect(snapshot.scene.enabled).toBe(true);
    expect(snapshot.scene.mapId).toBe(fixture.mapId);
    for (const frame of fixture.expectedFrames) {
      const mineFrame = frame.startsWith('cave-') || frame === 'rock-wall' || frame === 'loose-rock'
        || frame.startsWith('ore-') || frame.startsWith('stairs-') || frame === 'mine-exit-door';
      const atlas = mineFrame ? 'gate1-p6-062-mine-atlas' : 'gate1-p6-062-farm-interiors-atlas';
      expect(snapshot.scene.frames).toContain(`${atlas}:${frame}`);
    }
    for (const frame of fixture.expectedWorldFrames ?? []) {
      expect(snapshot.worldV2SceneCandidate.frames).toContain(`gate1-world-v2-house-atlas:${frame}`);
    }
    expect(snapshot.state.mapId).toBe(fixture.mapId);
    expect(snapshot.state.player).toMatchObject({ facing: fixture.player.facing });
    expect(snapshot.state.flags).toEqual(fixture.flags);
    const screenshotPath = `docs/art/candidates/pixel-movement/${fixture.screenshot}`;
    await page.locator('#game').screenshot({ path: screenshotPath, animations: 'disabled', scale: 'css' });
    const stateAfterCapture = await page.evaluate(() => (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow!.gameState());
    expect(stateAfterCapture).toEqual(snapshot.state);
  }
});
