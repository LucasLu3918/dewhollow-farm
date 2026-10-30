import { expect, test, type Page } from '@playwright/test';

const candidateQuery = '?renderProfile=pixel32&gate1Runtime=pixel32-map-animation&gate1OverlayPreview=pixel32-overlay-12x10';
const candidateRoot = 'docs/art/candidates/pixel-movement/gate1-assets';
const evidenceRoot = 'docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-overlay-walkframe-depth';
const expectedOverlayIds = ['house-back', 'tree-canopy', 'house-front'];
const nodeProcess = (globalThis as typeof globalThis & {
  process?: { cwd(): string; env?: Record<string, string | undefined> };
}).process;
const saveEvidence = nodeProcess?.env?.SAVE_GATE1_PIXEL32_WALKFRAME_DEPTH_EVIDENCE === '1';

type WalkSample = {
  elapsedMs: number;
  moving: boolean;
  heldDirection: string | null;
  blockedDirection: string | null;
  tile: { x: number; y: number };
  player: { footY: number; depth: number; frame: string | null };
  overlays: Array<{ id: string; frame: string; layer: string; tileX: number; tileY: number; depth: number; displayList: string; visible: boolean }>;
};

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

async function crossAnchorWhileSampling(page: Page, direction: 'down' | 'up', startY: number, targetY: number): Promise<WalkSample[]> {
  const key = direction === 'down' ? 'ArrowDown' : 'ArrowUp';
  const step = direction === 'down' ? 1 : -1;
  const result: WalkSample[] = [];
  let currentY = startY;
  while (currentY !== targetY) {
    const nextY = currentY + step;
    await page.keyboard.down(key);
    const samples = await page.evaluate(async ({ nextY, key }) => {
      const samples: WalkSample[] = [];
      const startedAt = performance.now();
      const deadline = startedAt + 5_000;
      let inputReleased = false;
      await new Promise<void>((resolve, reject) => {
        const sample = () => {
          const debug = window.__dewhollow;
          if (!debug) { reject(new Error('Missing DEV MapScene diagnostics')); return; }
          const movement = debug.movement();
          const actor = debug.actors().find(({ id }) => id === 'player');
          if (!actor) { reject(new Error('Missing player actor diagnostics')); return; }
          const runtime = debug.pixel32CandidateRuntime();
          const overlays = debug.pixel32CandidateOverlays();
          samples.push({
            elapsedMs: Math.round(performance.now() - startedAt),
            moving: movement.moving,
            heldDirection: movement.heldDirection,
            blockedDirection: movement.blockedDirection,
            tile: movement.tile,
            player: { footY: actor.footY, depth: actor.depth, frame: runtime.playerFrame },
            overlays: overlays.overlays.map(({ id, frame, layer, tileX, tileY, depth, displayList, visible }) => ({
              id, frame, layer, tileX, tileY, depth, displayList, visible,
            })),
          });
          if (movement.tile.y === nextY && !inputReleased) {
            // Release in the same browser frame that observes the committed tile.
            // A delayed Playwright round trip can otherwise queue another step on slow CI.
            window.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, bubbles: true, cancelable: true }));
            inputReleased = true;
          }
          if (inputReleased && movement.tile.y === nextY && !movement.moving
            && movement.heldDirection === null && !movement.pending && movement.queuedTaps === 0) {
            resolve();
            return;
          }
          if (performance.now() >= deadline) {
            reject(new Error(`Timed out crossing to y=${nextY}; last movement=${JSON.stringify(movement)}, frame=${runtime.playerFrame}`));
            return;
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      return samples;
    }, { nextY, key });
    await page.keyboard.up(key);
    result.push(...samples);
    currentY = nextY;
  }
  return result;
}

test('pixel32 candidate walk frames cross tree and house overlay depth anchors while moving', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const fs = await import('node:' + 'fs/promises');
  const path = await import('node:' + 'path');
  const crypto = await import('node:' + 'crypto');
  const resolvePath = (repositoryPath: string) => path.resolve(nodeProcess?.cwd() ?? '.', repositoryPath);
  const sha256 = (bytes: Uint8Array) => crypto.createHash('sha256').update(bytes).digest('hex');
  const evidenceDirectory = resolvePath(evidenceRoot);
  if (saveEvidence) await fs.mkdir(path.join(evidenceDirectory, 'screenshots'), { recursive: true });

  const manifestFiles = {
    mapManifest: `${candidateRoot}/pixel32-map/manifest.json`,
    mapAtlas: `${candidateRoot}/pixel32-map/map-atlas.png`,
    animationManifest: `${candidateRoot}/pixel32-animation/manifest.json`,
    animationAtlas: `${candidateRoot}/pixel32-animation/player-4dir.png`,
  };
  const mapManifest = JSON.parse(await fs.readFile(resolvePath(manifestFiles.mapManifest), 'utf8')) as { status: string; approved: boolean };
  const animationManifest = JSON.parse(await fs.readFile(resolvePath(manifestFiles.animationManifest), 'utf8')) as { status: string; approved: boolean };
  expect(mapManifest).toMatchObject({ status: 'candidate', approved: false });
  expect(animationManifest).toMatchObject({ status: 'candidate', approved: false });
  const inputHashes = Object.fromEntries(await Promise.all(Object.entries(manifestFiles).map(async ([id, file]) => [
    id, sha256(await fs.readFile(resolvePath(file))),
  ])));

  const requests: string[] = [];
  const requestFailures: string[] = [];
  const httpFailures: string[] = [];
  const pageErrors: string[] = [];
  page.on('request', (request) => { if (request.url().includes(candidateRoot)) requests.push(new URL(request.url()).pathname); });
  page.on('requestfailed', (request) => { if (request.url().includes(candidateRoot)) requestFailures.push(request.url()); });
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().includes(candidateRoot)) httpFailures.push(`${response.status()} ${response.url()}`);
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(candidateQuery);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().enabled ?? false)).toBe(true);
  // The DEV candidate overlays use the redesigned farm anchors at x=19.
  await placePlayerAt(page, 19, 3);

  const treeSamples = await crossAnchorWhileSampling(page, 'down', 3, 5);
  const treeDepth = treeSamples[0]?.overlays.find(({ id }) => id === 'tree-canopy')?.depth;
  expect(treeDepth).toBeDefined();
  expect(treeSamples.some(({ moving, heldDirection, player }) => moving && heldDirection === 'down'
    && ['down-contact-a', 'down-contact-b', 'down-passing'].includes(player.frame ?? '')),
  'tree crossing must sample an active directional walk frame').toBe(true);
  const treeNorth = treeSamples.filter(({ player }) => player.footY < 320);
  const treeSouth = treeSamples.filter(({ player }) => player.footY > 320);
  const treeAnchorWalkSamples = treeSamples.filter(({ moving, player }) => moving
    && ['down-contact-a', 'down-contact-b', 'down-passing'].includes(player.frame ?? '')
    && Math.abs(player.footY - 320) <= 16 && Math.abs(player.depth - treeDepth!) <= 0.3);
  expect(treeAnchorWalkSamples.length > 0,
    `tree crossing should sample a directional walk frame within 16px of the moving depth anchor; nearby=${JSON.stringify(treeSamples
      .filter(({ moving, player }) => moving && Math.abs(player.footY - 320) <= 24)
      .map(({ elapsedMs, player }) => ({ elapsedMs, ...player })))}`).toBe(true);
  expect(treeNorth.some(({ moving, player }) => moving && player.depth < treeDepth!), 'moving samples north of the tree anchor should be behind the canopy').toBe(true);
  expect(treeSouth.some(({ moving, player }) => moving && player.depth > treeDepth!), 'moving samples south of the tree anchor should be in front of the canopy').toBe(true);
  expect(treeSamples.every(({ blockedDirection }) => blockedDirection === null), 'tree route should not be blocked').toBe(true);
  expect(await page.evaluate(() => window.__dewhollow!.movement().tile)).toMatchObject({ x: 19, y: 5 });
  const screenshotBytes: Record<string, Uint8Array> = {
    'tree-crossing': await page.screenshot({ animations: 'disabled', scale: 'css' }),
  };

  for (let expectedY = 6; expectedY <= 13; expectedY += 1) {
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement().tile ?? null))
      .toMatchObject({ x: 19, y: expectedY });
    await waitForMovementIdle(page);
  }
  expect(await page.evaluate(() => window.__dewhollow!.movement().tile)).toMatchObject({ x: 19, y: 13 });
  const houseSamples = await crossAnchorWhileSampling(page, 'up', 13, 9);
  const houseDepth = houseSamples[0]?.overlays.find(({ id }) => id === 'house-front')?.depth;
  expect(houseDepth).toBeDefined();
  expect(houseSamples.some(({ moving, player }) => moving
    && ['up-contact-a', 'up-contact-b', 'up-passing'].includes(player.frame ?? '')), 'house crossing must sample an active directional walk frame').toBe(true);
  const houseNorth = houseSamples.filter(({ player }) => player.footY < 704);
  const houseSouth = houseSamples.filter(({ player }) => player.footY > 704);
  const houseAnchorWalkSamples = houseSamples.filter(({ moving, player }) => moving
    && ['up-contact-a', 'up-contact-b', 'up-passing'].includes(player.frame ?? '')
    && Math.abs(player.footY - 704) <= 16 && Math.abs(player.depth - houseDepth!) <= 0.3);
  expect(houseAnchorWalkSamples.length > 0,
    `house crossing should sample a directional walk frame within 16px of the moving depth anchor; nearby=${JSON.stringify(houseSamples
      .filter(({ moving, player }) => moving && Math.abs(player.footY - 704) <= 24)
      .map(({ elapsedMs, player }) => ({ elapsedMs, ...player })))}`).toBe(true);
  expect(houseNorth.some(({ moving, player }) => moving && player.depth < houseDepth!), 'moving samples north of the house anchor should be behind its front layer').toBe(true);
  expect(houseSouth.some(({ moving, player }) => moving && player.depth > houseDepth!), 'moving samples south of the house anchor should be in front of its front layer').toBe(true);
  expect(houseSamples.every(({ blockedDirection }) => blockedDirection === null), 'house route should not be blocked').toBe(true);
  expect(await page.evaluate(() => window.__dewhollow!.movement().tile)).toMatchObject({ x: 19, y: 9 });
  screenshotBytes['house-crossing'] = await page.screenshot({ animations: 'disabled', scale: 'css' });

  const overlaySignatures = [...treeSamples, ...houseSamples].map(({ overlays }) => overlays.map(({ id, frame, layer, tileX, tileY, depth, displayList, visible }) => ({
    id, frame, layer, tileX, tileY, depth, displayList, visible,
  })));
  expect(overlaySignatures).toHaveLength(treeSamples.length + houseSamples.length);
  expect(overlaySignatures.every((signature) => JSON.stringify(signature) === JSON.stringify(overlaySignatures[0]))).toBe(true);
  expect(overlaySignatures[0]?.map(({ id }) => id)).toEqual(expectedOverlayIds);
  expect(overlaySignatures.every((signature) => signature.every(({ visible }) => visible))).toBe(true);

  const screenshots: Record<string, { file: string; sha256: string; bytes: number }> = {};
  for (const [name, samples] of [['tree-crossing', treeSamples], ['house-crossing', houseSamples]] as const) {
    const screenshot = screenshotBytes[name]!;
    if (saveEvidence) await fs.writeFile(path.join(evidenceDirectory, 'screenshots', `${name}.png`), screenshot);
    screenshots[name] = { file: `screenshots/${name}.png`, sha256: sha256(screenshot), bytes: screenshot.byteLength };
    await testInfo.attach(`${name}.png`, { body: screenshot, contentType: 'image/png' });
    expect(samples.some(({ moving, player }) => moving && /-(contact-a|contact-b|passing)$/.test(player.frame ?? ''))).toBe(true);
  }

  const requiredAssets = [
    `/${manifestFiles.mapManifest}`, `/${manifestFiles.mapAtlas}`, `/${manifestFiles.animationManifest}`, `/${manifestFiles.animationAtlas}`,
  ];
  expect(requests).toEqual(expect.arrayContaining(requiredAssets));
  expect(requestFailures).toEqual([]);
  expect(httpFailures).toEqual([]);
  expect(pageErrors).toEqual([]);

  const evidence = {
    schemaVersion: 1,
    generatedBy: 'tests/e2e/gate1-mapscene-pixel32-overlay-walkframe-depth.spec.ts',
    candidate: { route: candidateQuery, map: mapManifest, animation: animationManifest, inputHashes },
    viewport: { width: 1280, height: 900, dpr: 1, screenshotScale: 'css' },
    anchors: {
      treeCanopy: { worldFootY: 320, overlayDepth: treeDepth, crossing: { from: { x: 19, y: 3 }, to: { x: 19, y: 5 } }, samples: treeSamples },
      houseFront: { worldFootY: 704, overlayDepth: houseDepth, crossing: { from: { x: 19, y: 13 }, to: { x: 19, y: 9 } }, samples: houseSamples },
    },
    overlaySignatureStable: true,
    screenshots,
    assetRequests: requests,
    assetFailures: requestFailures,
    assetHttpFailures: httpFailures,
    pageErrors,
    isolation: { exactDevOnlyQuery: true, productionAssetsModified: false, mapCollisionSaveSchemaOrGameplayModified: false },
    limitations: [
      'Chromium emulation only; no native iOS or Android evidence.',
      'This records walk-frame timing and numeric depth ordering, not pixel-perfect occlusion quality or artistic approval.',
      'The full 12x10 game scene, exact candidate approval, and Gate 1 sign-off remain pending.',
    ],
  };
  const body = `${JSON.stringify(evidence, null, 2)}\n`;
  if (saveEvidence) await fs.writeFile(path.join(evidenceDirectory, 'evidence.json'), body);
  await testInfo.attach('gate1-pixel32-overlay-walkframe-depth.json', { body, contentType: 'application/json' });
});
