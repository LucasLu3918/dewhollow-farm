import { expect, test, type Page } from '@playwright/test';

const candidateQuery = '?renderProfile=pixel32&gate1Runtime=pixel32-map-animation';
const outputDirectory = 'docs/art/candidates/pixel-movement/gate1-assets/pixel32-map/plot-visual';
const nodeProcess = (globalThis as typeof globalThis & {
  process?: { cwd(): string; env?: Record<string, string | undefined> };
}).process;
const saveEvidence = nodeProcess?.env?.SAVE_GATE1_PLOT_VISUAL_EVIDENCE === '1';

type PlotFixture = Record<string, { watered: boolean; dryDays: number; crop: null }>;

function blankPlot(watered = false): PlotFixture[string] {
  return { watered, dryDays: 0, crop: null };
}

function plotsForShape(shape: '1x1' | '3x3' | 'L'): PlotFixture {
  if (shape === '1x1') return { '8,7': blankPlot() };
  if (shape === '3x3') {
    const plots: PlotFixture = {};
    for (let y = 7; y <= 9; y += 1) {
      for (let x = 7; x <= 9; x += 1) plots[`${x},${y}`] = blankPlot(x === 8 && y === 8);
    }
    return plots;
  }
  return {
    '8,7': blankPlot(true),
    '9,7': blankPlot(true),
    '8,8': blankPlot(true),
    '8,9': blankPlot(true),
  };
}

async function seedFarmSave(page: Page, plots: PlotFixture): Promise<void> {
  await page.evaluate((nextPlots) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('saves', 'readwrite');
      transaction.objectStore('saves').put({
        slot: 'slot-1', savedAt: '2026-10-28T00:00:00.000Z',
        state: {
          schemaVersion: 13,
          calendar: { year: 1, season: 'spring', day: 4, minuteOfDay: 600 },
          weather: 'sunny', forecast: 'sunny', energy: { current: 100, max: 100 }, gold: 600,
          mapId: 'farm', player: { x: 5, y: 5, facing: 'down' }, plots: nextPlots,
          inventory: { capacity: 24, stacks: [] }, shipBox: { entries: [] }, flags: {}, rng: 12345,
          tool: 'hoe', toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 },
          worldChanges: {}, skills: { farming: 0, foraging: 0, fishing: 0, mining: 0, cooking: 0 },
          talents: {}, animals: [], cows: [], sheep: [], processing: [], fishing: null,
          mineSeed: 1, mineCheckpoint: 1, selectedSeed: 'sweet-radish', playtimeSeconds: 0,
        },
      });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
  }), plots);
}

async function loadPlots(page: Page, plots: PlotFixture, query: string): Promise<void> {
  await seedFarmSave(page, plots);
  await page.goto(query);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await page.evaluate(() => window.__dewhollow?.pauseScene({ preservePose: false }));
}

test('P4-040 renders masked dry/wet plot soil for 1x1, 3x3, and L candidates in DEV only', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(candidateQuery);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().enabled ?? false)).toBe(true);

  const cases = [
    { shape: '1x1' as const, count: 1, frame: 'spring-dry-soil-edge-0' },
    { shape: '3x3' as const, count: 9, frame: 'spring-dry-soil-edge-a' },
    { shape: 'L' as const, count: 4, frame: 'spring-wet-soil-edge-6' },
  ];

  for (const sample of cases) {
    await loadPlots(page, plotsForShape(sample.shape), candidateQuery);
    const diagnostics = await page.evaluate(() => {
      const debug = window.__dewhollow;
      if (!debug) throw new Error('Missing MapScene diagnostics');
      const visuals = debug.sprites().filter((sprite) => sprite.key === 'gate1-pixel32-map-atlas'
        && /^(spring|summer|autumn|winter)-(dry|wet)-soil-edge-/.test(sprite.frame ?? ''));
      return {
        enabled: debug.pixel32CandidateRuntime().enabled,
        frames: visuals.map((sprite) => sprite.frame),
        bounds: visuals.map(({ left, top, width, height }) => ({ left, top, width, height })),
      };
    });
    expect(diagnostics.enabled).toBe(true);
    expect(diagnostics.frames).toHaveLength(sample.count);
    expect(diagnostics.frames).toContain(sample.frame);
    expect(diagnostics.bounds.every(({ width, height }) => width === 64 && height === 64)).toBe(true);

    if (saveEvidence) {
      await page.locator('#game canvas').screenshot({
        path: `${outputDirectory}/plot-${sample.shape === 'L' ? 'L' : sample.shape}.png`,
        animations: 'disabled',
      });
    }
  }

  await loadPlots(page, plotsForShape('1x1'), '?renderProfile=pixel32');
  const productionLike = await page.evaluate(() => ({
    enabled: window.__dewhollow?.pixel32CandidateRuntime().enabled ?? false,
    soilFrames: window.__dewhollow?.sprites().filter((sprite) => sprite.key === 'gate1-pixel32-map-atlas'
      && /soil-edge/.test(sprite.frame ?? '')).length ?? 0,
  }));
  expect(productionLike).toEqual({ enabled: false, soilFrames: 0 });
});
