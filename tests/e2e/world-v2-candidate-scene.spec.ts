import { expect, test, type Page } from '@playwright/test';

const nodeProcess = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process;
const saveEvidence = nodeProcess?.env?.SAVE_WORLD_V2_SCENE_EVIDENCE === '1';
const saveFarmEvidence = nodeProcess?.env?.SAVE_WORLD_V2_FARM_EVIDENCE === '1';

type CandidateDebug = {
  mapId(): string;
  movement(): { moving: boolean; pending: boolean; queuedTaps: number; heldDirection: string | null; tile: { x: number; y: number } };
  gameState(): Record<string, unknown>;
  worldV2SceneCandidate(): {
    enabled: boolean;
    mapId: string;
    frames: string[];
    layers: Array<{ frame: string; layer: 'ground' | 'object'; x: number; y: number }>;
    placements: Array<{ frame: string; x: number; y: number; depth: number }>;
  };
};

async function waitForIdle(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const movement = (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow?.movement();
    return movement && !movement.moving && !movement.pending && movement.queuedTaps === 0 && movement.heldDirection === null;
  })).toBe(true);
}

async function walk(page: Page, key: string, steps: number): Promise<void> {
  for (let index = 0; index < steps; index += 1) {
    await page.keyboard.press(key);
    await waitForIdle(page);
  }
}

async function capture(page: Page, name: string): Promise<void> {
  if (!saveEvidence && (name.startsWith('house-') || !saveFarmEvidence)) return;
  const root = name.startsWith('house-')
    ? 'docs/art/candidates/pixel-movement/df-v2-030-house-interior/screenshots'
    : 'docs/art/candidates/pixel-movement/gate1-world-v2-scene/screenshots';
  await page.locator('#game').screenshot({
    path: `${root}/${name}.png`,
    animations: 'disabled',
    scale: 'css',
  });
}

