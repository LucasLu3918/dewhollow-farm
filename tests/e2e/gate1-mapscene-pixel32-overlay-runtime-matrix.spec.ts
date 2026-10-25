import { expect, test, type Browser } from '@playwright/test';

const candidateQuery = '?renderProfile=pixel32&gate1Runtime=pixel32-map-animation&gate1OverlayPreview=pixel32-overlay-12x10';
const candidateRoot = 'docs/art/candidates/pixel-movement/gate1-assets';
const evidenceRoot = 'docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-overlay-runtime-matrix';
const viewports = [
  { id: 'phone-portrait-390x844', width: 390, height: 844, touch: true },
  { id: 'phone-landscape-844x390', width: 844, height: 390, touch: true },
  { id: 'tablet-portrait-768x1024', width: 768, height: 1024, touch: true },
  { id: 'desktop-landscape-1280x720', width: 1280, height: 720, touch: false },
  { id: 'desktop-fullhd-1920x1080', width: 1920, height: 1080, touch: false },
] as const;
const dprs = [1, 2, 3] as const;
const expectedOverlays = [
  { id: 'house-back', frame: 'house-back', layer: 'back', tileX: 3, tileY: 3, displayList: 'world' },
  { id: 'tree-canopy', frame: 'tree-canopy', layer: 'front', tileX: 8, tileY: 3, displayList: 'scene' },
  { id: 'house-front', frame: 'house-front', layer: 'front', tileX: 3, tileY: 3, displayList: 'scene' },
] as const;
const nodeProcess = (globalThis as typeof globalThis & {
  process?: { cwd(): string; env?: Record<string, string | undefined> };
}).process;
const saveEvidence = nodeProcess?.env?.SAVE_GATE1_PIXEL32_OVERLAY_RUNTIME_EVIDENCE === '1';

type Manifest = { status: string; approved: boolean; atlas: { file: string } };

async function openCandidate(browser: Browser, viewport: typeof viewports[number], dpr: number) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: dpr,
    isMobile: viewport.touch,
    hasTouch: viewport.touch,
  });
  const page = await context.newPage();
  const candidateRequests: string[] = [];
  const candidateFailures: string[] = [];
  const candidateHttpFailures: string[] = [];
  const pageErrors: string[] = [];
  const assetFragments = [
    `${candidateRoot}/pixel32-map/manifest.json`,
    `${candidateRoot}/pixel32-map/map-atlas.png`,
    `${candidateRoot}/pixel32-animation/manifest.json`,
    `${candidateRoot}/pixel32-animation/player-4dir.png`,
  ];
  page.on('request', (request) => {
    if (assetFragments.some((fragment) => request.url().includes(fragment))) candidateRequests.push(new URL(request.url()).pathname);
  });
  page.on('requestfailed', (request) => {
    if (assetFragments.some((fragment) => request.url().includes(fragment))) candidateFailures.push(request.url());
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && assetFragments.some((fragment) => response.url().includes(fragment))) {
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
          mapId: 'farm', player: { x: 5, y: 5, facing: 'down' }, plots: {},
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
  }));
  await page.reload();
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const tile = window.__dewhollow?.movement().tile;
    return tile ? { x: tile.x, y: tile.y } : null;
  })).toEqual({ x: 5, y: 5 });
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateOverlays().overlays.length ?? 0)).toBe(3);
  return { context, page, candidateRequests, candidateFailures, candidateHttpFailures, pageErrors };
}

