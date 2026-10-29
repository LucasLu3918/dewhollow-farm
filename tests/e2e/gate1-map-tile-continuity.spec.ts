import { expect, test } from '@playwright/test';

const nodeProcess = (globalThis as typeof globalThis & {
  process?: { cwd(): string; env?: Record<string, string | undefined> };
}).process;
const candidateDirectory = 'docs/art/candidates/pixel-movement/gate1-assets/pixel32-map';
const evidenceDirectory = 'docs/art/candidates/pixel-movement/gate1-map-tile-continuity';
const screenshotsDirectory = `${evidenceDirectory}/screenshots`;
const saveEvidence = nodeProcess?.env?.SAVE_TILING_CONTINUITY_EVIDENCE === '1';
const seasonNames: Record<string, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };

test('captures four-season surface seams, wall corners, ground shadow alpha and all field autotile masks', async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const fs = await import('node:' + 'fs/promises');
  const path = await import('node:' + 'path');
  const crypto = await import('node:' + 'crypto');
  const repoRoot = path.resolve(nodeProcess?.cwd() ?? '.');
  const sha256 = (bytes: Uint8Array) => crypto.createHash('sha256').update(bytes).digest('hex');
  const pageErrors: string[] = [];
  const requestFailures: string[] = [];
  const badResponses: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (requestEvent) => requestFailures.push(`${requestEvent.method()} ${requestEvent.url()}`));
  page.on('response', (response) => {
    if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
  });

  const manifestPath = path.join(repoRoot, candidateDirectory, 'manifest.json');
  const manifestBytes = await fs.readFile(manifestPath);
  const manifestSha256 = sha256(manifestBytes);
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as {
    status: string;
    approved: boolean;
    source: { generator: string; generatorSha256: string };
    atlas: { file: string; sha256: string; width: number; height: number };
    seasons: string[];
    frames: Record<string, { approved?: boolean; season?: string; surface?: string; tileable?: boolean; kind?: string; corner?: string; autotileMask?: number }>;
  };
  const atlasBytes = await fs.readFile(path.join(repoRoot, candidateDirectory, manifest.atlas.file));
  const generatorPath = path.join(repoRoot, manifest.source.generator);
  const generatorBytes = await fs.readFile(generatorPath);
  const sourceHashes = {
    manifestSha256,
    atlasSha256: sha256(atlasBytes),
    generatorSha256: sha256(generatorBytes),
  };
  expect(manifest.status).toBe('candidate');
  expect(manifest.approved).toBe(false);
  expect(sourceHashes.atlasSha256).toBe(manifest.atlas.sha256);
  expect(sourceHashes.generatorSha256).toBe(manifest.source.generatorSha256);
  expect(manifest.seasons).toEqual(['spring', 'summer', 'autumn', 'winter']);

  const seasonalSurfaces = ['grass', 'field', 'path', 'water', 'dry-soil', 'wet-soil'];
  const expectedIds = manifest.seasons.flatMap((season) => [
    ...seasonalSurfaces.map((surface) => `${season}-${surface}`),
    ...Array.from({ length: 16 }, (_, mask) => `${season}-field-edge-${mask.toString(16)}`),
  ]);
  const sharedIds = ['wood-floor', 'wall-corner-nw', 'wall-corner-ne', 'wall-corner-sw', 'wall-corner-se', 'ground-shadow'];
  expect(expectedIds.every((id) => manifest.frames[id]?.approved === false)).toBe(true);
  expect(sharedIds.every((id) => manifest.frames[id]?.approved === false)).toBe(true);
  expect(seasonalSurfaces.every((surface) => manifest.seasons.every((season) => manifest.frames[`${season}-${surface}`]?.tileable === true))).toBe(true);
  expect(manifest.frames['wood-floor']?.tileable).toBe(true);
  const previewUrl = `/docs/art/candidates/pixel-movement/gate1-assets/pixel32-map/continuity.html`;
  const previewResponse = await request.get(previewUrl);
  expect(previewResponse.ok()).toBe(true);
  await page.setViewportSize({ width: 1280, height: 1080 });
  await page.goto(previewUrl);
  await expect(page.locator('#readout')).toContainText('approved=false');

  const results: Array<{
    season: string;
    screenshot: string;
    screenshotSha256: string;
    screenshotDimensions: { width: number; height: number };
    loadedFrameIds: string[];
    maskIds: string[];
    frameCounts: {
      baseSurfaces: Array<{ surface: string; sourceFrameCount: number; displayedTileCount: number }>;
      fieldEdge: { sourceFrameCount: number; displayedTileCount: number };
      mixedBoundary: { uniqueSourceFrameCount: number; displayedTileCount: number };
      details: { wallCornerIds: string[]; shadowId: string; shadowAlpha: { transparentPixels: number; partialAlphaPixels: number; opaquePixels: number; transparentBorderPixels: number } };
      uniqueSourceFramesLoaded: number;
    };
    metrics: Array<{ surface: string; exactMatchCount: number; meanRgbaDelta: number; maxRgbaDelta: number; sampleCount: number; passed: boolean; sourceFrameCount?: number; displayedTileCount?: number }>;
    hashes: typeof sourceHashes;
  }> = [];
  if (saveEvidence) await fs.mkdir(path.resolve(repoRoot, screenshotsDirectory), { recursive: true });

  for (const season of manifest.seasons) {
    await page.getByRole('button', { name: seasonNames[season], exact: true }).click();
    const repeatPreview = page.locator('#repeat-preview');
    await expect(repeatPreview).toHaveAttribute('data-season', season);
    await expect(repeatPreview).toHaveAttribute('data-candidate-status', 'candidate');
    await expect(repeatPreview).toHaveAttribute('data-approved', 'false');
    await expect(repeatPreview).toHaveAttribute('data-manifest-sha256', sourceHashes.manifestSha256);
    await expect(repeatPreview).toHaveAttribute('data-atlas-sha256', sourceHashes.atlasSha256);
    await expect(repeatPreview).toHaveAttribute('data-generator-sha256', sourceHashes.generatorSha256);

    const observed = await repeatPreview.evaluate((canvas) => {
      const element = canvas as HTMLCanvasElement & { dataset: DOMStringMap };
      return {
        loadedFrameIds: [...new Set((element.dataset.loadedFrameIds ?? '').split(',').filter(Boolean))],
        maskIds: (element.dataset.maskIds ?? '').split(',').filter(Boolean),
        frameCounts: JSON.parse(element.dataset.frameCounts ?? '{}') as {
          baseSurfaces: Array<{ surface: string; sourceFrameCount: number; displayedTileCount: number }>;
          fieldEdge: { sourceFrameCount: number; displayedTileCount: number };
          mixedBoundary: { uniqueSourceFrameCount: number; displayedTileCount: number };
          details: { wallCornerIds: string[]; shadowId: string; shadowAlpha: { transparentPixels: number; partialAlphaPixels: number; opaquePixels: number; transparentBorderPixels: number } };
          uniqueSourceFramesLoaded: number;
        },
        metrics: JSON.parse(element.dataset.metrics ?? '[]') as Array<{ surface: string; exactMatchCount: number; meanRgbaDelta: number; maxRgbaDelta: number; sampleCount: number; passed: boolean }>,
        mixedCellFrames: (element.dataset.mixedCellFrames ?? '').split(',').filter(Boolean),
        mixedMaskIds: (element.dataset.mixedMaskIds ?? '').split(',').filter(Boolean),
        mixedBoundaryAssumption: element.dataset.mixedBoundaryAssumption,
        tileableSurfaceIds: (element.dataset.tileableSurfaceIds ?? '').split(',').filter(Boolean),
        seamPassed: element.dataset.seamPassed,
      };
    });
    const details = await page.locator('#details-preview').evaluate((canvas) => {
      const element = canvas as HTMLCanvasElement & { dataset: DOMStringMap };
      return {
        wallCornerIds: (element.dataset.wallCornerIds ?? '').split(',').filter(Boolean),
        shadowId: element.dataset.shadowId,
        shadowAlpha: JSON.parse(element.dataset.shadowAlpha ?? '{}') as { transparentPixels: number; partialAlphaPixels: number; opaquePixels: number; transparentBorderPixels: number },
        candidateStatus: element.dataset.candidateStatus,
        approved: element.dataset.approved,
      };
    });
    observed.loadedFrameIds.sort();
    expect(observed.loadedFrameIds).toEqual([...expectedIds.filter((id) => id.startsWith(`${season}-`)), ...sharedIds].sort());
    expect(observed.maskIds).toEqual(Array.from({ length: 16 }, (_, mask) => `${season}-field-edge-${mask.toString(16)}`));
    expect(observed.tileableSurfaceIds).toEqual([...seasonalSurfaces.map((surface) => `${season}-${surface}`), 'wood-floor']);
    expect(observed.seamPassed).toBe('true');
    expect(observed.frameCounts.baseSurfaces).toEqual([...seasonalSurfaces, 'wood-floor'].map((surface) => ({ surface, sourceFrameCount: 1, displayedTileCount: 9 })));
    expect(observed.frameCounts.fieldEdge).toEqual({ sourceFrameCount: 16, displayedTileCount: 16 });
    expect(observed.frameCounts.mixedBoundary.displayedTileCount).toBe(9);
    expect(observed.frameCounts.mixedBoundary.uniqueSourceFrameCount).toBe(new Set(observed.mixedCellFrames).size);
    expect(observed.frameCounts.uniqueSourceFramesLoaded).toBe(observed.loadedFrameIds.length);
    expect(observed.frameCounts.uniqueSourceFramesLoaded).toBe(28);
    expect(observed.frameCounts.details.wallCornerIds).toEqual(sharedIds.filter((id) => id.startsWith('wall-corner-')));
    expect(observed.frameCounts.details.shadowId).toBe('ground-shadow');
    expect(observed.frameCounts.details.shadowAlpha).toEqual(details.shadowAlpha);
    expect(details.candidateStatus).toBe('candidate');
    expect(details.approved).toBe('false');
    expect(details.shadowAlpha.transparentPixels).toBeGreaterThan(0);
    expect(details.shadowAlpha.partialAlphaPixels).toBeGreaterThan(0);
    expect(details.shadowAlpha.transparentBorderPixels).toBe(2 * 32 + 2 * (12 - 2));
    await expect(page.locator('#details-title')).toContainText('牆角與地面陰影');
    await expect(page.locator('#corner-labels [data-frame-id^="wall-corner-"]')).toHaveCount(4);
    expect(observed.mixedCellFrames).toEqual([
      `${season}-grass`, `${season}-grass`, `${season}-grass`,
      `${season}-field-edge-9`, `${season}-field-edge-1`, `${season}-field-edge-3`,
      `${season}-field-edge-c`, `${season}-field-edge-4`, `${season}-field-edge-6`,
    ]);
    expect(observed.mixedMaskIds).toEqual([
      `${season}-field-edge-9`, `${season}-field-edge-1`, `${season}-field-edge-3`,
      `${season}-field-edge-c`, `${season}-field-edge-4`, `${season}-field-edge-6`,
    ]);
    expect(observed.mixedBoundaryAssumption).toBe('out-of-grid=grass; bits north=1,east=2,south=4,west=8');
    await expect(page.locator('#mixed-title')).toContainText('混合邊界');
    await expect(page.locator('#mixed-frame-list')).toContainText(`${season}-field-edge-9`);
    await expect(page.locator('#mask-labels [data-mask-id]')).toHaveCount(16);
    for (let mask = 0; mask < 16; mask += 1) {
      await expect(page.locator(`#mask-labels [data-mask-id="${season}-field-edge-${mask.toString(16)}"]`)).toHaveCount(1);
    }
    expect(observed.metrics.map((metric) => metric.surface)).toEqual([...seasonalSurfaces, 'wood-floor']);
    for (const metric of observed.metrics) {
      expect(metric.sampleCount).toBe(64);
      expect(metric.exactMatchCount).toBeGreaterThanOrEqual(0);
      expect(metric.exactMatchCount).toBeLessThanOrEqual(metric.sampleCount);
      expect(metric.meanRgbaDelta).toBeGreaterThanOrEqual(0);
      expect(metric.maxRgbaDelta).toBe(0);
      expect(metric.passed).toBe(true);
    }
    const metrics = observed.metrics.map((metric) => ({
      ...metric,
      sourceFrameCount: observed.frameCounts.baseSurfaces.find((item) => item.surface === metric.surface)?.sourceFrameCount ?? 0,
      displayedTileCount: observed.frameCounts.baseSurfaces.find((item) => item.surface === metric.surface)?.displayedTileCount ?? 0,
    }));

    const image = await page.screenshot({ fullPage: true });
    const screenshotDimensions = { width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
    expect(screenshotDimensions.width).toBe(1280);
    expect(screenshotDimensions.height).toBeGreaterThan(0);
    const filename = `${season}.png`;
    await testInfo.attach(`tiling-continuity-${filename}`, { body: image, contentType: 'image/png' });
    if (saveEvidence) await fs.writeFile(path.resolve(repoRoot, screenshotsDirectory, filename), image);
    results.push({ season, screenshot: `${screenshotsDirectory}/${filename}`, screenshotSha256: sha256(image), screenshotDimensions, ...observed, metrics, hashes: sourceHashes });
  }

  expect(pageErrors).toEqual([]);
  expect(requestFailures).toEqual([]);
  expect(badResponses).toEqual([]);
  if (saveEvidence) {
    await fs.writeFile(path.resolve(repoRoot, evidenceDirectory, 'evidence.json'), `${JSON.stringify({
      schemaVersion: 1,
      candidateStatus: manifest.status,
      approved: manifest.approved,
      sourceHashes,
      atlasDimensions: { width: manifest.atlas.width, height: manifest.atlas.height },
      seasons: results,
      aggregateFrameCounts: {
        seasons: results.length,
        baseSurfaceSourceFrames: results.reduce((total, result) => total + result.frameCounts.baseSurfaces.reduce((count, item) => count + item.sourceFrameCount, 0), 0),
        baseSurfaceDisplayedTiles: results.reduce((total, result) => total + result.frameCounts.baseSurfaces.reduce((count, item) => count + item.displayedTileCount, 0), 0),
        fieldEdgeSourceFrames: results.reduce((total, result) => total + result.frameCounts.fieldEdge.sourceFrameCount, 0),
        fieldEdgeDisplayedTiles: results.reduce((total, result) => total + result.frameCounts.fieldEdge.displayedTileCount, 0),
        mixedBoundaryDisplayedTiles: results.reduce((total, result) => total + result.frameCounts.mixedBoundary.displayedTileCount, 0),
      },
      metricMethod: 'For each tileable 32x32 frame, compare RGBA bytes of corresponding pixels across right/left and bottom/top wrap edges; 64 pixel pairs per surface. All per-channel deltas must be zero. Ground shadow alpha is counted from decoded atlas RGBA pixels and its full border must be transparent.',
      limitations: ['Exact repeated-edge matching does not establish human-perceived material quality or suitability across different surfaces.', 'Wall-corner art is reviewed as layered examples and is not auto-tiled by this candidate page.', 'Mixed-boundary preview treats out-of-grid neighbors as grass and is not a production map-rule test.', 'Candidate frames remain unapproved; no production assets or runtime were changed.'],
      pageErrors,
      requestFailures,
      badResponses,
    }, null, 2)}\n`);
  }
});
