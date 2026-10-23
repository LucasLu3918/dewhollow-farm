import { expect, test, type Page } from '@playwright/test';

/**
 * 毛毛與寵物（docs/ANIMATION_DESIGN.md、content/companions.json）：
 * - 毛毛只有單張圖，走「搖擺步」（起伏、傾斜、拉長，沒有腳的動作）；
 * - 黑貓跟著玩家，永遠落在玩家剛離開的格子，用小跳步移動；
 * - 有袋動物住在村莊毛毛旁邊，玩家跟毛毛說話時兩者都會動一下。
 * 讀取方式見 window.__dewhollow（僅開發模式）。
 */
interface Pose {
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  legA: number;
  legB: number;
  stretch: number;
}

interface Actor {
  id: string;
  kind: string;
  /** 站的格子（靜止時；移動中是小數）。 */
  tileX: number;
  tileY: number;
  left: number;
  top: number;
  width: number;
  height: number;
  pose: Pose;
}

const HOP_HEIGHT = 12; // DEFAULT_WALK_PARAMS.hopHeight（2x 母版像素）
const BOB = 4; // DEFAULT_WALK_PARAMS.bob

async function actors(page: Page): Promise<Actor[]> {
  return page.evaluate(() => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow（需用開發伺服器執行）');
    return debug.actors();
  });
}

async function actor(page: Page, id: string): Promise<Actor | undefined> {
  return (await actors(page)).find((a) => a.id === id);
}

async function waitForGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

async function press(page: Page, key: string, times = 1): Promise<void> {
  for (let i = 0; i < times; i += 1) await page.keyboard.press(key);
}

/** 按下一個鍵，同時每個畫面更新記錄一次所有角色的姿勢。 */
async function pressAndRecord(page: Page, key: string, windowMs = 450): Promise<Actor[][]> {
  const recording = page.evaluate(async (ms) => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow');
    const frames = [];
    const start = performance.now();
    while (performance.now() - start < ms) {
      frames.push(debug.actors());
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return frames;
  }, windowMs);
  await page.keyboard.press(key);
  return recording;
}

const poseOf = (frames: Actor[][], id: string): Pose[] =>
  frames.map((f) => f.find((a) => a.id === id)?.pose).filter((p): p is Pose => p !== undefined);

const REST: Pose = { y: 0, rotation: 0, scaleX: 1, scaleY: 1, legA: 0, legB: 0, stretch: 0 };

/** 從農場出生點往南走進村莊（穿過南門）。 */
async function enterVillage(page: Page): Promise<void> {
  await press(page, 'ArrowDown', 20);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('village');
  await expect.poll(async () => (await actor(page, 'maomao'))?.pose).toEqual(REST);
}

async function pauseScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow');
    return debug.pauseScene();
  });
}

async function expectPetBaselineCanvas(page: Page): Promise<void> {
  const size = await page.locator('#game canvas').evaluate((canvas) => {
    const { width, height } = canvas.getBoundingClientRect();
    return { width: Math.round(width), height: Math.round(height) };
  });
  expect(size).toEqual({ width: 926, height: 694 });
}

async function waitForCameraToSettle(page: Page): Promise<{ x: number; y: number }> {
  const settled = await page.evaluate(() => new Promise<{ x: number; y: number } | null>((resolve) => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow');
    let previous = debug.cameraScroll();
    let stableFrames = 0;
    const deadline = performance.now() + 5_000;
    const sample = (): void => {
      const current = debug.cameraScroll();
      stableFrames = current.x === previous.x && current.y === previous.y ? stableFrames + 1 : 0;
      previous = current;
      if (stableFrames >= 5) {
        resolve(current);
      } else if (performance.now() >= deadline) {
        resolve(null);
      } else {
        requestAnimationFrame(sample);
      }
    };
    requestAnimationFrame(sample);
  }));
  expect(settled, '相機 scroll 應連續五個畫面更新保持不變').not.toBeNull();
  return settled!;
}

