import { expect, test, type Browser, type Page } from '@playwright/test';

const candidateQuery = '?renderProfile=pixel32&gate1Runtime=pixel32-map-animation';
const evidenceRoot = 'docs/art/candidates/pixel-movement/gate1-mapscene-pixel32-scene-coverage';
const nodeProcess = (globalThis as typeof globalThis & {
  process?: { cwd(): string; env?: Record<string, string | undefined> };
}).process;
const saveEvidence = nodeProcess?.env?.SAVE_GATE1_PIXEL32_SCENE_EVIDENCE === '1';

type PlotState = Record<string, { watered: boolean; dryDays: number; crop: { cropId: string; growthDays: number } }>;
type Actor = { id: string; tileX: number; tileY: number; depth: number; left: number; top: number; width: number; height: number };
type Sprite = { key: string; frame: string | null; left: number; top: number; width: number; height: number; depth: number };

async function startCandidateRuntime(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
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
  await page.goto(candidateQuery);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().enabled ?? false)).toBe(true);
  return { context, page };
}

async function putSave(page: Page, mapId: 'farm' | 'forest', player: { x: number; y: number; facing: string }, plots: PlotState): Promise<void> {
  await page.evaluate(({ mapId, player, plots }) => new Promise<void>((resolve, reject) => {
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
          weather: 'sunny',
          forecast: 'sunny',
          energy: { current: 100, max: 100 },
          gold: 600,
          mapId,
          player,
          plots,
          inventory: { capacity: 24, stacks: [] },
          shipBox: { entries: [] },
          flags: {},
          rng: 12345,
          tool: 'hoe',
          toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 },
          worldChanges: {},
          skills: { farming: 0, foraging: 0, fishing: 0, mining: 0, cooking: 0 },
          talents: {},
          animals: [],
          cows: [],
          sheep: [],
          processing: [],
          fishing: null,
          mineSeed: 1,
          mineCheckpoint: 1,
          selectedSeed: 'sweet-radish',
          playtimeSeconds: 0,
        },
      });
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
  }), { mapId, player, plots });
  await page.reload();
  await expect(page.locator('#hud-log')).toContainText('已讀取存檔');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe(mapId);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.pixel32CandidateRuntime().enabled ?? false)).toBe(true);
}

async function sceneSnapshot(page: Page) {
  return page.evaluate(() => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('Missing development scene diagnostics');
    return {
      mapId: debug.mapId(),
      runtime: debug.pixel32CandidateRuntime(),
      candidateArt: debug.candidateArt(),
      actors: debug.actors(),
      sprites: debug.sprites(),
      viewport: debug.pixelViewport(),
    };
  });
}

async function waitForMovementIdle(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const movement = window.__dewhollow?.movement();
    return movement !== undefined
      && movement.heldDirection === null
      && !movement.moving
      && !movement.pending
      && movement.queuedTaps === 0;
  }), { timeout: 10_000 }).toBe(true);
}

function boundsOverlap(actor: Actor, sprite: Sprite): boolean {
  return actor.left + actor.width > sprite.left
    && actor.left < sprite.left + sprite.width
    && actor.top + actor.height > sprite.top
    && actor.top < sprite.top + sprite.height;
}

