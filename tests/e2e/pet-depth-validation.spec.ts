import { expect, test, type Page } from '@playwright/test';

interface Actor {
  id: string;
  footX: number;
  footY: number;
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
}

interface OverlapCapture {
  width: number;
  height: number;
  player: Sprite;
  cat: Sprite;
  camera: { x: number; y: number; zoom: number };
  scroll: { x: number; y: number };
  feet: { player: number; cat: number };
}

interface PixelImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

async function waitForGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 1 天');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

async function actors(page: Page): Promise<Actor[]> {
  return page.evaluate(() => window.__dewhollow?.actors() ?? []) as Promise<Actor[]>;
}

async function actor(page: Page, id: string): Promise<Actor> {
  const found = (await actors(page)).find((item) => item.id === id);
  if (!found) throw new Error(`找不到角色 ${id}`);
  return found;
}

async function walk(page: Page, key: string): Promise<void> {
  const before = await actor(page, 'player');
  await page.keyboard.press(key);
  await expect.poll(async () => {
    const current = await actor(page, 'player');
    return current.tileX !== before.tileX || current.tileY !== before.tileY;
  }).toBe(true);
  await expect.poll(async () => {
    const [player, cat] = await Promise.all([actor(page, 'player'), actor(page, 'cat')]);
    return !player.busy && !cat.busy;
  }).toBe(true);
}

async function captureCrossing(page: Page, key: string, depth: 'player-front' | 'cat-front'): Promise<OverlapCapture> {
  const overlapReached = page.waitForFunction(async (targetDepth) => {
    const debug = window.__dewhollow;
    if (!debug) return false;
    const [playerActor, catActor] = debug.actors().filter((item) => item.id === 'player' || item.id === 'cat');
    if (!playerActor || !catActor) return false;
    const footGap = targetDepth === 'player-front'
      ? playerActor.footY - catActor.footY
      : catActor.footY - playerActor.footY;
    const maxRestOverlapGap = targetDepth === 'player-front' ? 68 : 36;
    const horizontalFootGap = Math.abs(playerActor.footX - catActor.footX);
    // The resting silhouettes are 64×80 and 48×48, centered on their root foot positions.
    // Keep at least 12 px of overlap after pauseScene resets the walking pose.
    const restPoseOverlap = horizontalFootGap < 44 && footGap > 0 && footGap < maxRestOverlapGap;
    if (!playerActor.busy || !catActor.busy || !restPoseOverlap) return false;

    // Freeze inside the browser evaluation that observes the overlap. Waiting for the
    // parent test to pause the scene can let this short crossing finish first on CI.
    await debug.pauseScene({ preservePose: true });
    return true;
  }, depth, { timeout: 5_000 });
  await page.keyboard.press(key);
  await overlapReached;
  return captureOverlap(page);
}

async function captureOverlap(page: Page): Promise<OverlapCapture> {
  return page.evaluate(() => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow');
    const sprites = debug.sprites();
    const player = sprites.find((sprite) => sprite.key.startsWith('player.'));
    const cat = sprites.find((sprite) => sprite.key === 'pet.cat');
    if (!player || !cat) throw new Error('找不到玩家或黑貓的渲染範圍');
    const camera = debug.cameraView();
    const [playerActor, catActor] = debug.actors().filter((actor) => actor.id === 'player' || actor.id === 'cat');
    if (!playerActor || !catActor) throw new Error('找不到玩家或黑貓的腳底座標');
    const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
    if (!canvas) throw new Error('找不到遊戲畫布');
    return {
      width: canvas.width,
      height: canvas.height,
      player,
      cat,
      camera: { x: camera.x, y: camera.y, zoom: camera.zoom },
      scroll: debug.cameraScroll(),
      feet: { player: playerActor.footY, cat: catActor.footY },
    };
  }) as Promise<OverlapCapture>;
}

