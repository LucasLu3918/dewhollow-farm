import { expect, test, type Page } from '@playwright/test';

const candidateQuery = '?renderProfile=pixel32&gate1Runtime=pixel32-map-animation&gate1OverlayPreview=pixel32-overlay-12x10';
const candidateRoot = 'docs/art/candidates/pixel-movement/gate1-assets';
const evidenceRoot = 'docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-overlay-motion-stability';
const directions = [
  { id: 'north', key: 'ArrowUp', axis: 'y', delta: -1 },
  { id: 'east', key: 'ArrowRight', axis: 'x', delta: 1 },
  { id: 'south', key: 'ArrowDown', axis: 'y', delta: 1 },
  { id: 'west', key: 'ArrowLeft', axis: 'x', delta: -1 },
] as const;
const expectedOverlayIds = ['house-back', 'tree-canopy', 'house-front'];
const nodeProcess = (globalThis as typeof globalThis & {
  process?: { cwd(): string; env?: Record<string, string | undefined> };
}).process;
const saveEvidence = nodeProcess?.env?.SAVE_GATE1_PIXEL32_OVERLAY_MOTION_EVIDENCE === '1';

async function placePlayerAt(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(({ x, y }) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('saves', 'readwrite');
      transaction.objectStore('saves').put({
        slot: 'slot-1', savedAt: '2026-10-25T00:00:00.000Z',
        state: {
          schemaVersion: 13,
          calendar: { year: 1, season: 'spring', day: 4, minuteOfDay: 600 },
          weather: 'sunny', forecast: 'sunny', energy: { current: 100, max: 100 }, gold: 600,
          mapId: 'farm', player: { x, y, facing: 'down' }, plots: {},
          inventory: { capacity: 24, stacks: [] }, shipBox: { entries: [] }, flags: {}, rng: 12345,
          tool: 'hoe', toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 },
          worldChanges: {}, skills: { farming: 0, foraging: 0, fishing: 0, mining: 0, cooking: 0 }, talents: {},
          animals: [], cows: [], sheep: [], processing: [], fishing: null, mineSeed: 1, mineCheckpoint: 1,
          selectedSeed: 'sweet-radish', playtimeSeconds: 0,
        },
      });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
  }), { x, y });
  await page.reload();
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement().tile ?? null)).toMatchObject({ x, y });
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateOverlays().overlays.length ?? 0)).toBe(3);
}

async function waitForMovementIdle(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const movement = window.__dewhollow?.movement();
    return movement !== undefined && !movement.moving && movement.heldDirection === null
      && !movement.pending && movement.queuedTaps === 0;
  }), { timeout: 10_000 }).toBe(true);
}

