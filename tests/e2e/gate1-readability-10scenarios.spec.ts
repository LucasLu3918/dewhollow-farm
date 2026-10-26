import { expect, test, type Page } from '@playwright/test';

const runtimeQuery = '?renderProfile=pixel32&gate1Runtime=pixel32-map-animation';
const candidateQuery = `${runtimeQuery}&gate1AssetPreview=pixel32-candidates`;
const petQuery = `${candidateQuery}&gate1CandidatePetFollow=pixel32-cat-follow`;
const evidenceDirectory = 'docs/art/candidates/pixel-movement/gate1-readability-10scenarios';
const nodeProcess = (globalThis as typeof globalThis & {
  process?: { cwd(): string; env?: Record<string, string | undefined> };
}).process;
const saveEvidence = nodeProcess?.env?.SAVE_GATE1_READABILITY_EVIDENCE === '1';

type Scenario = {
  id: string;
  query: string;
  mapId: string;
  player: { x: number; y: number; facing: 'up' | 'down' | 'left' | 'right' };
  plots?: Record<string, { watered: boolean; dryDays: number; crop: { cropId: string; growthDays: number } }>;
  flags?: Record<string, boolean>;
  moveIntoGreenhouse?: boolean;
};

const scenarios: Scenario[] = [
  { id: 'dry-unripe', query: candidateQuery, mapId: 'farm', player: { x: 5, y: 5, facing: 'down' }, plots: { '5,6': { watered: false, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 1 } } } },
  { id: 'wet-unripe', query: candidateQuery, mapId: 'farm', player: { x: 5, y: 5, facing: 'down' }, plots: { '5,6': { watered: true, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 1 } } } },
  { id: 'dry-ripe', query: candidateQuery, mapId: 'farm', player: { x: 5, y: 5, facing: 'down' }, plots: { '5,6': { watered: false, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 3 } } } },
  { id: 'wet-ripe', query: candidateQuery, mapId: 'farm', player: { x: 5, y: 5, facing: 'down' }, plots: { '5,6': { watered: true, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 3 } } } },
  { id: 'player-farm', query: candidateQuery, mapId: 'farm', player: { x: 5, y: 5, facing: 'down' } },
  { id: 'player-near-crop', query: candidateQuery, mapId: 'farm', player: { x: 4, y: 5, facing: 'right' }, plots: { '5,6': { watered: true, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 3 } } } },
  { id: 'player-with-cat', query: petQuery, mapId: 'farm', player: { x: 5, y: 5, facing: 'up' } },
  { id: 'player-with-resident', query: runtimeQuery, mapId: 'village', player: { x: 7, y: 9, facing: 'down' } },
  { id: 'greenhouse-door', query: runtimeQuery, mapId: 'farm', player: { x: 30, y: 19, facing: 'down' }, flags: { greenhouse: true } },
  { id: 'greenhouse-interior', query: runtimeQuery, mapId: 'farm', player: { x: 30, y: 19, facing: 'down' }, flags: { greenhouse: true }, moveIntoGreenhouse: true },
];

async function seedSave(page: Page, scenario: Scenario): Promise<void> {
  await page.evaluate((state) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('saves', 'readwrite');
      transaction.objectStore('saves').put({
        slot: 'slot-1',
        savedAt: '2026-10-26T00:00:00.000Z',
        state: {
          schemaVersion: 13,
          calendar: { year: 1, season: 'spring', day: 4, minuteOfDay: 600 },
          weather: 'sunny', forecast: 'sunny', energy: { current: 100, max: 100 }, gold: 600,
          mapId: state.mapId, player: state.player, plots: state.plots ?? {},
          inventory: { capacity: 24, stacks: [] }, shipBox: { entries: [] }, flags: state.flags ?? {}, rng: 12345,
          tool: 'hoe', toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 },
          worldChanges: {}, skills: { farming: 0, foraging: 0, fishing: 0, mining: 0, cooking: 0 }, talents: {},
          animals: [], cows: [], sheep: [], processing: [], fishing: null, mineSeed: 1, mineCheckpoint: 1,
          selectedSeed: 'sweet-radish', playtimeSeconds: 0,
        },
      });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
  }), scenario);
}

