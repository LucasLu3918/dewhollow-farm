import { expect, test, type Page } from '@playwright/test';

interface Actor {
  id: string;
  tileX: number;
  tileY: number;
  left: number;
  top: number;
  width: number;
  height: number;
  busy: boolean;
}

interface Sprite {
  key: string;
  left: number;
  top: number;
  width: number;
  height: number;
  flipX: boolean;
}

const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;

interface SaveOverrides {
  season?: (typeof SEASONS)[number];
  mapId?: string;
  player?: { x: number; y: number; facing: string };
  tool?: string;
  plots?: Record<string, unknown>;
  flags?: Record<string, boolean>;
}

async function putRecord(page: Page, overrides: SaveOverrides = {}): Promise<void> {
  await page.evaluate((nextSeason) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('saves', 'readwrite');
      tx.objectStore('saves').put({
        slot: 'slot-1',
        savedAt: '2026-10-23T00:00:00.000Z',
        state: {
          schemaVersion: 13,
          calendar: { year: 1, season: nextSeason.season, day: 4, minuteOfDay: 600 },
          weather: 'sunny', forecast: 'sunny',
          energy: { current: 100, max: 100 }, gold: 600,
          mapId: nextSeason.mapId, player: nextSeason.player,
          plots: nextSeason.plots, inventory: { capacity: 24, stacks: [] }, shipBox: { entries: [] },
          flags: nextSeason.flags, rng: 12345, tool: nextSeason.tool,
          toolTiers: { hoe: 0, can: 0, seedbag: 0, axe: 0, pick: 0, rod: 0, sickle: 0 },
          worldChanges: {},
          skills: { farming: 0, foraging: 0, fishing: 0, mining: 0, cooking: 0 },
          talents: {}, animals: [], cows: [], sheep: [], processing: [], fishing: null,
          mineSeed: 1, mineCheckpoint: 1, selectedSeed: 'moon-bean', playtimeSeconds: 0,
        },
      });
      tx.oncomplete = () => { open.result.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }), {
    season: overrides.season ?? 'spring',
    mapId: overrides.mapId ?? 'farm',
    player: overrides.player ?? { x: 7, y: 9, facing: 'down' },
    tool: overrides.tool ?? 'hoe',
    plots: overrides.plots ?? {},
    flags: overrides.flags ?? {},
  });
}

async function waitForGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

async function player(page: Page): Promise<Actor> {
  const found = (await page.evaluate(() => window.__dewhollow?.actors() ?? []))
    .find((actor) => actor.id === 'player') as Actor | undefined;
  if (!found) throw new Error('找不到玩家');
  return found;
}

async function walk(page: Page, key: string, steps = 1): Promise<void> {
  for (let i = 0; i < steps; i += 1) {
    const before = await page.evaluate(() => {
      const debug = window.__dewhollow;
      const actor = debug?.actors().find((candidate) => candidate.id === 'player');
      if (!debug || !actor) throw new Error('找不到遊戲或玩家');
      return { mapId: debug.mapId(), tileX: actor.tileX, tileY: actor.tileY };
    });
    await page.keyboard.press(key);
    await page.waitForFunction(({ mapId: beforeMap, tileX, tileY }) => {
      const debug = window.__dewhollow;
      const actor = debug?.actors().find((candidate) => candidate.id === 'player');
      if (!debug || !actor) return false;
      const moved = debug.mapId() !== beforeMap || actor.tileX !== tileX || actor.tileY !== tileY;
      return moved && !actor.busy;
    }, before);
  }
}

async function blockedMove(page: Page, key: string): Promise<void> {
  const before = await player(page);
  const beforeMap = await mapId(page);
  await page.keyboard.press(key);
  // Collision does not enter a walking animation; let the key event reach the game loop before
  // checking that its tile remains unchanged.
  await page.waitForTimeout(150);
  await expect.poll(async () => (await mapId(page)) === beforeMap && !(await player(page)).busy).toBe(true);
  const after = await player(page);
  expect({ x: after.tileX, y: after.tileY }).toEqual({ x: before.tileX, y: before.tileY });
}

async function mapId(page: Page): Promise<string> {
  return page.evaluate(() => window.__dewhollow?.mapId() ?? '');
}

