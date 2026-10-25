import { expect, test, type Page } from '@playwright/test';

const runtimeQuery = '?renderProfile=pixel32&gate1Runtime=pixel32-map-animation';
const overlayQuery = `${runtimeQuery}&gate1OverlayPreview=pixel32-overlay-12x10`;
const nodeProcess = (globalThis as typeof globalThis & { process?: { cwd(): string; env?: Record<string, string | undefined> } }).process;
const saveEvidence = nodeProcess?.env?.SAVE_GATE1_PIXEL32_OVERLAY_EVIDENCE === '1';
const evidencePath = 'docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-overlay-scene';
const occlusionEvidencePath = 'docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-overlay-occlusion';

type OcclusionCapture = {
  scenario: 'house-behind' | 'house-front' | 'tree-behind' | 'tree-front';
  player: { x: number; y: number; footY: number; left: number; top: number; width: number; height: number };
  playerSnapshotDiffPixels: number;
  screenshot: Awaited<ReturnType<Page['screenshot']>>;
};

async function placePlayerAt(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(({ x, y }) => new Promise<void>((resolve, reject) => {
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
  await expect.poll(() => page.evaluate(() => {
    const tile = window.__dewhollow?.movement().tile;
    return tile ? { x: tile.x, y: tile.y } : null;
  })).toEqual({ x, y });
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateOverlays().overlays.length ?? 0)).toBe(3);
}

async function capturePlayerVisibility(
  page: Page,
  scenario: OcclusionCapture['scenario'],
  x: number,
  y: number,
  resolveEvidencePath: (filename: string) => string,
): Promise<OcclusionCapture> {
  await placePlayerAt(page, x, y);
  const geometry = await page.evaluate(async () => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('Missing DEV scene diagnostics');
    await debug.pauseScene();
    debug.setPose('down', 0, 0);
    const player = debug.actors().find((actor) => actor.id === 'player');
    if (!player) throw new Error('Missing player actor');
    const readPixels = async (): Promise<{ width: number; height: number; data: Uint8ClampedArray }> => {
      const image = new Image();
      image.src = await debug.snapshot();
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Missing 2D canvas context');
      context.drawImage(image, 0, 0);
      return { width: canvas.width, height: canvas.height, data: context.getImageData(0, 0, canvas.width, canvas.height).data };
    };
    let shown: Awaited<ReturnType<typeof readPixels>>;
    let hidden: Awaited<ReturnType<typeof readPixels>>;
    try {
      debug.setPlayerHidden(false);
      shown = await readPixels();
      debug.setPlayerHidden(true);
      hidden = await readPixels();
    } finally {
      debug.setPlayerHidden(false);
    }
    if (shown.width !== hidden.width || shown.height !== hidden.height) throw new Error('Snapshot dimensions changed during visibility capture');
    let playerSnapshotDiffPixels = 0;
    for (let i = 0; i < shown.data.length; i += 4) {
      if (shown.data[i] !== hidden.data[i] || shown.data[i + 1] !== hidden.data[i + 1]
        || shown.data[i + 2] !== hidden.data[i + 2] || shown.data[i + 3] !== hidden.data[i + 3]) playerSnapshotDiffPixels += 1;
    }
    return {
      player: { x: player.tileX, y: player.tileY, footY: player.footY, left: player.left, top: player.top, width: player.width, height: player.height },
      playerSnapshotDiffPixels,
    };
  });
  expect(geometry.player).toMatchObject({ x, y });
  expect(geometry.playerSnapshotDiffPixels, `${scenario}: showing the player must change rendered pixels`).toBeGreaterThan(0);
  const screenshot = await page.screenshot({
    path: saveEvidence ? resolveEvidencePath(`${scenario}.png`) : undefined,
    animations: 'disabled',
    scale: 'css',
  });
  return { scenario, player: geometry.player, playerSnapshotDiffPixels: geometry.playerSnapshotDiffPixels, screenshot };
}