async function setPetBaselineViewport(page: Page): Promise<void> {
  // Restore the pre-MOBILE-007 desktop stage geometry used by the approved 1280×720 pet goldens.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    const random = Math.random;
    Math.random = () => {
      Math.random = random;
      return 0;
    };

    const addStyle = () => {
      if (!document.head) return false;
      const style = document.createElement('style');
      style.dataset.petBaselineLayout = 'true';
      style.textContent = `
        @media (orientation: landscape) and (min-width: 601px) and (min-height: 521px) {
          .app {
            height: auto !important;
            grid-template-rows: auto auto auto !important;
          }
          .app .stage {
            width: 100% !important;
            height: auto !important;
            aspect-ratio: 4 / 3 !important;
          }
        }
      `;
      document.head.append(style);
      return true;
    };
    if (!addStyle()) {
      const observer = new MutationObserver(() => {
        if (addStyle()) observer.disconnect();
      });
      observer.observe(document, { childList: true, subtree: true });
    }
  });
}

test('the pets have their own real 2x images, and only the cat is on the farm', async ({ page }) => {
  await waitForGame(page);
  for (const key of ['pet.cat', 'pet.marsupial']) {
    expect(await page.evaluate((k) => window.__dewhollow?.textureSize(k), key), key).toEqual({ width: 96, height: 96 });
  }
  const ids = (await actors(page)).map((a) => a.id).sort();
  expect(ids).toEqual(['cat', 'player']);
});

test('the approved cat artwork matches the farm visual baseline', async ({ page }) => {
  await setPetBaselineViewport(page);
  await waitForGame(page);
  await expect(page.locator('#hud-weather')).toContainText('晴');
  await expectPetBaselineCanvas(page);
  await expect.poll(async () => (await actor(page, 'cat'))?.pose).toEqual(REST);
  await expect.poll(async () => (await actor(page, 'player'))?.pose).toEqual(REST);
  await pauseScene(page);
  await expect(page.locator('#game canvas')).toHaveScreenshot('pet-cat-farm.png', {
    animations: 'disabled',
  });
});

test('the approved cat and quokka artwork match the village visual baseline', async ({ page }) => {
  await setPetBaselineViewport(page);
  await waitForGame(page);
  await expect(page.locator('#hud-weather')).toContainText('晴');
  await expectPetBaselineCanvas(page);
  await enterVillage(page);
  const settledCamera = await waitForCameraToSettle(page);
  await expect.poll(async () => (await actor(page, 'marsupial'))?.pose).toEqual(REST);
  await expect.poll(async () => (await actor(page, 'player'))?.pose).toEqual(REST);
  await pauseScene(page);
  expect(await page.evaluate(() => window.__dewhollow?.cameraScroll())).toEqual(settledCamera);
  await expect(page.locator('#game canvas')).toHaveScreenshot('pet-companions-village.png', {
    animations: 'disabled',
  });
});

test('the cat starts beside the player, standing on a tile of its own', async ({ page }) => {
  await waitForGame(page);
  const player = await actor(page, 'player');
  const cat = await actor(page, 'cat');
  expect(player && cat).toBeTruthy();
  const distance = Math.max(Math.abs((cat?.tileX ?? 0) - (player?.tileX ?? 0)), Math.abs((cat?.tileY ?? 0) - (player?.tileY ?? 0)));
  expect(distance).toBe(1);
  // 貓的圖是 96×96，顯示成 48×48，腳底貼齊格子底部。
  expect(cat).toMatchObject({ width: 48, height: 48 });
});

test('the cat trails one step behind, always on the tile the player just left', async ({ page }) => {
  await waitForGame(page);
  for (let step = 1; step <= 3; step += 1) {
    await press(page, 'ArrowDown');
    // 出生點 (7,9)：走第 n 步後，玩家在 (7,9+n)，貓在 (7,8+n)。
    await expect.poll(async () => (await actor(page, 'player'))?.tileY).toBe(9 + step);
    await expect.poll(async () => (await actor(page, 'cat'))?.tileY).toBe(8 + step);
    expect((await actor(page, 'cat'))?.tileX).toBe(7);
  }
});

test('the cat hops instead of walking: higher than a person bobs, no tilt, no feet', async ({ page }) => {
  await waitForGame(page);
  const frames = await pressAndRecord(page, 'ArrowDown');
  const hops = poseOf(frames, 'cat');
  expect(hops.length).toBeGreaterThan(3);

  expect(hops.some((p) => p.y < 0), '貓有跳起來').toBe(true);
  expect(hops.every((p) => p.y <= 0 && p.y >= -HOP_HEIGHT - 1e-9)).toBe(true);
  expect(Math.min(...hops.map((p) => p.y))).toBeLessThan(-BOB); // 比人走路的起伏高
  expect(hops.every((p) => p.rotation === 0 && p.legA === 0 && p.legB === 0 && p.stretch === 0)).toBe(true);
  await expect.poll(async () => (await actor(page, 'cat'))?.pose).toEqual(REST);
});