async function grassPixel(page: Page, tileX: number, tileY: number): Promise<[number, number, number]> {
  return page.evaluate(async ({ x, y }) => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow（需用開發伺服器執行）');
    const camera = debug.cameraView();
    const scroll = debug.cameraScroll();
    const image = new Image();
    image.src = await debug.snapshot();
    await image.decode();
    const sample = document.createElement('canvas');
    sample.width = image.width;
    sample.height = image.height;
    const context = sample.getContext('2d');
    if (!context) throw new Error('沒有 2D canvas context');
    context.drawImage(image, 0, 0);
    const px = Math.round(camera.x + (x * 64 + 32 - scroll.x) * camera.zoom);
    const py = Math.round(camera.y + (y * 64 + 32 - scroll.y) * camera.zoom);
    const [red = 0, green = 0, blue = 0] = context.getImageData(px, py, 1, 1).data;
    return [red, green, blue];
  }, { x: tileX, y: tileY });
}

async function sprites(page: Page): Promise<Sprite[]> {
  return page.evaluate(() => window.__dewhollow?.sprites() ?? []) as Promise<Sprite[]>;
}

async function pauseScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow');
    return debug.pauseScene();
  });
}

async function capture(page: Page, name: string): Promise<void> {
  await pauseScene(page);
  await expect(page.locator('#game canvas')).toHaveScreenshot(name, { animations: 'disabled' });
}

async function playerWinsTreeOverlap(page: Page, playerSprite: Sprite, tree: Sprite): Promise<number> {
  return page.evaluate(async ({ actor, object }) => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow');
    const load = async (url: string): Promise<ImageData> => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error(`無法讀取素材 ${url}`);
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height);
    };
    const screenshot = new Image();
    screenshot.src = await debug.snapshot();
    await screenshot.decode();
    const output = document.createElement('canvas');
    output.width = screenshot.width;
    output.height = screenshot.height;
    const outputContext = output.getContext('2d');
    if (!outputContext) throw new Error('沒有 2D canvas context');
    outputContext.drawImage(screenshot, 0, 0);
    const composite = outputContext.getImageData(0, 0, output.width, output.height);
    const [playerArt, treeArt] = await Promise.all([
      load('/assets/characters/xiaohan-side-2x.png'),
      load('/assets/tiles/tree-2x.png'),
    ]);
    const camera = debug.cameraView();
    const scroll = debug.cameraScroll();
    const x0 = Math.max(actor.left, object.left);
    const y0 = Math.max(actor.top, object.top);
    const x1 = Math.min(actor.left + actor.width, object.left + object.width);
    const y1 = Math.min(actor.top + actor.height, object.top + object.height);
    let playerPixelsOnTop = 0;
    for (let y = y0 + 1; y < y1; y += 1) {
      for (let x = x0 + 1; x < x1; x += 1) {
        const actorX = Math.min(playerArt.width - 1, Math.floor(((x - actor.left) / actor.width) * playerArt.width));
        const actorY = Math.min(playerArt.height - 1, Math.floor(((y - actor.top) / actor.height) * playerArt.height));
        const sourceX = actor.flipX ? playerArt.width - 1 - actorX : actorX;
        const treeX = Math.min(treeArt.width - 1, Math.floor(((x - object.left) / object.width) * treeArt.width));
        const treeY = Math.min(treeArt.height - 1, Math.floor(((y - object.top) / object.height) * treeArt.height));
        const playerAt = (actorY * playerArt.width + sourceX) * 4;
        const treeAt = (treeY * treeArt.width + treeX) * 4;
        if ((playerArt.data[playerAt + 3] ?? 0) < 220 || (treeArt.data[treeAt + 3] ?? 0) < 220) continue;

        const canvasX = Math.round(camera.x + (x - scroll.x) * camera.zoom);
        const canvasY = Math.round(camera.y + (y - scroll.y) * camera.zoom);
        if (canvasX < 0 || canvasY < 0 || canvasX >= composite.width || canvasY >= composite.height) continue;
        const renderedAt = (canvasY * composite.width + canvasX) * 4;
        let playerDistance = 0;
        let treeDistance = 0;
        for (let channel = 0; channel < 3; channel += 1) {
          const actual = composite.data[renderedAt + channel] ?? 0;
          playerDistance += Math.abs(actual - (playerArt.data[playerAt + channel] ?? 0));
          treeDistance += Math.abs(actual - (treeArt.data[treeAt + channel] ?? 0));
        }
        if (playerDistance + 24 < treeDistance) playerPixelsOnTop += 1;
      }
    }
    return playerPixelsOnTop;
  }, { actor: playerSprite, object: tree });
}