test('pixel32 candidate runtime composes farm crops, cat following, and tree depth fallback', async ({ browser }, testInfo) => {
  test.setTimeout(90_000);
  const fs = await import('node:' + 'fs/promises');
  const path = await import('node:' + 'path');
  const crypto = await import('node:' + 'crypto');
  const root = path.resolve(nodeProcess?.cwd() ?? '.', evidenceRoot);
  if (saveEvidence) await fs.mkdir(root, { recursive: true });

  const { context, page } = await startCandidateRuntime(browser);
  const farmPlots: PlotState = {
    '3,6': { watered: false, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 0 } },
    '4,6': { watered: true, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 1 } },
    '5,6': { watered: false, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 3 } },
  };
  await putSave(page, 'farm', { x: 7, y: 9, facing: 'down' }, farmPlots);

  const farmBeforeMove = await sceneSnapshot(page);
  expect(farmBeforeMove.runtime.playerFrame).toBe('down-idle');
  expect(farmBeforeMove.runtime.mapFrames).toContain('spring-grass');
  expect(farmBeforeMove.runtime.mapFrames.some((frame) => frame.startsWith('spring-field-edge-'))).toBe(true);
  const crops = farmBeforeMove.sprites
    .filter((sprite) => sprite.key === 'crop.sweet-radish')
    .sort((left, right) => left.left - right.left) as Sprite[];
  expect(crops).toHaveLength(3);
  expect(crops.every((sprite) => !['cropSeed', 'cropSprout', 'cropMature'].includes(sprite.frame ?? ''))).toBe(true);
  expect(crops.map((sprite) => sprite.width)).toEqual([64, 85, 128]);
  expect(farmBeforeMove.sprites.some((sprite) => sprite.key === 'gate1-pixel32-map-atlas')).toBe(true);

  const playerBefore = farmBeforeMove.actors.find((actor) => actor.id === 'player') as Actor | undefined;
  const catBefore = farmBeforeMove.actors.find((actor) => actor.id === 'cat') as Actor | undefined;
  expect(farmBeforeMove.candidateArt.fallbackAssetIds).toContain('pet.cat');
  expect(playerBefore).toBeDefined();
  expect(catBefore).toMatchObject({ width: 48, height: 48 });
  await page.keyboard.press('ArrowDown');
  await waitForMovementIdle(page);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.actors().find((actor) => actor.id === 'player')?.tileY ?? -1)).toBe(10);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.actors().find((actor) => actor.id === 'cat')?.tileY ?? -1)).toBe(9);
  const farmAfterMove = await sceneSnapshot(page);
  const playerAfter = farmAfterMove.actors.find((actor) => actor.id === 'player') as Actor | undefined;
  const catAfter = farmAfterMove.actors.find((actor) => actor.id === 'cat') as Actor | undefined;
  expect(playerAfter && catAfter).toBeTruthy();
  expect(catAfter!.depth).toBeLessThan(playerAfter!.depth);
  const farmScreenshot = await page.screenshot({ animations: 'disabled', scale: 'css' });
  await testInfo.attach('pixel32-farm-crops-and-cat.png', { body: farmScreenshot, contentType: 'image/png' });

  await putSave(page, 'forest', { x: 15, y: 7, facing: 'down' }, {});
  const forestBehind = await sceneSnapshot(page);
  const treeBehind = forestBehind.sprites.find((sprite) => sprite.key === 'tile.tree' && sprite.left === 15 * 64 && sprite.top === 7 * 64) as Sprite | undefined;
  const playerBehind = forestBehind.actors.find((actor) => actor.id === 'player') as Actor | undefined;
  expect(treeBehind).toBeDefined();
  expect(treeBehind!.key).toBe('tile.tree'); // Tree is deliberately reported as existing-art fallback.
  expect(playerBehind).toBeDefined();
  expect(boundsOverlap(playerBehind!, treeBehind!), 'player overlaps tree art while behind its depth layer').toBe(true);
  expect(treeBehind!.depth).toBeGreaterThan(playerBehind!.depth);
  const forestScreenshot = await page.screenshot({ animations: 'disabled', scale: 'css' });
  await testInfo.attach('pixel32-forest-tree-occlusion.png', { body: forestScreenshot, contentType: 'image/png' });

  await putSave(page, 'forest', { x: 15, y: 8, facing: 'up' }, {});
  const forestFront = await sceneSnapshot(page);
  const treeFront = forestFront.sprites.find((sprite) => sprite.key === 'tile.tree' && sprite.left === 15 * 64 && sprite.top === 7 * 64) as Sprite | undefined;
  const playerFront = forestFront.actors.find((actor) => actor.id === 'player') as Actor | undefined;
  expect(treeFront && playerFront).toBeTruthy();
  expect(boundsOverlap(playerFront!, treeFront!), 'player overlaps tree art while in front of its depth layer').toBe(true);
  expect(playerFront!.depth).toBeGreaterThan(treeFront!.depth);

  const evidence = {
    schemaVersion: 1,
    candidate: { route: candidateQuery, status: 'candidate', approved: false },
    viewport: { width: 1280, height: 720, dpr: 1 },
    farm: {
      pixel32PlayerFrame: farmBeforeMove.runtime.playerFrame,
      renderedCandidateGroundFrames: [...new Set(farmBeforeMove.sprites
        .filter((sprite) => sprite.key === 'gate1-pixel32-map-atlas' && sprite.frame !== null)
        .map((sprite) => sprite.frame!))],
      crops: crops.map(({ key, frame, width }) => ({ key, frame, width })),
      fallback: 'This v13 save fixture is migrated on load in an isolated test browser context. Crop and cat visuals use existing formal assets; only pixel32 map ground and player body are candidates. No production save format or player save data is changed.',
      catFollow: {
        playerFrom: { x: playerBefore!.tileX, y: playerBefore!.tileY },
        catFrom: { x: catBefore!.tileX, y: catBefore!.tileY },
        playerTo: { x: playerAfter!.tileX, y: playerAfter!.tileY, depth: playerAfter!.depth },
        catTo: { x: catAfter!.tileX, y: catAfter!.tileY, depth: catAfter!.depth },
      },
    },
    forest: {
      tree: { key: treeBehind!.key, frame: treeBehind!.frame, bounds: { left: treeBehind!.left, top: treeBehind!.top, width: treeBehind!.width, height: treeBehind!.height } },
      playerBehindTree: { tile: { x: playerBehind!.tileX, y: playerBehind!.tileY }, overlapsTree: boundsOverlap(playerBehind!, treeBehind!), treeDepth: treeBehind!.depth, playerDepth: playerBehind!.depth },
      playerInFrontOfTree: { tile: { x: playerFront!.tileX, y: playerFront!.tileY }, overlapsTree: boundsOverlap(playerFront!, treeFront!), treeDepth: treeFront!.depth, playerDepth: playerFront!.depth },
    },
    limitations: [
      'This evidence covers existing farm and forest MapScene regions, not a complete fixed 12x10 candidate scene.',
      'Tree, crop, and companion art are existing-art fallbacks, not pixel32 candidate assets.',
      'The test seeds and migrates an isolated IndexedDB fixture; it does not change production save format or user save data.',
      'Chromium evidence does not establish native-device behavior, exact art approval, or Gate 1 completion.',
    ],
  };

  if (saveEvidence) {
    const images = [
      ['farm-crops-companion.png', farmScreenshot],
      ['forest-tree-occlusion.png', forestScreenshot],
    ] as const;
    for (const [filename, bytes] of images) await fs.writeFile(path.join(root, filename), bytes);
    Object.assign(evidence, {
      screenshots: Object.fromEntries(images.map(([filename, bytes]) => [filename, {
        sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        bytes: bytes.byteLength,
      }])),
    });
  }
  const report = `${JSON.stringify(evidence, null, 2)}\n`;
  await testInfo.attach('pixel32-scene-coverage-evidence.json', { body: report, contentType: 'application/json' });
  if (saveEvidence) await fs.writeFile(path.join(root, 'evidence.json'), report);
  await context.close();
});