test('pixel32 candidate overlay layers stay stable while the player moves around house and tree anchors', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const fs = await import('node:' + 'fs/promises');
  const path = await import('node:' + 'path');
  const crypto = await import('node:' + 'crypto');
  const resolvePath = (repositoryPath: string) => path.resolve(nodeProcess?.cwd() ?? '.', repositoryPath);
  const sha256 = (bytes: Uint8Array) => crypto.createHash('sha256').update(bytes).digest('hex');
  const evidenceDirectory = resolvePath(evidenceRoot);
  if (saveEvidence) await fs.mkdir(path.join(evidenceDirectory, 'screenshots'), { recursive: true });

  const candidateManifest = JSON.parse(await fs.readFile(resolvePath(`${candidateRoot}/pixel32-map/manifest.json`), 'utf8')) as {
    status: string; approved: boolean; atlas: { file: string };
  };
  expect(candidateManifest).toMatchObject({ status: 'candidate', approved: false, atlas: { file: 'map-atlas.png' } });
  const animationManifest = JSON.parse(await fs.readFile(resolvePath(`${candidateRoot}/pixel32-animation/manifest.json`), 'utf8')) as {
    status: string; approved: boolean; atlas: { file: string };
  };
  expect(animationManifest).toMatchObject({ status: 'candidate', approved: false, atlas: { file: 'player-4dir.png' } });
  const candidateInputs = {
    mapManifestSha256: sha256(await fs.readFile(resolvePath(`${candidateRoot}/pixel32-map/manifest.json`))),
    mapAtlasSha256: sha256(await fs.readFile(resolvePath(`${candidateRoot}/pixel32-map/${candidateManifest.atlas.file}`))),
    animationManifestSha256: sha256(await fs.readFile(resolvePath(`${candidateRoot}/pixel32-animation/manifest.json`))),
    animationAtlasSha256: sha256(await fs.readFile(resolvePath(`${candidateRoot}/pixel32-animation/${animationManifest.atlas.file}`))),
  };

  const requests: string[] = [];
  const failures: string[] = [];
  const httpFailures: string[] = [];
  const pageErrors: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes(candidateRoot)) requests.push(new URL(request.url()).pathname);
  });
  page.on('requestfailed', (request) => {
    if (request.url().includes(candidateRoot)) failures.push(request.url());
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().includes(candidateRoot)) httpFailures.push(`${response.status()} ${response.url()}`);
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(candidateQuery);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().enabled ?? false)).toBe(true);
  await placePlayerAt(page, 20, 5);

  const samples: Record<string, unknown>[] = [];
  const screenshots: Record<string, { file: string; sha256: string }> = {};
  let overlayBaseline: Array<Record<string, unknown>> | null = null;
  const capture = async (name: string) => {
    const state = await page.evaluate(() => {
      const debug = window.__dewhollow;
      if (!debug) throw new Error('Missing DEV MapScene diagnostics');
      const player = debug.actors().find((actor) => actor.id === 'player');
      if (!player) throw new Error('Missing player actor diagnostics');
      const runtime = debug.pixel32CandidateRuntime();
      const overlays = debug.pixel32CandidateOverlays();
      return {
        tile: debug.movement().tile,
        movement: debug.movement(),
        player: { footY: player.footY, depth: player.depth, frame: runtime.playerFrame },
        overlays,
      };
    });
    expect(state.player.frame).toMatch(/^(down|up|left|right)-(idle|contact-a|contact-b|passing)$/);
    expect(state.overlays.enabled).toBe(true);
    expect(state.overlays.overlays.map(({ id }) => id)).toEqual(expectedOverlayIds);
    expect(state.overlays.overlays.every(({ visible }) => visible)).toBe(true);
    expect(state.overlays.overlays.find(({ id }) => id === 'house-back')?.depth).toBe(1);
    const frontLayers = state.overlays.overlays.filter(({ layer }) => layer === 'front');
    expect(frontLayers).toHaveLength(2);
    expect(frontLayers.every(({ depth }) => depth > 1)).toBe(true);
    const overlaySignature = state.overlays.overlays.map(({ id, frame, layer, tileX, tileY, depth, displayList, visible }) => ({
      id, frame, layer, tileX, tileY, depth, displayList, visible,
    }));
    if (overlayBaseline === null) overlayBaseline = overlaySignature;
    else expect(overlaySignature, `${name}: candidate overlay signature should stay unchanged during movement`).toEqual(overlayBaseline);
    samples.push({ name, ...state });
    return state;
  };

  const start = await capture('tree-start');
  expect(start.tile).toEqual({ x: 20, y: 5, facing: 'down' });
  const treeStartDepth = start.overlays.overlays.find(({ id }) => id === 'tree-canopy')!.depth;
  expect(start.player.depth).toBeGreaterThan(treeStartDepth);
  const route = [
    { id: 'tree-behind', directions: [directions[0], directions[2]] },
    { id: 'tree-sides', directions: [directions[3], directions[1]] },
    { id: 'house-approach', directions: [directions[2], directions[2], directions[2], directions[2], directions[2], directions[2]] },
    { id: 'house-return', directions: [directions[0], directions[0], directions[0], directions[0], directions[0], directions[0]] },
  ] as const;
  const beforeByRoute: Record<string, { tile: { x: number; y: number }; depths: number[] }> = {};

  for (const segment of route) {
    for (const direction of segment.directions) {
      const before = await page.evaluate(() => window.__dewhollow!.movement().tile);
      await page.keyboard.press(direction.key);
      await expect.poll(() => page.evaluate((axis) => window.__dewhollow!.movement().tile[axis], direction.axis), { timeout: 10_000 })
        .toBe(before[direction.axis] + direction.delta);
      await waitForMovementIdle(page);
      const state = await capture(`${segment.id}-${direction.id}-${stateLabel(samples.length)}`);
      expect(state.tile[direction.axis]).toBe(before[direction.axis] + direction.delta);
      if (segment.id === 'tree-behind' && direction.id === 'north') {
        const canopyDepth = state.overlays.overlays.find(({ id }) => id === 'tree-canopy')!.depth;
        expect(state.player.depth, 'player north of the tree foot anchor should render behind its canopy').toBeLessThan(canopyDepth);
      }
      if (segment.id === 'house-approach' && direction.id === 'south' && state.tile.y === 11) {
        const houseDepth = state.overlays.overlays.find(({ id }) => id === 'house-front')!.depth;
        expect(state.player.depth, 'player south of the house foot anchor should render in front of its front layer').toBeGreaterThan(houseDepth);
      }
      if (segment.id === 'house-return' && direction.id === 'north' && state.tile.y === 9) {
        const houseDepth = state.overlays.overlays.find(({ id }) => id === 'house-front')!.depth;
        expect(state.player.depth, 'player north of the house foot anchor should render behind its front layer').toBeLessThan(houseDepth);
      }
      expect(state.movement.moving).toBe(false);
      beforeByRoute[segment.id] = { tile: state.tile, depths: state.overlays.overlays.map(({ depth }) => depth) };
    }
    const file = `${segment.id}.png`;
    const screenshot = await page.screenshot({
      path: saveEvidence ? path.join(evidenceDirectory, 'screenshots', file) : undefined,
      animations: 'disabled', scale: 'css',
    });
    screenshots[segment.id] = { file: `screenshots/${file}`, sha256: sha256(screenshot) };
    await testInfo.attach(file, { body: screenshot, contentType: 'image/png' });
  }

  const requiredAssets = [
    `${candidateRoot}/pixel32-map/manifest.json`, `${candidateRoot}/pixel32-map/map-atlas.png`,
    `${candidateRoot}/pixel32-animation/manifest.json`, `${candidateRoot}/pixel32-animation/player-4dir.png`,
  ];
  expect(requests).toEqual(expect.arrayContaining(requiredAssets.map((asset) => `/${asset}`)));
  expect(failures).toEqual([]);
  expect(httpFailures).toEqual([]);
  expect(pageErrors).toEqual([]);

  const evidence = {
    schemaVersion: 1,
    generatedBy: 'tests/e2e/gate1-mapscene-pixel32-overlay-motion-stability.spec.ts',
    candidate: {
      route: candidateQuery,
      map: { status: candidateManifest.status, approved: candidateManifest.approved },
      animation: { status: animationManifest.status, approved: animationManifest.approved },
      inputs: candidateInputs,
    },
    viewport: { width: 1280, height: 900, dpr: 1, screenshotScale: 'css' },
    routes: beforeByRoute,
    measurements: samples,
    screenshots,
    assetRequests: requests,
    assetFailures: failures,
    assetHttpFailures: httpFailures,
    pageErrors,
    isolation: { exactDevOnlyQuery: true, productionAssetsModified: false, mapCollisionSaveSchemaOrGameplayModified: false },
    limitations: [
      'Chromium emulation only; no native iOS or Android evidence.',
      'This records movement state and layer/depth stability, not pixel-perfect occlusion quality or artistic approval.',
      'The complete 12x10 game scene, exact candidate approval, and Gate 1 sign-off remain pending.',
    ],
  };
  const body = `${JSON.stringify(evidence, null, 2)}\n`;
  if (saveEvidence) await fs.writeFile(path.join(evidenceDirectory, 'evidence.json'), body);
  await testInfo.attach('gate1-pixel32-overlay-motion-stability.json', { body, contentType: 'application/json' });
});

function stateLabel(index: number): string {
  return String(index).padStart(2, '0');
}
