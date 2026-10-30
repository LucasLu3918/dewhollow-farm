import { expect, test, type Browser, type Page } from '@playwright/test';

const profiles = [
  { id: 'legacy', candidate: null },
  { id: 'pixel16', candidate: '8bit' },
  { id: 'pixel32', candidate: '16bit' },
] as const;
const shouldSaveEvidence = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } })
  .process?.env?.SAVE_GATE1_MAPSCENE_EVIDENCE === '1';

async function startFarm(browser: Browser, profile: typeof profiles[number]['id']) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
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
  await page.goto(`/?renderProfile=${profile}`);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixelViewport().profile ?? '')).toBe(profile);
  return { context, page };
}

async function waitUntilIdle(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const movement = window.__dewhollow?.movement();
    return movement && movement.heldDirection === null && !movement.moving && !movement.pending;
  })).toBe(true);
}

async function installThreeStageCropFixture(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('dewhollow-farm');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('saves', 'readwrite');
      transaction.objectStore('saves').put({
        slot: 'slot-1',
        savedAt: '2026-10-24T00:00:00.000Z',
        state: {
          schemaVersion: 1,
          calendar: { year: 1, season: 'spring', day: 1, minuteOfDay: 360 },
          energy: { current: 100, max: 100 },
          gold: 100,
          mapId: 'farm',
          player: { x: 20, y: 14, facing: 'down' },
          plots: {
            '4,3': { watered: false, crop: { cropId: 'sweet-radish', growthDays: 0 } },
            '5,3': { watered: true, crop: { cropId: 'sweet-radish', growthDays: 1 } },
            '6,3': { watered: false, crop: { cropId: 'sweet-radish', growthDays: 3 } },
          },
          bag: { seeds: { 'sweet-radish': 5 }, crops: {} },
          shipBox: { items: {} },
          flags: {},
          tool: 'hoe',
          selectedSeed: 'sweet-radish',
          rng: 12345,
        },
      });
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
  }));
  await page.reload();
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