test('DEV world-v2 farm and house scene candidate stays opt-in and renders both compositions', async ({ page }) => {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}`));

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?renderProfile=pixel32&gate1Runtime=pixel32-map-animation');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow?.worldV2SceneCandidate().enabled ?? true)).toBe(false);

  const candidateAssetPaths = [
    '/docs/art/candidates/pixel-movement/gate1-world-v2-scene/farm/manifest.json',
    '/docs/art/candidates/pixel-movement/gate1-world-v2-scene/farm/atlas.png',
    '/docs/art/candidates/pixel-movement/df-v2-030-house-interior/manifest.json',
    '/docs/art/candidates/pixel-movement/df-v2-030-house-interior/atlas.png',
  ];
  const assetResponses = candidateAssetPaths.map((path) => page.waitForResponse((response) => response.url().includes(path)));
  await page.goto('/?renderProfile=pixel32&gate1Runtime=pixel32-map-animation&gate1SceneVisual=world-v2-cozy');
  await expect(page.locator('#game canvas')).toBeVisible();
  const responses = await Promise.all(assetResponses);
  expect(responses.map((response) => response.status())).toEqual([200, 200, 200, 200]);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow?.worldV2SceneCandidate().enabled ?? false)).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow?.worldV2SceneCandidate().frames ?? [])).toEqual(expect.arrayContaining([
    'gate1-world-v2-farm-atlas:house-exterior',
    'gate1-world-v2-farm-atlas:house-front',
    'gate1-world-v2-farm-atlas:tree-canopy',
    'gate1-world-v2-farm-atlas:shipping-crate',
    'gate1-world-v2-farm-atlas:stone-wall',
    'gate1-world-v2-farm-atlas:fence-horizontal',
    'gate1-world-v2-farm-atlas:fence-vertical',
  ]));
  const initialFarmScene = await page.evaluate(() => (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow!.worldV2SceneCandidate());
  expect(initialFarmScene.layers.some(({ frame }) => frame.startsWith('path-mask-'))).toBe(true);
  expect(initialFarmScene.layers.some(({ frame }) => frame.startsWith('field-mask-'))).toBe(true);
  expect(initialFarmScene.placements).toEqual(expect.arrayContaining([
    expect.objectContaining({ frame: 'house-exterior', x: 160, y: 320 }),
    expect.objectContaining({ frame: 'house-front', x: 160, y: 320 }),
    expect.objectContaining({ frame: 'tree-canopy', x: 672, y: 576 }),
  ]));
  const initialStateWithoutLocation = await page.evaluate(() => {
    const state = structuredClone((window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow!.gameState());
    delete state.mapId;
    delete state.player;
    return state;
  });
  await capture(page, 'farm-desktop');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow?.worldV2SceneCandidate().enabled ?? false)).toBe(true);
  await capture(page, 'farm-mobile');

  await walk(page, 'ArrowUp', 5);
  await walk(page, 'ArrowRight', 6);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow?.mapId() ?? '')).toBe('house');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow?.worldV2SceneCandidate().frames ?? [])).toContain(
    'gate1-world-v2-house-atlas:rug',
  );
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow?.worldV2SceneCandidate().frames ?? [])).toEqual(expect.arrayContaining([
    'gate1-world-v2-house-atlas:floor-a',
    'gate1-world-v2-house-atlas:wall-left-corner',
    'gate1-world-v2-house-atlas:wall-window',
    'gate1-world-v2-house-atlas:bed',
    'gate1-world-v2-house-atlas:kitchen-counter',
    'gate1-world-v2-house-atlas:workbench',
    'gate1-world-v2-house-atlas:storage',
    'gate1-world-v2-house-atlas:pet-bed',
    'gate1-world-v2-house-atlas:door-threshold',
    'gate1-world-v2-house-atlas:wardrobe',
    'gate1-world-v2-house-atlas:stove',
    'gate1-world-v2-house-atlas:table',
    'gate1-world-v2-house-atlas:chair',
    'gate1-world-v2-house-atlas:entry-mat',
    'gate1-world-v2-house-atlas:shoe-storage',
    'gate1-world-v2-house-atlas:water-bowl',
    'gate1-world-v2-house-atlas:shelf-books',
    'gate1-world-v2-house-atlas:plant',
  ]));
  await expect.poll(() => page.evaluate(() => {
    const scene = (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow?.worldV2SceneCandidate();
    return scene?.layers.filter((entry) => entry.frame === 'wall-window');
  })).toEqual([{ frame: 'wall-window', layer: 'object', x: 11, y: 0 }]);
  await expect.poll(() => page.evaluate(() => {
    const scene = (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow?.worldV2SceneCandidate();
    return scene?.placements.map((placement) => placement.frame) ?? [];
  })).toEqual(expect.arrayContaining([
    'bed', 'plant', 'kitchen-counter', 'stove', 'shelf-books', 'workbench', 'storage',
    'wardrobe', 'shoe-storage', 'table', 'chair', 'pet-bed', 'water-bowl', 'entry-mat',
    'rug', 'door-threshold',
  ]));
  await expect.poll(() => page.evaluate(() => {
    const scene = (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow?.worldV2SceneCandidate();
    return scene?.placements.map((placement) => placement.frame) ?? [];
  })).not.toContain('wall-window');
  const depths = await page.evaluate(() => {
    const placements = (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow?.worldV2SceneCandidate().placements ?? [];
    return Object.fromEntries(placements.map(({ frame, depth }) => [frame, depth]));
  });
  const shelfDepth = depths['shelf-books'];
  const rugDepth = depths.rug;
  const bedDepth = depths.bed;
  expect(shelfDepth).toBeDefined();
  expect(rugDepth).toBeDefined();
  expect(bedDepth).toBeDefined();
  expect(shelfDepth!).toBeLessThan(bedDepth!);
  expect(rugDepth!).toBeLessThan(bedDepth!);
  await walk(page, 'ArrowRight', 1);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow?.movement().tile ?? null)).toMatchObject({ x: 11, y: 18 });
  await walk(page, 'ArrowUp', 8);
  await capture(page, 'house-mobile');
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow?.worldV2SceneCandidate().mapId ?? '')).toBe('house');
  await capture(page, 'house-desktop');

  await walk(page, 'ArrowDown', 8);
  await walk(page, 'ArrowLeft', 1);
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow?.mapId() ?? '')).toBe('farm');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow?.worldV2SceneCandidate().frames ?? [])).not.toContain(
    'gate1-world-v2-house-atlas:rug',
  );
  const returnedStateWithoutLocation = await page.evaluate(() => {
    const state = structuredClone((window as unknown as { __dewhollow?: CandidateDebug }).__dewhollow!.gameState());
    delete state.mapId;
    delete state.player;
    return state;
  });
  expect(returnedStateWithoutLocation).toEqual(initialStateWithoutLocation);

  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