test('renders unapproved pixel32 overlays only in the explicit DEV review route', async ({ page }) => {
  const fs = await import('node:' + 'fs/promises');
  const path = await import('node:' + 'path');
  const crypto = await import('node:' + 'crypto');
  const resolveEvidencePath = (filename: string) => path.resolve(nodeProcess?.cwd() ?? '.', evidencePath, filename);
  const evidenceDirectory = path.resolve(nodeProcess?.cwd() ?? '.', evidencePath);
  if (saveEvidence) await fs.mkdir(evidenceDirectory, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(runtimeQuery);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().enabled ?? false)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateOverlays().enabled ?? false)).toBe(false);
  expect(await page.evaluate(() => window.__dewhollow?.pixel32CandidateOverlays().overlays ?? [])).toEqual([]);

  await page.goto(overlayQuery);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateOverlays().overlays.length ?? 0)).toBe(3);
  const overlayState = await page.evaluate(() => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('Missing DEV scene diagnostics');
    const art = debug.pixel32CandidateRuntime();
    return {
      runtimeEnabled: art.enabled,
      frames: art.mapFrames,
      scene: debug.pixel32CandidateOverlays(),
    };
  });
  expect(overlayState.runtimeEnabled).toBe(true);
  expect(overlayState.frames).toEqual(expect.arrayContaining(['house-back', 'house-front', 'tree-canopy']));
  expect(overlayState.scene.enabled).toBe(true);
  expect(overlayState.scene.overlays.map(({ id, frame, layer, displayList }) => ({ id, frame, layer, displayList }))).toEqual([
    { id: 'house-back', frame: 'house-back', layer: 'back', displayList: 'world' },
    { id: 'tree-canopy', frame: 'tree-canopy', layer: 'front', displayList: 'scene' },
    { id: 'house-front', frame: 'house-front', layer: 'front', displayList: 'scene' },
  ]);
  const [houseBack, , houseFront] = overlayState.scene.overlays;
  if (!houseBack || !houseFront) throw new Error('Missing house candidate layers');
  expect(houseBack).toMatchObject({ tileX: 3, tileY: 3, visible: true });
  expect(houseFront).toMatchObject({ tileX: 3, tileY: 3, visible: true });
  expect(houseBack.depth).toBe(1);
  expect(houseFront.depth).toBeGreaterThan(1);

  const runtimeScreenshot = await page.screenshot({
    animations: 'disabled',
    scale: 'css',
  });
  if (saveEvidence) await fs.writeFile(resolveEvidencePath('pixel32-mapscene-overlays.png'), runtimeScreenshot);
  await test.info().attach('pixel32-mapscene-overlays.png', { body: runtimeScreenshot, contentType: 'image/png' });

  const occlusionDirectory = path.resolve(nodeProcess?.cwd() ?? '.', occlusionEvidencePath);
  const resolveOcclusionPath = (filename: string) => path.join(occlusionDirectory, filename);
  const occlusionCaptures: OcclusionCapture[] = [];
  for (const [scenario, x, y] of [
    ['house-behind', 4, 3], ['house-front', 4, 5], ['tree-behind', 8, 3], ['tree-front', 8, 5],
  ] as const) {
    occlusionCaptures.push(await capturePlayerVisibility(page, scenario, x, y, resolveOcclusionPath));
  }
  const diffPixelsByScenario = Object.fromEntries(occlusionCaptures.map((capture) => [capture.scenario, capture.playerSnapshotDiffPixels])) as Record<OcclusionCapture['scenario'], number>;
  expect(diffPixelsByScenario['house-front'], 'the fixed house-front position should have a higher shown/hidden snapshot difference count than the house-behind position').toBeGreaterThan(diffPixelsByScenario['house-behind']);
  expect(diffPixelsByScenario['tree-front'], 'the fixed tree-front position should have a higher shown/hidden snapshot difference count than the tree-behind position').toBeGreaterThan(diffPixelsByScenario['tree-behind']);
  for (const capture of occlusionCaptures) {
    await test.info().attach(`${capture.scenario}.png`, { body: capture.screenshot, contentType: 'image/png' });
  }

  await page.goto('/docs/art/candidates/pixel-movement/gate1-preview/');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: 'B · 地圖圖層' }).click();
  await expect(page.locator('#page-title')).toHaveText('pixel32 地圖圖層候選');
  await expect(page.locator('#comparison-copy')).toContainText('房屋共用錨點');
  await expect(page.locator('#limitation-copy')).toContainText('像素級角色遮擋品質');
  const preview = page.locator('#farm-preview');
  await expect.poll(() => preview.getAttribute('data-candidate')).toBe('pixel32-overlays');
  await expect.poll(() => preview.getAttribute('data-overlay-order')).toBe('house-back,tree-canopy,house-front');
  await expect.poll(() => preview.getAttribute('data-overlay-bounds')).toBe(JSON.stringify({
    'house-back': { x: 96, y: 96, width: 96, height: 64 },
    'tree-canopy': { x: 256, y: 96, width: 64, height: 64 },
    'house-front': { x: 96, y: 96, width: 96, height: 64 },
  }));
  await expect(preview).toHaveAttribute('width', '384');
  await expect(preview).toHaveAttribute('height', '320');
  await expect(preview).toHaveAttribute('data-approved', 'false');
  await expect(page.locator('#scene-notes-title')).toHaveText('12 × 10 隔離構圖');
  expect(await page.locator('#scene-notes-list li').allTextContents()).toEqual([
    'pixel32 春季草地與道路', '房屋底層與同錨點前景片', '樹冠、樹幹與前景深度',
  ]);
  await expect(page.locator('#candidate-caption')).toContainText('未核准');

  const screenshot = await page.screenshot({
    path: saveEvidence ? resolveEvidencePath('pixel32-overlays-12x10.png') : undefined,
    animations: 'disabled',
    scale: 'css',
  });
  await test.info().attach('pixel32-overlays-12x10.png', { body: screenshot, contentType: 'image/png' });
  if (saveEvidence) {
    const sha256 = (bytes: Uint8Array) => crypto.createHash('sha256').update(bytes).digest('hex');
    await fs.writeFile(path.join(evidenceDirectory, 'evidence.json'), `${JSON.stringify({
      schemaVersion: 1,
      generatedBy: 'tests/e2e/gate1-mapscene-pixel32-overlay-scene.spec.ts',
      candidateStatus: 'candidate',
      approved: false,
      scene: { widthTiles: 12, heightTiles: 10, nativeTileSize: 32, cssWidth: 384, cssHeight: 320 },
      overlayOrder: overlayState.scene.overlays.map(({ id, frame, layer, tileX, tileY, depth, displayList }) => ({ id, frame, layer, tileX, tileY, depth, displayList })),
      runtime: { enabledOnlyWithExactDevQuery: true, productionAssetsModified: false, mapCollisionOrSaveModified: false },
      screenshot: 'pixel32-overlays-12x10.png',
      screenshots: {
        overlayRuntime: { file: 'pixel32-mapscene-overlays.png', viewport: { width: 1280, height: 900 }, sha256: sha256(runtimeScreenshot) },
        fixedScene: { file: 'pixel32-overlays-12x10.png', viewport: { width: 1280, height: 900 }, sha256: sha256(screenshot) },
      },
      limitations: ['Chromium browser evidence only.', 'This phase records shown-versus-hidden snapshot differences at fixed positions; it is not an exact player mask or occluded-area measurement.', 'Artistic quality, native-device rendering, exact art approval and Gate 1 sign-off remain pending human review.'],
    }, null, 2)}\n`);
    await fs.mkdir(occlusionDirectory, { recursive: true });
    await fs.writeFile(path.join(occlusionDirectory, 'evidence.json'), `${JSON.stringify({
      schemaVersion: 1,
      generatedBy: 'tests/e2e/gate1-mapscene-pixel32-overlay-scene.spec.ts',
      candidateStatus: 'candidate',
      approved: false,
      method: 'Count RGBA pixels that differ between same-render snapshots with the player shown and hidden at a deterministic saved tile; overlay layers and the rest of the scene remain unchanged.',
      viewport: { width: 1280, height: 900, deviceScaleFactor: 1 },
      measurements: occlusionCaptures.map(({ scenario, player, playerSnapshotDiffPixels, screenshot }) => ({
        scenario, player, playerSnapshotDiffPixels, screenshot: `${scenario}.png`, sha256: sha256(screenshot),
      })),
      comparisons: {
        houseFrontHasMoreSnapshotDiffPixels: diffPixelsByScenario['house-front'] > diffPixelsByScenario['house-behind'],
        treeFrontHasMoreSnapshotDiffPixels: diffPixelsByScenario['tree-front'] > diffPixelsByScenario['tree-behind'],
      },
      limitations: ['Chromium browser evidence only.', 'Counts are shown-versus-hidden RGBA snapshot differences, not an exact player alpha mask or occluded area; background-aligned colors can reduce counts.', 'Artistic quality, native-device rendering, exact art approval and Gate 1 sign-off remain pending human review.'],
    }, null, 2)}\n`);
  }
});