test('legacy, 8-bit and 16-bit candidate art share one MapScene runtime with explicit fallback coverage', async ({ browser }, testInfo) => {
  test.setTimeout(60_000);
  const fs = await import('node:' + 'fs/promises');
  const outcomes: Array<{ profile: string; start: { x: number; y: number }; end: { x: number; y: number }; mapId: string; candidate: string | null; toolAfterCycle: string }> = [];
  const evidenceRoot = 'docs/art/candidates/pixel-movement/gate1-mapscene-ab';
  const logs: string[] = [];

  for (const profile of profiles) {
    const { context, page } = await startFarm(browser, profile.id);
    page.on('pageerror', (error) => logs.push(`${profile.id}: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') logs.push(`${profile.id}: ${message.text()}`);
    });
    await installThreeStageCropFixture(page);

    const initial = await page.evaluate(() => {
      const movement = window.__dewhollow?.movement();
      const candidateArt = window.__dewhollow?.candidateArt();
      const atlasSize = window.__dewhollow?.textureSize('gate1-candidate-atlas');
      if (!movement || !candidateArt) throw new Error('缺少 MapScene 移動或候選素材診斷');
      return {
        tile: movement.tile,
        mapId: window.__dewhollow?.mapId() ?? '',
        candidateArt,
        atlasSize,
        sprites: window.__dewhollow?.sprites() ?? [],
      };
    });
    expect(initial.mapId).toBe('farm');
    expect(initial.candidateArt.profile).toBe(profile.id);
    expect(initial.candidateArt.candidate).toBe(profile.candidate);
    if (profile.candidate === null) {
      expect(initial.atlasSize).toBeNull();
      expect(initial.candidateArt.registeredFrames).toEqual([]);
      expect(initial.sprites.map((sprite) => sprite.key)).not.toContain('gate1-candidate-atlas');
      const legacyCropSprites = initial.sprites.filter((sprite) => sprite.key === 'crop.sweet-radish').sort((left, right) => left.left - right.left);
      expect(legacyCropSprites).toHaveLength(3);
      expect(legacyCropSprites.map((sprite) => sprite.width)).toEqual([64, 85, 128]);
    } else {
      expect(initial.atlasSize).toEqual(profile.candidate === '8bit' ? { width: 64, height: 96 } : { width: 128, height: 192 });
      expect(initial.candidateArt.registeredFrames).toHaveLength(15);
      expect(initial.candidateArt.candidateAssetIds).toEqual(expect.arrayContaining([
        'tile.grass', 'tile.field', 'tile.path', 'tile.tree', 'tile.wall', 'tile.fence',
      ]));
      expect(initial.candidateArt.fallbackAssetIds).toEqual(expect.arrayContaining([
        'tile.soil', 'player.down', 'pet.cat', 'pet.marsupial', 'tool.hoe',
      ]));
      expect(initial.sprites.map((sprite) => sprite.key)).toContain('gate1-candidate-atlas');
      const cropSprites = initial.sprites
        .filter((sprite) => sprite.key === 'gate1-candidate-atlas' && ['cropSeed', 'cropSprout', 'cropMature'].includes(sprite.frame ?? ''))
        .sort((left, right) => left.left - right.left);
      expect(cropSprites.map((sprite) => sprite.frame)).toEqual(['cropSeed', 'cropSprout', 'cropMature']);
      expect(cropSprites.map((sprite) => sprite.width)).toEqual([32, 43, 64]);
    }

    if (shouldSaveEvidence) await fs.mkdir(evidenceRoot, { recursive: true });
    const screenshot = await page.screenshot({
      path: shouldSaveEvidence ? `${evidenceRoot}/${profile.id}-390x844.png` : undefined,
      animations: 'disabled',
      scale: 'css',
    });
    await testInfo.attach(`${profile.id}-390x844.png`, { body: screenshot, contentType: 'image/png' });

    await page.keyboard.down('ArrowRight');
    await page.waitForFunction((targetX) => {
      const player = window.__dewhollow?.actors().find((actor) => actor.id === 'player');
      return player !== undefined && player.tileX >= targetX;
    }, initial.tile.x + 3, { timeout: 15_000 });
    await page.keyboard.up('ArrowRight');
    await waitUntilIdle(page);
    const end = await page.evaluate(() => {
      const player = window.__dewhollow?.actors().find((actor) => actor.id === 'player');
      if (!player) throw new Error('找不到移動後的 farm player');
      return { x: player.tileX, y: player.tileY };
    });
    expect(end).toEqual({ x: initial.tile.x + 3, y: initial.tile.y });
    const tool = page.locator('#hud-tool');
    const toolBeforeCycle = await tool.innerText();
    await page.keyboard.press('z');
    await expect(tool).not.toHaveText(toolBeforeCycle);
    const toolAfterCycle = await tool.innerText();
    outcomes.push({ profile: profile.id, start: initial.tile, end, mapId: initial.mapId, candidate: initial.candidateArt.candidate, toolAfterCycle });
    await context.close();
  }

  expect(logs).toEqual([]);
  expect(outcomes.map(({ start, end, mapId, toolAfterCycle }) => ({ start, end, mapId, toolAfterCycle }))).toEqual([
    { start: outcomes[0]!.start, end: outcomes[0]!.end, mapId: 'farm', toolAfterCycle: outcomes[0]!.toolAfterCycle },
    { start: outcomes[0]!.start, end: outcomes[0]!.end, mapId: 'farm', toolAfterCycle: outcomes[0]!.toolAfterCycle },
    { start: outcomes[0]!.start, end: outcomes[0]!.end, mapId: 'farm', toolAfterCycle: outcomes[0]!.toolAfterCycle },
  ]);
  await testInfo.attach('gate1-mapscene-candidate-outcomes.json', {
    body: JSON.stringify({ scope: 'Chromium MapScene preview only', outcomes }, null, 2),
    contentType: 'application/json',
  });
});

test('production preview ignores candidate render profiles and does not request candidate atlases', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const candidateRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/gate1-assets/')) candidateRequests.push(request.url());
  });
  const baseUrl = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.PWA_BASE_URL ?? 'http://127.0.0.1:4173';
  await page.goto(`${baseUrl}/?renderProfile=pixel16`);
  await expect(page.locator('#game canvas')).toBeVisible();
  expect(candidateRequests).toEqual([]);
  await context.close();
});
