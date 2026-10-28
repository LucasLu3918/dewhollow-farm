import { expect, test, type Page } from '@playwright/test';

type CandidateDebug = {
  mapId(): string;
  gameState(): Record<string, unknown>;
  seasonWeatherCandidate(): {
    enabled: boolean;
    mapId: string;
    season: string;
    minuteOfDay: number;
    weather: string;
    ambience: string | null;
    ambienceSize: { width: number; height: number } | null;
    nightShadeSize: { width: number; height: number };
    nightShadeVisible: boolean;
    nightShadeAlpha: number;
    viewportSize: { width: number; height: number; zoom: number };
    pixelViewport: {
      renderResolution: { width: number; height: number };
      cssScale: number;
      devicePixelScale: number;
      actualCanvasResolution: { width: number; height: number };
      cameraZoom: number;
    };
    frames: string[];
  };
};

const seasons = ['spring', 'summer', 'autumn', 'winter'] as const;
const lightStates = [
  { id: 'dawn', minuteOfDay: 300, weather: 'sunny', frame: 'ambience-dawn' },
  { id: 'day', minuteOfDay: 720, weather: 'sunny', frame: 'ambience-day' },
  { id: 'dusk', minuteOfDay: 1140, weather: 'sunny', frame: 'ambience-dusk' },
  { id: 'rain-night', minuteOfDay: 1320, weather: 'rain', frame: 'ambience-rain-night' },
] as const;

async function saveFarmState(page: Page, season: string, minuteOfDay: number, weather: string): Promise<void> {
  await page.evaluate(({ season, minuteOfDay, weather }) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('saves', 'readwrite');
      transaction.objectStore('saves').put({
        slot: 'slot-1', savedAt: '2026-10-28T00:00:00.000Z',
        state: {
          schemaVersion: 13,
          calendar: { year: 1, season, day: 4, minuteOfDay },
          weather, forecast: weather, energy: { current: 100, max: 100 }, gold: 600,
          mapId: 'farm', player: { x: 9, y: 9, facing: 'down' }, plots: {},
          inventory: { capacity: 24, stacks: [] }, shipBox: { entries: [] }, flags: {},
          rng: 12345, tool: 'pick', toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 },
          worldChanges: {}, skills: { farming: 0, foraging: 0, fishing: 0, mining: 0, cooking: 0 }, talents: {},
          animals: [], cows: [], sheep: [], processing: [], fishing: null, mineSeed: 7123, mineCheckpoint: 1,
          selectedSeed: 'sweet-radish', playtimeSeconds: 0,
        },
      });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
  }), { season, minuteOfDay, weather });
  await page.reload();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow?.mapId() ?? '')).toBe('farm');
}

test('P6-063 compares all four seasons and four lighting states at the same farm location', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?renderProfile=pixel32&gate1Runtime=pixel32-map-animation');
  await expect(page.locator('#game canvas')).toBeVisible();
  await saveFarmState(page, 'spring', 1320, 'sunny');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow?.seasonWeatherCandidate().enabled ?? true)).toBe(false);
  const legacyNight = await page.evaluate(() => (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow!.seasonWeatherCandidate());
  expect(legacyNight.nightShadeVisible).toBe(true);
  expect(legacyNight.nightShadeAlpha).toBeGreaterThan(0);

  const assets = [
    '/p6-063-season-weather/manifest.json', '/p6-063-season-weather/atlas.png',
    '/gate1-world-v2-scene/farm/manifest.json', '/gate1-world-v2-scene/farm/atlas.png',
    '/df-v2-030-house-interior/manifest.json', '/df-v2-030-house-interior/atlas.png',
  ].map((path) => page.waitForResponse((response) => response.url().includes(path)));
  await page.goto('/?renderProfile=pixel32&gate1Runtime=pixel32-map-animation&gate1SceneVisual=world-v2-cozy&gate1SeasonWeather=p6-063');
  await expect(page.locator('#game canvas')).toBeVisible();
  expect((await Promise.all(assets)).map((response) => response.status())).toEqual([200, 200, 200, 200, 200, 200]);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow?.seasonWeatherCandidate().enabled ?? false)).toBe(true);

  for (const season of seasons) {
    for (const light of lightStates) {
      await saveFarmState(page, season, light.minuteOfDay, light.weather);
      const snapshot = await page.evaluate(() => {
        const debug = (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow!;
        return { state: debug.gameState(), candidate: debug.seasonWeatherCandidate() };
      });
      expect(snapshot.candidate).toMatchObject({
        enabled: true,
        mapId: 'farm',
        season,
        minuteOfDay: light.minuteOfDay,
        weather: light.weather,
        ambience: light.frame,
      });
      expect(snapshot.candidate.ambienceSize).not.toBeNull();
      expect(snapshot.candidate.ambienceSize!.width * snapshot.candidate.viewportSize.zoom / 4)
        .toBeGreaterThanOrEqual(snapshot.candidate.viewportSize.width - 1);
      expect(snapshot.candidate.nightShadeSize.width * snapshot.candidate.viewportSize.zoom / 4)
        .toBeGreaterThanOrEqual(snapshot.candidate.viewportSize.width - 1);
      expect(snapshot.candidate.nightShadeSize.height * snapshot.candidate.viewportSize.zoom / 4)
        .toBeGreaterThanOrEqual(snapshot.candidate.viewportSize.height - 1);
      expect(snapshot.candidate.frames).toContain(`season-${season}`);
      expect(snapshot.candidate.frames).toContain(`season-${season}-foliage`);
      const screenshotPath = `docs/art/candidates/pixel-movement/p6-063-season-weather/screenshots/${season}-${light.id}-1280x720.png`;
      await page.locator('#game').screenshot({ path: screenshotPath, animations: 'disabled', scale: 'css' });
      const after = await page.evaluate(() => (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow!.gameState());
      expect(after).toEqual(snapshot.state);
    }
  }
});