test('captures pixel32 house/tree candidate overlays across five viewports and three Chromium DPR values', async ({ browser }, testInfo) => {
  test.setTimeout(10 * 60_000);
  const fs = await import('node:' + 'fs/promises');
  const path = await import('node:' + 'path');
  const crypto = await import('node:' + 'crypto');
  const resolvePath = (repositoryPath: string) => path.resolve(nodeProcess?.cwd() ?? '.', repositoryPath);
  const sha256 = (bytes: Uint8Array) => crypto.createHash('sha256').update(bytes).digest('hex');
  const fileSha256 = async (repositoryPath: string) => sha256(await fs.readFile(resolvePath(repositoryPath)));
  const loadCandidate = async (pathName: string, atlasName: string): Promise<Manifest> => {
    const manifest = JSON.parse(await fs.readFile(resolvePath(pathName), 'utf8')) as Manifest;
    expect(manifest.status, `${pathName} remains a candidate`).toBe('candidate');
    expect(manifest.approved, `${pathName} remains unapproved`).toBe(false);
    expect(manifest.atlas.file).toBe(atlasName);
    return manifest;
  };
  const screenshotsRoot = `${evidenceRoot}/screenshots`;
  if (saveEvidence) await fs.mkdir(resolvePath(screenshotsRoot), { recursive: true });

  const mapManifest = await loadCandidate(`${candidateRoot}/pixel32-map/manifest.json`, 'map-atlas.png');
  const animationManifest = await loadCandidate(`${candidateRoot}/pixel32-animation/manifest.json`, 'player-4dir.png');
  const candidateInputs = {
    mapManifestSha256: await fileSha256(`${candidateRoot}/pixel32-map/manifest.json`),
    mapAtlasSha256: await fileSha256(`${candidateRoot}/pixel32-map/${mapManifest.atlas.file}`),
    animationManifestSha256: await fileSha256(`${candidateRoot}/pixel32-animation/manifest.json`),
    animationAtlasSha256: await fileSha256(`${candidateRoot}/pixel32-animation/${animationManifest.atlas.file}`),
  };
  const measurements: Record<string, unknown>[] = [];

  for (const viewport of viewports) {
    for (const dpr of dprs) {
      const { context, page, candidateRequests, candidateFailures, candidateHttpFailures, pageErrors } = await openCandidate(browser, viewport, dpr);
      await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().playerFrame ?? '')).toBe('down-idle');
      const state = await page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
        const debug = window.__dewhollow;
        if (!canvas || !debug) throw new Error('缺少 MapScene canvas 或 DEV 診斷');
        const rect = canvas.getBoundingClientRect();
        const viewportInfo = debug.pixelViewport();
        const overlays = debug.pixel32CandidateOverlays();
        const playerTile = debug.movement().tile;
        return {
          mapId: debug.mapId(),
          playerTile,
          browserDpr: window.devicePixelRatio,
          canvasCss: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          canvasPixels: { width: canvas.width, height: canvas.height },
          renderResolution: viewportInfo.renderResolution,
          visibleTiles: viewportInfo.actualWorldTilesVisible,
          cameraZoom: viewportInfo.cameraZoom,
          runtime: debug.pixel32CandidateRuntime(),
          overlays,
        };
      });

      expect(state.mapId).toBe('farm');
      expect(state.playerTile).toEqual({ x: 5, y: 5, facing: 'down' });
      expect(state.browserDpr).toBe(dpr);
      expect(state.runtime.enabled).toBe(true);
      expect(state.runtime.playerFrame).toBe('down-idle');
      expect(state.runtime.mapFrames).toEqual(expect.arrayContaining(expectedOverlays.map(({ frame }) => frame)));
      expect(state.canvasCss.width).toBeGreaterThan(0);
      expect(state.canvasCss.height).toBeGreaterThan(0);
      expect(state.canvasPixels).toEqual(state.renderResolution);
      expect(state.visibleTiles.width).toBeGreaterThan(0);
      expect(state.visibleTiles.height).toBeGreaterThan(0);
      expect(state.cameraZoom).toBeGreaterThan(0);
      expect(state.overlays.enabled).toBe(true);
      expect(state.overlays.overlays).toEqual(expectedOverlays.map((expected) => ({ ...expected, depth: expect.any(Number), visible: true })));
      expect(state.overlays.overlays.every(({ tileX, tileY }) => tileX >= 0 && tileY >= 0 && tileX < 12 && tileY < 10)).toBe(true);
      expect(candidateRequests).toEqual(expect.arrayContaining([
        `/${candidateRoot}/pixel32-map/manifest.json`,
        `/${candidateRoot}/pixel32-map/map-atlas.png`,
        `/${candidateRoot}/pixel32-animation/manifest.json`,
        `/${candidateRoot}/pixel32-animation/player-4dir.png`,
      ]));
      expect(candidateFailures).toEqual([]);
      expect(candidateHttpFailures).toEqual([]);
      expect(pageErrors).toEqual([]);

      await page.evaluate(() => window.__dewhollow?.pauseScene({ preservePose: false }));
      const filename = `${viewport.id}-dpr-${dpr}.png`;
      const screenshot = await page.screenshot({
        path: saveEvidence ? resolvePath(path.join(screenshotsRoot, filename)) : undefined,
        animations: 'disabled',
        scale: 'css',
      });
      measurements.push({
        viewport: { id: viewport.id, width: viewport.width, height: viewport.height, touch: viewport.touch },
        requestedDpr: dpr,
        browserDpr: state.browserDpr,
        mapId: state.mapId,
        playerTile: state.playerTile,
        runtimeEnabled: state.runtime.enabled,
        playerFrame: state.runtime.playerFrame,
        canvasCss: state.canvasCss,
        canvasPixels: state.canvasPixels,
        renderResolution: state.renderResolution,
        visibleTiles: state.visibleTiles,
        cameraZoom: state.cameraZoom,
        overlayState: state.overlays,
        candidateRequests,
        candidateFailures,
        candidateHttpFailures,
        pageErrors,
        screenshot: `screenshots/${filename}`,
        screenshotScale: 'css',
        sha256: sha256(screenshot),
      });
      await testInfo.attach(filename, { body: screenshot, contentType: 'image/png' });
      await context.close();
    }
  }

  expect(measurements).toHaveLength(viewports.length * dprs.length);
  const evidence = {
    schemaVersion: 1,
    generatedBy: 'tests/e2e/gate1-mapscene-pixel32-overlay-runtime-matrix.spec.ts',
    evidenceMode: saveEvidence ? 'saved-to-repository' : 'playwright-attachments',
    candidate: {
      map: { status: mapManifest.status, approved: mapManifest.approved },
      animation: { status: animationManifest.status, approved: animationManifest.approved },
      inputs: candidateInputs,
      overlayFrames: expectedOverlays,
    },
    claim: '15 Chromium-emulated CSS-scale screenshots of the same DEV-only pixel32 farm MapScene with the unapproved house/tree overlay fixture and a deterministic QA save at player tile (5,5). This does not establish native-device rendering, exact DPR raster output, art approval, complete asset coverage, or Gate 1 completion.',
    viewports,
    dprs,
    measurements,
    limitations: [
      'Chromium viewport and deviceScaleFactor emulation only; screenshots are CSS-scale, not native DPR raster evidence.',
      'The overlay layer positions and candidate loading are machine-checked; visual readability, artistic quality, seams, movement stability, and exact art approval remain human review items.',
      'All candidate inputs remain status candidate and approved false; native iOS/Android behavior remains DEVICE_PENDING.',
    ],
  };
  const body = `${JSON.stringify(evidence, null, 2)}\n`;
  if (saveEvidence) await fs.writeFile(resolvePath(`${evidenceRoot}/evidence.json`), body);
  await testInfo.attach('gate1-pixel32-overlay-runtime-matrix.json', { body, contentType: 'application/json' });
});