test('the cat comes through the door and appears beside the player in the village', async ({ page }) => {
  await waitForGame(page);
  await enterVillage(page);
  const player = await actor(page, 'player');
  const cat = await actor(page, 'cat');
  expect(cat).toBeTruthy();
  const distance = Math.max(Math.abs((cat?.tileX ?? 0) - (player?.tileX ?? 0)), Math.abs((cat?.tileY ?? 0) - (player?.tileY ?? 0)));
  expect(distance).toBe(1);
  expect(cat?.pose).toEqual(REST);
});

test('Maomao and the marsupial live in the village, side by side, and the village has no extra cat', async ({ page }) => {
  await waitForGame(page);
  await enterVillage(page);
  // 村莊的居民（榕伯、阿柑…）也是角色，所以不能只比對四位；確認四位都在，且其他角色都是居民。
  const ids = (await actors(page)).map((a) => a.id);
  expect(ids).toEqual(expect.arrayContaining(['cat', 'maomao', 'marsupial', 'player']));
  const residents = ['rong-bo', 'a-gan', 'shi-shifu', 'zhi-lan', 'xiao-sui'];
  for (const id of ids) expect(['cat', 'maomao', 'marsupial', 'player', ...residents]).toContain(id);
  expect(await actor(page, 'maomao')).toMatchObject({ kind: 'single', tileX: 10, tileY: 5, width: 64, height: 80 });
  expect(await actor(page, 'marsupial')).toMatchObject({ kind: 'hop', tileX: 11, tileY: 5, width: 48, height: 48 });

  // 走回農場，村莊的居民就不在畫面上了。
  await press(page, 'ArrowDown');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await expect.poll(async () => (await actors(page)).map((a) => a.id).sort()).toEqual(['cat', 'player']);
});

test('talking to Maomao makes him sway in place and the marsupial hop, then both settle', async ({ page }) => {
  await waitForGame(page);
  await enterVillage(page);
  // 村莊出生點 (7,10) → (10,6)，面向北邊的毛毛 (10,5)。
  await press(page, 'ArrowRight', 3);
  await press(page, 'ArrowUp', 4);
  await expect.poll(async () => (await actor(page, 'player'))?.tileY).toBe(6);
  await expect.poll(async () => (await actor(page, 'player'))?.pose).toEqual(REST);
  await expect.poll(async () => (await actor(page, 'cat'))?.pose).toEqual(REST);

  const frames = await pressAndRecord(page, 'x');
  const maomao = poseOf(frames, 'maomao');
  const marsupial = poseOf(frames, 'marsupial');

  // 毛毛：單張圖的搖擺步——起伏與傾斜，但沒有腳的動作；人還站在原地。
  expect(maomao.some((p) => p.y < 0)).toBe(true);
  expect(maomao.some((p) => p.rotation !== 0)).toBe(true);
  expect(maomao.every((p) => p.legA === 0 && p.legB === 0 && p.stretch === 0)).toBe(true);
  expect(Math.max(...maomao.map((p) => -p.y))).toBeLessThanOrEqual(BOB + 1e-9);

  // 有袋動物：小跳步，比人高、不傾斜。
  expect(marsupial.some((p) => p.y < -BOB)).toBe(true);
  expect(marsupial.every((p) => p.rotation === 0)).toBe(true);

  await expect.poll(async () => (await actor(page, 'maomao'))?.pose).toEqual(REST);
  await expect.poll(async () => (await actor(page, 'marsupial'))?.pose).toEqual(REST);
  expect(await actor(page, 'maomao')).toMatchObject({ tileX: 10, tileY: 5 });
  expect(await actor(page, 'marsupial')).toMatchObject({ tileX: 11, tileY: 5 });
  await expect(page.locator('#hud-log')).toContainText('你好');
});

test('standing still makes nobody move: every actor is exactly at rest', async ({ page }) => {
  await waitForGame(page);
  for (const a of await actors(page)) expect(a.pose, a.id).toEqual(REST);
});