test('farm and village grass render with distinct spring, summer, autumn, and winter appearances', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();

  const farmSamples: [number, number, number][] = [];
  const villageSamples: [number, number, number][] = [];
  for (const season of SEASONS) {
    await putRecord(page, { season });
    await page.reload();
    await expect(page.locator('#hud-day')).toHaveText(`第 1 年 ${({ spring: '春', summer: '夏', autumn: '秋', winter: '冬' } as const)[season]} 第 4 天`);
    await expect.poll(() => mapId(page)).toBe('farm');

    const farmTiles = await sprites(page);
    expect(farmTiles.map((sprite) => sprite.key)).toContain('tile.grass');
    await capture(page, `farm-${season}.png`);
    farmSamples.push(await grassPixel(page, 10, 9));

    // A fresh scene is needed after pauseScene; the saved season is deterministic.
    await page.reload();
    await expect.poll(() => mapId(page)).toBe('farm');
    await walk(page, 'ArrowDown', 20);
    await expect.poll(() => mapId(page)).toBe('village');
    expect((await sprites(page)).map((sprite) => sprite.key)).toContain('tile.grass');
    villageSamples.push(await grassPixel(page, 1, 1));
  }

  const unique = (samples: [number, number, number][]) => new Set(samples.map((rgb) => rgb.join(',')));
  expect(unique(farmSamples).size, '農場草地的取樣像素應反映每季草色變化').toBe(SEASONS.length);
  expect(unique(villageSamples).size, '村莊草地的取樣像素應反映每季草色變化').toBe(SEASONS.length);
});

test('a mature spring field renders from a deterministic saved crop state', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await putRecord(page, {
    season: 'spring',
    plots: { '8,8': { watered: true, dryDays: 0, crop: { cropId: 'sweet-radish', growthDays: 3 } } },
  });
  await page.reload();
  await expect.poll(() => mapId(page)).toBe('farm');
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 4 天');
  expect((await sprites(page)).map((sprite) => sprite.key)).toEqual(expect.arrayContaining(['tile.soil', 'crop.sweet-radish']));
  await capture(page, 'farm-mature-field.png');
});

test('the lakeside fishing view and mine entrance have deterministic visual baselines', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await putRecord(page, { mapId: 'lake', player: { x: 1, y: 7, facing: 'up' }, tool: 'rod' });
  await page.reload();
  await expect.poll(() => mapId(page)).toBe('lake');
  expect((await sprites(page)).map((sprite) => sprite.key)).toContain('tile.water');
  await capture(page, 'lake-fishing.png');

  await putRecord(page, { mapId: 'mine-entrance', player: { x: 8, y: 8, facing: 'up' } });
  await page.reload();
  await expect.poll(() => mapId(page)).toBe('mine-entrance');
  expect((await sprites(page)).map((sprite) => sprite.key)).toContain('tile.rock');
  await capture(page, 'mine-entrance.png');
});

