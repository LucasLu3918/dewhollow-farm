import { expect, test } from '@playwright/test';

const candidateQuery = '?renderProfile=pixel32&gate1Runtime=pixel32-map-animation&gate1OverlayPreview=pixel32-overlay-12x10';
const candidateRoot = 'docs/art/candidates/pixel-movement/gate1-assets';
const evidenceRoot = 'docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-scene-composition-12x10';
const nodeProcess = (globalThis as typeof globalThis & {
  process?: { cwd(): string; env?: Record<string, string | undefined> };
}).process;
const saveEvidence = nodeProcess?.env?.SAVE_GATE1_PIXEL32_SCENE_COMPOSITION_EVIDENCE === '1';

test('captures a 12x10 pixel32 candidate farm composition with explicit fallbacks', async ({ browser }, testInfo) => {
  test.setTimeout(90_000);
  const fs = await import('node:' + 'fs/promises');
  const path = await import('node:' + 'path');
  const crypto = await import('node:' + 'crypto');
  const root = path.resolve(nodeProcess?.cwd() ?? '.', evidenceRoot);
  if (saveEvidence) await fs.mkdir(path.join(root, 'screenshots'), { recursive: true });

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const candidateRequests: string[] = [];
  const candidateFailures: string[] = [];
  const candidateHttpFailures: string[] = [];
  const pageErrors: string[] = [];
  const candidateFragments = [
    `${candidateRoot}/pixel32-map/manifest.json`,
    `${candidateRoot}/pixel32-map/map-atlas.png`,
    `${candidateRoot}/pixel32-animation/manifest.json`,
    `${candidateRoot}/pixel32-animation/player-4dir.png`,
  ];
  page.on('request', (request) => {
    if (candidateFragments.some((fragment) => request.url().includes(fragment))) candidateRequests.push(new URL(request.url()).pathname);
  });
  page.on('requestfailed', (request) => {
    if (candidateFragments.some((fragment) => request.url().includes(fragment))) candidateFailures.push(request.url());
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && candidateFragments.some((fragment) => response.url().includes(fragment))) {
      candidateHttpFailures.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    const original = Math.random;
    let first = true;
    Math.random = () => {
      if (first) {
        first = false;
        Math.random = original;
        return 0;
      }
      return original();
    };
  });
  await page.goto(candidateQuery);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().enabled ?? false)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateOverlays().enabled ?? false)).toBe(true);

  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('saves', 'readwrite');
      transaction.objectStore('saves').put({
        slot: 'slot-1',
        savedAt: '2026-10-25T00:00:00.000Z',
        state: {
          schemaVersion: 13,
          calendar: { year: 1, season: 'spring', day: 4, minuteOfDay: 600 },
          weather: 'sunny', forecast: 'sunny', energy: { current: 100, max: 100 }, gold: 600,
          mapId: 'farm', player: { x: 11, y: 25, facing: 'down' },
          plots: {
            '10,26': { watered: false, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 0 } },
            '11,26': { watered: true, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 1 } },
            '12,26': { watered: false, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 3 } },
          },
          inventory: { capacity: 24, stacks: [] }, shipBox: { entries: [] }, flags: {}, rng: 12345,
          tool: 'hoe', toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 },
          worldChanges: {}, skills: { farming: 0, foraging: 0, fishing: 0, mining: 0, cooking: 0 }, talents: {},
          animals: [], cows: [], sheep: [], processing: [], fishing: null, mineSeed: 1, mineCheckpoint: 1,
          selectedSeed: 'sweet-radish', playtimeSeconds: 0,
        },
      });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    }
  }));
  await page.reload();
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateOverlays().overlays.length ?? 0)).toBe(3);
  await page.evaluate(() => window.__dewhollow?.pauseScene({ preservePose: false }));

  const state = await page.evaluate(() => {
    const debug = window.__dewhollow;
    const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
    if (!debug || !canvas) throw new Error('Missing candidate runtime diagnostics or canvas');
    const rect = canvas.getBoundingClientRect();
    const viewport = debug.pixelViewport();
    const actors = debug.actors();
    const sprites = debug.sprites();
    return {
      mapId: debug.mapId(),
      runtime: debug.pixel32CandidateRuntime(),
      overlays: debug.pixel32CandidateOverlays(),
      candidateArt: debug.candidateArt(),
      viewport,
      camera: debug.cameraView(),
      canvasCss: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      actors,
      crops: sprites.filter((sprite) => sprite.key === 'crop.sweet-radish').map(({ key, frame, left, top, width, height, depth }) => ({ key, frame, left, top, width, height, depth })),
      candidateGround: sprites.filter((sprite) => sprite.key === 'gate1-pixel32-map-atlas' && sprite.frame !== null)
        .map(({ frame }) => frame),
    };
  });

  expect(state.mapId).toBe('farm');
  expect(state.runtime.enabled).toBe(true);
  expect(state.runtime.playerFrame).toBe('down-idle');
  expect(state.runtime.mapFrames).toContain('spring-grass');
  expect(state.runtime.mapFrames).toContain('spring-field-edge-0');
  expect(state.overlays.enabled).toBe(true);
  expect(state.overlays.overlays.map(({ id, frame, layer, visible }) => ({ id, frame, layer, visible }))).toEqual([
    { id: 'house-back', frame: 'house-back', layer: 'back', visible: true },
    { id: 'tree-canopy', frame: 'tree-canopy', layer: 'front', visible: true },
    { id: 'house-front', frame: 'house-front', layer: 'front', visible: true },
  ]);
  expect(state.viewport.actualWorldTilesVisible.width).toBeGreaterThanOrEqual(12);
  expect(state.viewport.actualWorldTilesVisible.height).toBeGreaterThanOrEqual(10);
  expect(state.canvasCss.width).toBeGreaterThan(0);
  expect(state.canvasCss.height).toBeGreaterThan(0);
  expect(state.candidateGround.length).toBeGreaterThan(0);
  expect(state.crops).toHaveLength(3);
  expect(state.actors.some((actor) => actor.id === 'player')).toBe(true);
  expect(state.actors.some((actor) => actor.id === 'cat')).toBe(true);
  expect(state.candidateArt.fallbackAssetIds).toContain('pet.cat');
  expect(state.candidateArt.fallbackAssetIds).toContain('crop.sweet-radish');

  const mapManifestPath = path.resolve(nodeProcess?.cwd() ?? '.', `${candidateRoot}/pixel32-map/manifest.json`);
  const animationManifestPath = path.resolve(nodeProcess?.cwd() ?? '.', `${candidateRoot}/pixel32-animation/manifest.json`);
  const mapManifest = JSON.parse(await fs.readFile(mapManifestPath, 'utf8')) as { status: string; approved: boolean; atlas: { file: string } };
  const animationManifest = JSON.parse(await fs.readFile(animationManifestPath, 'utf8')) as { status: string; approved: boolean; atlas: { file: string } };
  expect(mapManifest).toMatchObject({ status: 'candidate', approved: false, atlas: { file: 'map-atlas.png' } });
  expect(animationManifest).toMatchObject({ status: 'candidate', approved: false, atlas: { file: 'player-4dir.png' } });
  const sha256 = (bytes: Uint8Array) => crypto.createHash('sha256').update(bytes).digest('hex');
  const candidateInputs = {
    mapManifestSha256: sha256(await fs.readFile(mapManifestPath)),
    mapAtlasSha256: sha256(await fs.readFile(path.resolve(path.dirname(mapManifestPath), mapManifest.atlas.file))),
    animationManifestSha256: sha256(await fs.readFile(animationManifestPath)),
    animationAtlasSha256: sha256(await fs.readFile(path.resolve(path.dirname(animationManifestPath), animationManifest.atlas.file))),
  };
  const screenshotPath = path.join(root, 'screenshots', 'scene-12x10.png');
  const screenshot = await page.screenshot({
    path: saveEvidence ? screenshotPath : undefined,
    animations: 'disabled',
    scale: 'css',
  });
  const evidence = {
    schemaVersion: 1,
    generatedBy: 'tests/e2e/gate1-mapscene-pixel32-scene-composition-12x10.spec.ts',
    route: candidateQuery,
    claim: 'DEV-only farm MapScene candidate composition with a 12x10 or larger camera-visible world region. Existing map/player/house/tree candidate inputs are loaded; crops and cat remain existing-art fallbacks.',
    candidate: {
      map: { status: mapManifest.status, approved: mapManifest.approved },
      animation: { status: animationManifest.status, approved: animationManifest.approved },
      inputs: candidateInputs,
      groundFrames: [...new Set(state.candidateGround)],
      overlays: state.overlays.overlays,
    },
    viewport: { width: 1280, height: 900, dpr: 1, screenshotScale: 'css', canvasCss: state.canvasCss },
    camera: { ...state.camera, actualWorldTilesVisible: state.viewport.actualWorldTilesVisible },
    coverage: {
      visibleActors: state.actors.map(({ id, tileX, tileY, depth }) => ({ id, tileX, tileY, depth })),
      fallbackAssetIds: state.candidateArt.fallbackAssetIds,
      representativeCrops: state.crops,
    },
    candidateRequests,
    candidateFailures,
    candidateHttpFailures,
    pageErrors,
    screenshot: { path: 'screenshots/scene-12x10.png', sha256: sha256(screenshot), bytes: screenshot.byteLength },
    limitations: [
      'The screenshot is a CSS-scale Chromium capture, not native DPR raster or iOS/Android device evidence.',
      'Crop, cat, tool and NPC art not covered by the candidate atlases remain existing-art fallbacks.',
      'Candidate manifests remain status candidate and approved false; this is not exact asset approval or Gate 1 acceptance.',
      'The IndexedDB v13 save is seeded in this isolated Playwright context only.',
    ],
  };
  expect(candidateRequests).toEqual(expect.arrayContaining(candidateFragments.map((fragment) => `/${fragment}`)));
  expect(candidateFailures).toEqual([]);
  expect(candidateHttpFailures).toEqual([]);
  expect(pageErrors).toEqual([]);
  await testInfo.attach('pixel32-scene-composition-12x10.png', { body: screenshot, contentType: 'image/png' });
  const report = `${JSON.stringify(evidence, null, 2)}\n`;
  await testInfo.attach('pixel32-scene-composition-12x10.json', { body: report, contentType: 'application/json' });
  if (saveEvidence) await fs.writeFile(path.join(root, 'evidence.json'), report);
  await context.close();
});
