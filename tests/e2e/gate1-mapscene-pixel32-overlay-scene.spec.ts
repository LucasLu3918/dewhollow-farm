import { expect, test } from '@playwright/test';

const runtimeQuery = '?renderProfile=pixel32&gate1Runtime=pixel32-map-animation';
const overlayQuery = `${runtimeQuery}&gate1OverlayPreview=pixel32-overlay-12x10`;
const nodeProcess = (globalThis as typeof globalThis & { process?: { cwd(): string; env?: Record<string, string | undefined> } }).process;
const saveEvidence = nodeProcess?.env?.SAVE_GATE1_PIXEL32_OVERLAY_EVIDENCE === '1';
const evidencePath = 'docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-overlay-scene';

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
    path: saveEvidence ? resolveEvidencePath('pixel32-mapscene-overlays.png') : undefined,
    animations: 'disabled',
    scale: 'css',
  });
  await test.info().attach('pixel32-mapscene-overlays.png', { body: runtimeScreenshot, contentType: 'image/png' });

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
      limitations: ['Chromium browser evidence only.', 'Depth ordering is measured; pixel-level actor occlusion quality is not validated.', 'Exact art approval remains pending human review.'],
    }, null, 2)}\n`);
  }
});