test('field edges stay walkable while farm buildings, greenhouse fence, forest trees, and door transitions block correctly', async ({ page }) => {
  test.setTimeout(180_000);
  await waitForGame(page);

  // The field and grass edge is traversable in both directions.
  await walk(page, 'ArrowUp', 4); // (7,9) -> (7,5), the south edge of the field.
  await expect.poll(async () => ({ x: (await player(page)).tileX, y: (await player(page)).tileY })).toEqual({ x: 7, y: 5 });
  await walk(page, 'ArrowUp');
  await expect.poll(async () => ({ x: (await player(page)).tileX, y: (await player(page)).tileY })).toEqual({ x: 7, y: 4 });
  await walk(page, 'ArrowDown');

  // The south doorway connects the farm and village; a village shop wall blocks movement.
  await walk(page, 'ArrowDown', 4); // back to farm spawn (7,9)
  await walk(page, 'ArrowDown', 20);
  await expect.poll(() => mapId(page)).toBe('village');
  await walk(page, 'ArrowUp', 8); // (7,2)
  await walk(page, 'ArrowLeft', 2); // (5,2), beside the shop wall at x=4
  await blockedMove(page, 'ArrowLeft');
  await expect.poll(async () => ({ x: (await player(page)).tileX, y: (await player(page)).tileY })).toEqual({ x: 5, y: 2 });
  expect((await sprites(page)).map((sprite) => sprite.key)).toContain('tile.wall');
  expect((await sprites(page)).map((sprite) => sprite.key)).toContain('tile.door');

  // Return through the same doorway and approach the east exit.
  await walk(page, 'ArrowDown', 8); // (5,10)
  await walk(page, 'ArrowRight', 2); // doorway column x=7
  await walk(page, 'ArrowDown'); // village doorway at (7,11)
  await expect.poll(() => mapId(page)).toBe('farm');
  await expect.poll(async () => ({ x: (await player(page)).tileX, y: (await player(page)).tileY })).toEqual({ x: 7, y: 28 });

  // Remodel the greenhouse in a deterministic save, enter through Q, then approach the west fence
  // from inside. This avoids claiming an inaccessible outside tile can be reached through a wall.
  await putRecord(page, { flags: { greenhouse: true } });
  await page.reload();
  await expect.poll(() => mapId(page)).toBe('farm');
  await walk(page, 'ArrowUp', 2); // (7,7)
  await walk(page, 'ArrowRight', 23); // (30,7)
  await walk(page, 'ArrowDown', 12); // (30,19), above the greenhouse door
  await walk(page, 'ArrowDown'); // Q entrance -> greenhouse interior (30,22)
  await expect.poll(async () => ({ x: (await player(page)).tileX, y: (await player(page)).tileY })).toEqual({ x: 30, y: 22 });
  await walk(page, 'ArrowLeft', 2); // (28,22), next to the west fence
  await blockedMove(page, 'ArrowLeft');
  await expect.poll(async () => ({ x: (await player(page)).tileX, y: (await player(page)).tileY })).toEqual({ x: 28, y: 22 });
  const greenhouseSprites = await sprites(page);
  expect(greenhouseSprites.map((sprite) => sprite.key)).toContain('tile.fence');

  // Exit through the greenhouse's q door and use the east farm door to enter the forest.
  await walk(page, 'ArrowRight', 2); // (30,22)
  await walk(page, 'ArrowUp'); // q exit -> (30,19)
  await expect.poll(async () => ({ x: (await player(page)).tileX, y: (await player(page)).tileY })).toEqual({ x: 30, y: 19 });
  await walk(page, 'ArrowUp', 12); // y=7
  await walk(page, 'ArrowRight', 8); // x=38, beside east doorway
  await walk(page, 'ArrowRight'); // enter at x=39
  await expect.poll(() => mapId(page)).toBe('forest');
  await expect.poll(async () => ({ x: (await player(page)).tileX, y: (await player(page)).tileY })).toEqual({ x: 2, y: 7 });
  await walk(page, 'ArrowRight', 12); // x=14
  await blockedMove(page, 'ArrowRight');

  // Tree art extends above its blocking tile. Stand immediately south of the blocked path tree:
  // the character's rendered bounds overlap the canopy while remaining on the walkable tile.
  await walk(page, 'ArrowDown'); // (14,8)
  await walk(page, 'ArrowRight'); // (15,8), immediately below the tree at (15,7)
  const treeSprites = await sprites(page);
  const tree = treeSprites.find((sprite) => sprite.key === 'tile.tree' && sprite.left === 15 * 64 && sprite.top === 7 * 64);
  expect(tree, 'forest tree overlay at (15,7)').toBeDefined();
  const actor = await player(page);
  expect(actor.top + actor.height).toBeGreaterThan(tree!.top);
  expect(actor.top).toBeLessThan(tree!.top + tree!.height);
  expect(actor.left + actor.width).toBeGreaterThan(tree!.left);
  expect(actor.left).toBeLessThan(tree!.left + tree!.width);
  await pauseScene(page);
  const playerSprite = treeSprites.find((sprite) => sprite.key === 'player.left');
  expect(playerSprite, '玩家朝右使用左右翻轉的側面素材').toBeDefined();
  expect(await playerWinsTreeOverlap(page, playerSprite!, tree!), '重疊區像素應由角色覆蓋樹幹').toBeGreaterThan(8);
});