test('captures ten blinded 100%-scale candidate readability stimuli', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const fs = await import('node:' + 'fs/promises');
  const path = await import('node:' + 'path');
  const crypto = await import('node:' + 'crypto');
  const childProcess = await import('node:' + 'child_process');
  const root = path.resolve(nodeProcess?.cwd() ?? '.', evidenceDirectory);
  if (saveEvidence) {
    await fs.mkdir(path.join(root, 'participant', 'stimuli'), { recursive: true });
    await fs.mkdir(path.join(root, 'evaluator'), { recursive: true });
  }
  const sha256 = (bytes: Uint8Array) => crypto.createHash('sha256').update(bytes).digest('hex');
  await page.setViewportSize({ width: 1280, height: 900 });
  const requests: string[] = [];
  const candidateFailures: string[] = [];
  const pageErrors: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/gate1-assets/') || request.url().includes('/gate1-pets-pixel32/')) {
      requests.push(new URL(request.url()).pathname);
    }
  });
  page.on('requestfailed', (request) => {
    if (request.url().includes('/gate1-assets/') || request.url().includes('/gate1-pets-pixel32/')) candidateFailures.push(request.url());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const permutation = [6, 2, 9, 1, 7, 4, 0, 8, 3, 5];
  const stimuli: Array<{ number: string; scenarioId: string; width: number; height: number; contentBox: { offsetX: number; offsetY: number }; sha256: string; bytes: number }> = [];
  const answerKey: Record<string, { scenarioId: string; route: string; fixture: Omit<Scenario, 'id' | 'query' | 'moveIntoGreenhouse'> }> = {};
  const inputHashes = await Promise.all([
    'docs/art/candidates/pixel-movement/gate1-assets/pixel32-animation/manifest.json',
    'docs/art/candidates/pixel-movement/gate1-assets/pixel32-animation/player-4dir.png',
    'docs/art/candidates/pixel-movement/gate1-assets/pixel32-map/manifest.json',
    'docs/art/candidates/pixel-movement/gate1-assets/pixel32-map/map-atlas.png',
    'docs/art/candidates/pixel-movement/gate1-assets/pixel32-crops/manifest.json',
    'docs/art/candidates/pixel-movement/gate1-assets/pixel32-crops/sweet-radish-stages.png',
    'docs/art/candidates/pixel-movement/gate1-pets-pixel32/manifest.json',
    'docs/art/candidates/pixel-movement/gate1-pets-pixel32/pets-pixel32.png',
  ].map(async (relative) => ({ path: relative, sha256: sha256(await fs.readFile(path.resolve(nodeProcess?.cwd() ?? '.', relative))), bytes: (await fs.stat(path.resolve(nodeProcess?.cwd() ?? '.', relative))).size })));

  for (const [displayIndex, scenarioIndex] of permutation.entries()) {
    const scenario = scenarios[scenarioIndex]!;
    const number = String(displayIndex + 1).padStart(2, '0');
    await page.goto(scenario.query);
    await expect(page.locator('#game canvas')).toBeVisible();
    await seedSave(page, scenario);
    await page.reload();
    await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe(scenario.mapId);
    if (scenario.query.includes('gate1AssetPreview')) {
      await expect.poll(() => page.evaluate(() => window.__dewhollow?.candidateAssetReview().enabled ?? false)).toBe(true);
      await page.evaluate(() => window.__dewhollow?.setCandidateAssetReviewVisible(false));
    }
    if (scenario.query.includes('gate1CandidatePetFollow')) {
      await expect.poll(() => page.evaluate(() => window.__dewhollow?.candidatePetFollow().cat?.visible ?? false)).toBe(true);
    }
    if (scenario.id === 'player-with-resident') {
      await expect.poll(() => page.evaluate(() => window.__dewhollow?.actors().length ?? 0)).toBeGreaterThan(1);
    }
    if (scenario.id === 'greenhouse-door') {
      await expect.poll(() => page.evaluate(() => window.__dewhollow?.sprites().some((sprite) => sprite.key === 'tile.door') ?? false)).toBe(true);
    }
    if (scenario.moveIntoGreenhouse) {
      await page.keyboard.press('ArrowDown');
      await expect.poll(() => page.evaluate(() => {
        const tile = window.__dewhollow?.movement().tile;
        return tile ? { x: tile.x, y: tile.y } : null;
      })).toEqual({ x: 30, y: 22 });
    }

    const canvasBox = await page.locator('#game canvas').boundingBox();
    expect(canvasBox).not.toBeNull();
    const dimensions = await page.locator('#game canvas').evaluate((canvas) => ({
      width: canvas.clientWidth, height: canvas.clientHeight,
      offsetX: canvas.clientLeft, offsetY: canvas.clientTop,
    }));
    const screenshot = await page.screenshot({
      clip: { x: canvasBox!.x + dimensions.offsetX, y: canvasBox!.y + dimensions.offsetY, width: dimensions.width, height: dimensions.height },
      path: saveEvidence ? path.join(root, 'participant', 'stimuli', `${number}.png`) : undefined,
      animations: 'disabled',
      scale: 'css',
    });
    const png = new DataView(screenshot.buffer, screenshot.byteOffset, screenshot.byteLength);
    const screenshotDimensions = { width: png.getUint32(16), height: png.getUint32(20) };
    expect(screenshotDimensions).toEqual({ width: dimensions.width, height: dimensions.height });
    const hash = sha256(screenshot);
    await testInfo.attach(`stimulus-${number}.png`, { body: screenshot, contentType: 'image/png' });
    answerKey[number] = {
      scenarioId: scenario.id,
      route: scenario.query,
      fixture: { mapId: scenario.mapId, player: scenario.player, plots: scenario.plots ?? {}, flags: scenario.flags ?? {} },
    };
    stimuli.push({
      number, scenarioId: scenario.id, width: screenshotDimensions.width, height: screenshotDimensions.height,
      contentBox: { offsetX: dimensions.offsetX, offsetY: dimensions.offsetY }, sha256: hash, bytes: screenshot.byteLength,
    });
  }

  expect(stimuli).toHaveLength(10);
  expect(new Set(stimuli.map(({ sha256 }) => sha256)).size).toBeGreaterThan(5);
  expect(candidateFailures).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(requests).toEqual(expect.arrayContaining([
    '/docs/art/candidates/pixel-movement/gate1-assets/pixel32-animation/manifest.json',
    '/docs/art/candidates/pixel-movement/gate1-assets/pixel32-animation/player-4dir.png',
    '/docs/art/candidates/pixel-movement/gate1-assets/pixel32-map/manifest.json',
    '/docs/art/candidates/pixel-movement/gate1-assets/pixel32-map/map-atlas.png',
    '/docs/art/candidates/pixel-movement/gate1-assets/pixel32-crops/manifest.json',
    '/docs/art/candidates/pixel-movement/gate1-assets/pixel32-crops/sweet-radish-stages.png',
    '/docs/art/candidates/pixel-movement/gate1-pets-pixel32/manifest.json',
    '/docs/art/candidates/pixel-movement/gate1-pets-pixel32/pets-pixel32.png',
  ]));
  if (saveEvidence) {
    const [animationManifest, mapManifest, cropManifest, petManifest] = await Promise.all([
      'docs/art/candidates/pixel-movement/gate1-assets/pixel32-animation/manifest.json',
      'docs/art/candidates/pixel-movement/gate1-assets/pixel32-map/manifest.json',
      'docs/art/candidates/pixel-movement/gate1-assets/pixel32-crops/manifest.json',
      'docs/art/candidates/pixel-movement/gate1-pets-pixel32/manifest.json',
    ].map(async (relative) => JSON.parse(await fs.readFile(path.resolve(nodeProcess?.cwd() ?? '.', relative), 'utf8')) as { status: string; approved: boolean }));
    for (const manifest of [animationManifest, mapManifest, cropManifest, petManifest]) expect(manifest).toMatchObject({ status: 'candidate', approved: false });
    const evidence = {
      schemaVersion: 1,
      status: 'candidate-assessment-pending',
      generatedBy: 'tests/e2e/gate1-readability-10scenarios.spec.ts',
      capturedAt: new Date().toISOString(),
      captureProvider: 'Playwright Chromium, 1280x900 viewport, DPR 1; exact canvas CSS content box using clientLeft/clientTop border insets',
      baseRevision: childProcess.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      testSource: {
        path: 'tests/e2e/gate1-readability-10scenarios.spec.ts',
        sha256: sha256(await fs.readFile(path.resolve(nodeProcess?.cwd() ?? '.', 'tests/e2e/gate1-readability-10scenarios.spec.ts'))),
      },
      stimuli: stimuli.map(({ number: stimulusNumber, width, height, contentBox, sha256: screenshotSha256, bytes }) => ({
        number: stimulusNumber, width, height, contentBox, sha256: screenshotSha256, bytes,
      })),
      inputHashes,
      candidateStatus: { animation: animationManifest, map: mapManifest, crops: cropManifest, pets: petManifest },
      requests: [...new Set(requests)].sort(),
      candidateFailures,
      pageErrors,
      humanResults: { observers: 0, correct: null, total: 10, accuracy: null, threshold: 0.9, status: 'PENDING' },
      limitations: [
        'This evidence is Chromium CSS-scale output, not native-device or native-DPR evidence.',
        'The greenhouse door screenshot shows the existing playable transition, not the separate static pixel32 door candidate preview.',
        'No human answers are included; machine capture success does not satisfy the 90% readability threshold.',
        'Candidate asset hashes remain unapproved and formal integration remains pending.',
      ],
    };
    await fs.writeFile(path.join(root, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
    await fs.writeFile(path.join(root, 'evaluator', 'answer-key.json'), `${JSON.stringify({ schemaVersion: 1, warning: 'Keep sealed until all observers submit their answer forms.', answers: answerKey }, null, 2)}\n`);
  }
});