async function expectOcclusionOrder(page: Page, crossing: OverlapCapture): Promise<{ playerFrontPixels: number; catFrontPixels: number }> {
  const result = await page.evaluate(async (geometry) => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow');
    const readPixels = async (): Promise<PixelImage> => {
      const image = new Image();
      image.src = await debug.snapshot();
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('沒有 2D canvas context');
      context.drawImage(image, 0, 0);
      return { width: canvas.width, height: canvas.height, data: context.getImageData(0, 0, canvas.width, canvas.height).data };
    };
    const nextFrame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const both = await readPixels();
    let playerOnly: PixelImage;
    let background: PixelImage;
    let catOnly: PixelImage;
    try {
      debug.setOthersHidden(true);
      await nextFrame();
      playerOnly = await readPixels();
      debug.setPlayerHidden(true);
      await nextFrame();
      background = await readPixels();
      debug.setOthersHidden(false);
      await nextFrame();
      catOnly = await readPixels();
    } finally {
      debug.setPlayerHidden(false);
      debug.setOthersHidden(false);
    }

    const pixel = (image: PixelImage, x: number, y: number): [number, number, number, number] => {
      const at = (y * image.width + x) * 4;
      return [image.data[at] ?? 0, image.data[at + 1] ?? 0, image.data[at + 2] ?? 0, image.data[at + 3] ?? 0];
    };
    let sharedActorPixels = 0;
    let playerFrontPixels = 0;
    let catFrontPixels = 0;
    for (let y = 0; y < both.height; y += 1) {
      for (let x = 0; x < both.width; x += 1) {
        const visible = pixel(both, x, y);
        const playerPixel = pixel(playerOnly, x, y);
        const backgroundPixel = pixel(background, x, y);
        const catPixel = pixel(catOnly, x, y);
        const changed = (a: number[], b: number[]): boolean => a.some((channel, index) => channel !== b[index]);
        if (!changed(playerPixel, backgroundPixel) || !changed(catPixel, backgroundPixel) || !changed(playerPixel, catPixel)) continue;
        sharedActorPixels += 1;
        const matchesPlayer = !changed(visible, playerPixel);
        const matchesCat = !changed(visible, catPixel);
        if (matchesPlayer && !matchesCat) playerFrontPixels += 1;
        if (matchesCat && !matchesPlayer) catFrontPixels += 1;
      }
    }
    return { sharedActorPixels, playerFrontPixels, catFrontPixels };
  }, crossing);

  expect(result.sharedActorPixels, `暫停後玩家與黑貓的實際渲染遮罩應有共同像素：${JSON.stringify({ result, geometry: crossing })}`).toBeGreaterThan(0);
  return { playerFrontPixels: result.playerFrontPixels, catFrontPixels: result.catFrontPixels };
}

async function expectPlayerOccludesCat(page: Page, crossing: OverlapCapture): Promise<void> {
  const order = await expectOcclusionOrder(page, crossing);
  expect(order.playerFrontPixels, `玩家在可辨識的貼圖交集像素應比黑貓更常位於前景：${JSON.stringify({ order, geometry: crossing })}`).toBeGreaterThan(order.catFrontPixels);
}

async function expectCatOccludesPlayer(page: Page, crossing: OverlapCapture): Promise<void> {
  const order = await expectOcclusionOrder(page, crossing);
  expect(order.catFrontPixels, `後景玩家應有黑貓來源色覆蓋前景的可辨識貼圖像素：${JSON.stringify({ order, geometry: crossing })}`).toBeGreaterThan(order.playerFrontPixels);
}

