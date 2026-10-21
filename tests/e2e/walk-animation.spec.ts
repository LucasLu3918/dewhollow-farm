import { expect, test, type Page } from '@playwright/test';

/**
 * 走路動畫（docs/ANIMATION_DESIGN.md）：玩家走一格時，身體起伏、傾斜、拉長，腳依方向輪流抬起或伸縮；
 * 走完回到完全靜止。姿勢的數學由 walk-pose.spec.ts 守護，這裡確認它真的接到了畫面上。
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

const REST: Pose = { y: 0, rotation: 0, scaleX: 1, scaleY: 1, legA: 0, legB: 0, stretch: 0 };
const BOB = 4; // DEFAULT_WALK_PARAMS.bob（2x 母版像素）

async function currentPose(page: Page): Promise<Pose> {
  return page.evaluate(() => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow（需用開發伺服器執行）');
    return debug.pose();
  });
}

async function rigInfo(page: Page): Promise<{ view: string; mode: string; visible: string[] }> {
  return page.evaluate(() => {
    const info = window.__dewhollow?.rig();
    if (!info) throw new Error('缺少 rig 資訊');
    return info;
  });
}

async function waitForGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('#hud-day')).toHaveText('第 1 年 春 第 1 天');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

/** 按下一個鍵，同時每個畫面更新記錄一次姿勢，直到時間到。 */
async function walkAndRecord(page: Page, key: string, windowMs = 450): Promise<Pose[]> {
  const recording = page.evaluate(async (ms) => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow');
    const samples = [];
    const start = performance.now();
    while (performance.now() - start < ms) {
      samples.push(debug.pose());
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return samples;
  }, windowMs);
  await page.keyboard.press(key);
  return recording;
}

const strongest = (samples: Pose[]): Pose =>
  samples.reduce((best, p) => (Math.abs(p.rotation) > Math.abs(best.rotation) ? p : best), samples[0] as Pose);

test('stands perfectly still at rest, with the front-view feet split in two', async ({ page }) => {
  await waitForGame(page);
  expect(await currentPose(page)).toEqual(REST);
  const rig = await rigInfo(page);
  expect(rig.view).toBe('down');
  expect(rig.mode).toBe('split-legs');
  expect([...rig.visible].sort()).toEqual(['legA', 'legB', 'upper']);
});

test('walking south bobs, sways and lifts one foot at a time, then settles back to rest', async ({ page }) => {
  await waitForGame(page);
  const samples = await walkAndRecord(page, 'ArrowDown');

  expect(samples.some((p) => p.y < 0), '身體有離地').toBe(true);
  expect(samples.some((p) => p.rotation !== 0), '身體有傾斜').toBe(true);
  expect(samples.some((p) => p.scaleY > 1), '離地時有拉長').toBe(true);
  expect(samples.every((p) => p.y <= 0 && p.y >= -BOB - 1e-9), '起伏在 0 到 bob 之間').toBe(true);

  // 第一步（偶數步）抬腳 A；不會兩隻同時抬，也不會往下；正面不做側向伸縮。
  expect(samples.some((p) => p.legA < 0)).toBe(true);
  expect(samples.every((p) => p.legB === 0)).toBe(true);
  expect(samples.every((p) => p.legA <= 0 && p.stretch === 0)).toBe(true);

  await expect.poll(() => currentPose(page)).toEqual(REST);
});

test('walking west uses one stretched block of feet instead of splitting them', async ({ page }) => {
  await waitForGame(page);
  const samples = await walkAndRecord(page, 'ArrowLeft');

  const rig = await rigInfo(page);
  expect(rig.view).toBe('left');
  expect(rig.mode).toBe('stretch-feet');
  expect([...rig.visible].sort()).toEqual(['feet', 'upper']);

  expect(samples.some((p) => p.stretch !== 0), '腳有水平伸縮').toBe(true);
  expect(samples.every((p) => p.legB === 0), '側面不拆腳').toBe(true);
  expect(samples.every((p) => p.legA <= 0)).toBe(true);
  await expect.poll(() => currentPose(page)).toEqual(REST);
});

test('leans to opposite sides on consecutive steps', async ({ page }) => {
  await waitForGame(page);
  const first = strongest(await walkAndRecord(page, 'ArrowDown'));
  await expect.poll(() => currentPose(page)).toEqual(REST);
  const second = strongest(await walkAndRecord(page, 'ArrowDown'));
  await expect.poll(() => currentPose(page)).toEqual(REST);

  expect(Math.sign(first.rotation)).not.toBe(0);
  expect(Math.sign(second.rotation)).toBe(-Math.sign(first.rotation));
});

test('previewing a pose for another view switches the feet layout without moving the body', async ({ page }) => {
  await waitForGame(page);
  const preview = await page.evaluate(() => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow');
    debug.setPose('up', 0, 0); // 背面、落地瞬間：等於靜止
    return { pose: debug.pose(), rig: debug.rig() };
  });
  expect(preview.pose).toEqual(REST);
  expect(preview.rig).toMatchObject({ view: 'up', mode: 'split-legs' });
});

test('the pose preview shows a chosen moment of the walk, so each phase can be inspected', async ({ page }) => {
  await waitForGame(page);
  const mid = await page.evaluate(() => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow');
    debug.setPose('left', 0, 0.5);
    return { pose: debug.pose(), rig: debug.rig() };
  });
  expect(mid.rig).toMatchObject({ view: 'left', mode: 'stretch-feet' });
  expect(mid.pose.y).toBeCloseTo(-BOB, 6);
  expect(mid.pose.stretch).toBeCloseTo(0.14, 6);
  expect(mid.pose.scaleY).toBeCloseTo(1.045, 6);
});