async function expectCatContributesRenderedPixels(page: Page): Promise<void> {
  const changed = await page.evaluate(async () => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow');
    const cat = debug.sprites().find((sprite) => sprite.key === 'pet.cat');
    if (!cat) throw new Error('找不到黑貓貼圖');
    const camera = debug.cameraView();
    const scroll = debug.cameraScroll();
    const capture = async (): Promise<ImageData> => {
      const image = new Image();
      image.src = await debug.snapshot();
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('沒有 2D canvas context');
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height);
    };
    const visible = await capture();
    debug.setOthersHidden(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const hidden = await capture();
    debug.setOthersHidden(false);
    const left = Math.floor(camera.x + (cat.left - scroll.x) * camera.zoom);
    const top = Math.floor(camera.y + (cat.top - scroll.y) * camera.zoom);
    const right = Math.ceil(camera.x + (cat.left + cat.width - scroll.x) * camera.zoom);
    const bottom = Math.ceil(camera.y + (cat.top + cat.height - scroll.y) * camera.zoom);
    let changedPixels = 0;
    for (let y = Math.max(0, top); y < Math.min(visible.height, bottom); y += 1) {
      for (let x = Math.max(0, left); x < Math.min(visible.width, right); x += 1) {
        const offset = (y * visible.width + x) * 4;
        if ([0, 1, 2, 3].some((channel) => visible.data[offset + channel] !== hidden.data[offset + channel])) changedPixels += 1;
      }
    }
    return changedPixels;
  });
  expect(changed, '隱藏黑貓後，其畫面範圍應有實際像素差異').toBeGreaterThan(0);
}

test('the black cat uses a stable foot baseline and stays aligned to its farm tile', async ({ page }) => {
  await waitForGame(page);
  const player = await actor(page, 'player');
  const cat = await actor(page, 'cat');
  expect(await page.evaluate(() => window.__dewhollow?.textureSize('pet.cat'))).toEqual({ width: 96, height: 96 });
  expect(cat).toMatchObject({ tileX: 7, tileY: 8, width: 48, height: 48 });
  expect(player).toMatchObject({ tileX: 7, tileY: 9 });
  expect(cat.left + cat.width / 2).toBe((cat.tileX + 0.5) * 64);
  expect(cat.top + cat.height).toBe((cat.tileY + 1) * 64);
  await page.evaluate(() => window.__dewhollow?.pauseScene());
  await expectCatContributesRenderedPixels(page);
});

test('the cat does not block the player: walking through its tile swaps their positions', async ({ page }) => {
  await waitForGame(page);
  await walk(page, 'ArrowUp');
  await expect.poll(async () => {
    const [player, cat] = await Promise.all([actor(page, 'player'), actor(page, 'cat')]);
    return [player.tileX, player.tileY, cat.tileX, cat.tileY];
  }).toEqual([7, 8, 7, 9]);

  await walk(page, 'ArrowDown');
  await expect.poll(async () => {
    const [player, cat] = await Promise.all([actor(page, 'player'), actor(page, 'cat')]);
    return [player.tileX, player.tileY, cat.tileX, cat.tileY];
  }).toEqual([7, 9, 7, 8]);
});

test('the player remains in front of the cat during southbound crossing', async ({ page }) => {
  await waitForGame(page);
  await walk(page, 'ArrowUp');
  await expectCatContributesRenderedPixels(page);
  const southbound = await captureCrossing(page, 'ArrowDown', 'player-front');
  await expectPlayerOccludesCat(page, southbound);
});

test('the player is behind the cat while crossing northbound', async ({ page }) => {
  await waitForGame(page);
  const northbound = await captureCrossing(page, 'ArrowUp', 'cat-front');
  await expectCatContributesRenderedPixels(page);
  await expectCatOccludesPlayer(page, northbound);
});

test('farmhouse wall blocks movement while its doorway leads into the building', async ({ page }) => {
  await waitForGame(page);
  for (const key of ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft']) await walk(page, key);
  await expect.poll(async () => {
    const player = await actor(page, 'player');
    return [player.tileX, player.tileY];
  }).toEqual([1, 5]);

  const beforeWall = await actor(page, 'player');
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(150);
  expect(await actor(page, 'player')).toMatchObject({ tileX: beforeWall.tileX, tileY: beforeWall.tileY });

  await walk(page, 'ArrowRight');
  await walk(page, 'ArrowUp');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('house');
});
